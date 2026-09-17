/*
 * (c) Copyright Ascensio System SIA 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * The TypeScript the generator writes - src/index.ts and src/locales.ts - as text. Every name
 * comes from the scope contract; members are arrow-function class fields because the loader
 * calls them from its own code.
 */

import { localeMember } from "../contract.mjs";
import { camelCase } from "./scopes.mjs";

const licenseHeader = () => `/*
 * (c) Copyright Ascensio System SIA ${new Date().getFullYear()}
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

`;

const STATUS_MEMBERS = `  updateStatus = (status: PluginStatus): void => {
    this.status = status;
  };

  getStatus = (): PluginStatus => this.status;

  setOnLoadCallback = (callback: () => Promise<void>): void => {
    this.onLoadCallback = callback;
  };`;

/** The TODO per scope where the items belong; the closing note is the scope's own gotcha. */
const registrationTodos = (scopes) => {
  const itemTodos = scopes.itemMapScopes.map(({ name, spec, contract }) => {
    const fields = [...contract.required, ...(contract.oneOf ? [contract.oneOf[0]] : [])];

    const lines = [
      `    // TODO: this.${contract.adder}({ ... }) - ${contract.item} requires ${fields.join(", ")}.`,
      `    //   Restrict it to user types with ${contract.filter} if it should not be visible to everyone.`,
    ];

    if (spec.note) lines.push(`    //   ${name}: ${spec.note}.`);

    return lines.join("\n");
  });

  const memberTodos = scopes.all
    .filter(({ spec }) => spec.members && spec.note)
    .map(({ name, spec }) => `    // TODO: ${name}: ${spec.note}.`);

  return (
    [...itemTodos, ...memberTodos].join("\n\n") ||
    "    // None of the declared scopes registers anything, so there is nothing to add here."
  );
};

const itemMapMethods = ({ spec, contract }) => {
  const { field, item, key, adder, getter, updater } = contract;

  const extraMethods = spec.extraMethods ? `\n${spec.extraMethods(contract)}` : "";

  const updateMethod = updater
    ? `\n  ${updater} = (item: ${item}): void => {
    this.${field}.set(item.${key}, item);
  };\n`
    : "";

  return `  ${adder} = (item: ${item}): void => {
    this.${field}.set(item.${key}, item);
  };

  ${getter} = (): Map<string, ${item}> => this.${field};
${extraMethods}${updateMethod}`;
};

/** src/index.ts - the plugin class. Registers no items on purpose: a TODO per scope instead. */
export const renderPluginClass = ({ pluginName, scopes, sdkPackage }) => {
  const scopeMembers = scopes.all
    .filter(({ spec }) => spec.members)
    .map(({ spec }) => spec.members)
    .join("\n");

  return `${licenseHeader()}import {
${scopes.sdkTypes.map((type) => `  ${type},`).join("\n")}
} from "${sdkPackage}";

import { currentLocale, setLocale } from "./locales";

class ${pluginName}
  implements
${scopes.implementedInterfaces.map((interfaceName) => `    ${interfaceName}`).join(",\n")}
{
  status: PluginStatus = PluginStatus.active;

${scopes.itemMapScopes
  .map(({ contract }) => `  ${contract.field}: Map<string, ${contract.item}> = new Map();\n`)
  .join("\n")}${scopeMembers ? `\n${scopeMembers}` : ""}
  // Register items here rather than at module scope. Both are read in time, but
  // setLanguage and setAPI only run after the bundle executes - so a factory that
  // translates a label or calls getAPI() at module scope would capture empty values.
  //
  // Anything with a visible surface is a React component (a .tsx file under src/,
  // built from @onlyoffice/apps-ui-kit) handed over as the item's \`component\`. Icons are
  // referenced by file name and resolved against assets/. Labels should come from
  // t() in ./locales, which means adding the key to TStrings first.
  onLoadCallback = async (): Promise<void> => {
${registrationTodos(scopes)}
  };

${STATUS_MEMBERS}

  // Called once, immediately before onLoadCallback - not again when the language
  // changes (that reloads the whole plugin as a fresh module, so the factories run
  // again on their own). Recording the locale is the whole job: the item factories
  // below it are what translate the labels.
  setLanguage = (language: PluginLocale): void => {
    setLocale(language);
  };

  getLanguage = (): PluginLocale => currentLocale();

${scopes.itemMapScopes.map(itemMapMethods).join("\n")}}

const plugin = new ${pluginName}();

export default plugin;
`;
};

/** Locale tags are not identifiers: pt-BR has to become pt_BR to name a const. */
const asIdentifier = (localeTag) => localeTag.replace(/[^a-z0-9]/gi, "_");

/**
 * src/locales.ts - plain typed strings, with the example key commented out so no unwritten
 * string ships. Every table is keyed by a PluginLocale member rather than a hand-written
 * tag: the portal calls setLanguage with the enum's value, so a table under "ja" instead of
 * PluginLocale.JA_JP is never reached and the language silently falls back to English.
 */
export const renderLocales = ({ scopes, extraLocales, sdkPackage }) => {
  const [firstItemScope] = scopes.itemMapScopes;
  const exampleKey = firstItemScope ? `${camelCase(firstItemScope.name)}.label` : "myItem.label";

  const tables = extraLocales.map((localeTag) => ({
    tag: localeTag,
    member: localeMember(localeTag),
    name: asIdentifier(localeTag),
  }));

  const extraLocaleTables = tables
    .map(({ tag, name }) => `// TODO: the same keys as en, translated into ${tag}.
const ${name}: TStrings = {};

`)
    .join("");

  const translationEntries = tables
    .map(({ member, name }) => `  [PluginLocale.${member}]: ${name},`)
    .join("\n");

  return `${licenseHeader()}import { PluginLocale } from "${sdkPackage}";

/**
 * Plain typed strings rather than an i18n library: the bundle stays small and a
 * missing key is a compile error instead of a blank label at runtime.
 *
 * Add one key per user-visible string as the items are written. t() accepts only
 * keys listed here, which is the point - a label that was never translated fails
 * the build rather than rendering blank in the portal. Components call t() at
 * render time, so they pick the current language up on their own.
 */
export type TStrings = {
  // "${exampleKey}": string;
};

const en: TStrings = {
  // "${exampleKey}": "Do the thing",
};

${extraLocaleTables}/**
 * Keyed by PluginLocale, not by a string: the portal passes the enum's own value to
 * setLanguage, and a table filed under anything else is never found.
 */
const translations: Partial<Record<PluginLocale, TStrings>> = {
  [PluginLocale.EN_US]: en,
${translationEntries}
};

let locale: PluginLocale = PluginLocale.EN_US;

export const setLocale = (next: PluginLocale): void => {
  locale = translations[next] ? next : PluginLocale.EN_US;
};

export const currentLocale = (): PluginLocale => locale;

export const t = (key: keyof TStrings): string => (translations[locale] ?? en)[key];

/**
 * t() with placeholders: tf("room.renamed", { title }) fills every {title} in the string.
 * A missing value is left as the placeholder rather than printing "undefined".
 */
export const tf = (key: keyof TStrings, values: Record<string, string | number>): string =>
  t(key).replace(/\\{(\\w+)\\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
`;
};

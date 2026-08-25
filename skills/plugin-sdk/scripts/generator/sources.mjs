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
 * The TypeScript the generator writes - src/index.ts and src/locales.ts - as plain
 * text. Every name comes from the scope contract, and members are emitted as arrow
 * function class fields: the loader spreads the plugin object, so methods lose `this`.
 */

/** Base for a generated TypeScript file. */
class SourceFile {
  /**
   * @param {{ sdkPackage: string, year?: number }} context
   */
  constructor({ sdkPackage, year = new Date().getFullYear() }) {
    this.sdkPackage = sdkPackage;
    this.year = year;
  }

  get licenseHeader() {
    return `/*
 * (c) Copyright Ascensio System SIA ${this.year}
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
  }

  /** Everything below the licence header. Subclasses implement this. */
  body() {
    throw new Error(`${this.constructor.name} does not implement body()`);
  }

  render() {
    return `${this.licenseHeader}\n${this.body()}`;
  }
}

/**
 * src/index.ts - the plugin class. It registers no items on purpose: onLoadCallback
 * carries a TODO per scope, so a placeholder cannot survive into an upload.
 */
export class PluginClassSource extends SourceFile {
  /**
   * @param {{
   *   pluginName: string,
   *   scopes: import("./scopes.mjs").ScopeSelection,
   *   sdkPackage: string,
   *   year?: number,
   * }} options
   */
  constructor({ pluginName, scopes, sdkPackage, year }) {
    super({ sdkPackage, year });

    this.pluginName = pluginName;
    this.scopes = scopes;
  }

  body() {
    return `${this.#imports()}

${this.#classDeclaration()}
{
  status: PluginStatus = PluginStatus.active;

${this.#itemMapFields()}${this.#scopeMembers()}
${this.#onLoadCallback()}

${this.#statusMembers()}

${this.#localisationMembers()}

${this.#itemMapMethods()}}

${this.#registration()}`;
  }

  #imports() {
    const types = this.scopes.sdkTypes.map((type) => `  ${type},`).join("\n");

    return `import {
${types}
} from "${this.sdkPackage}";

import { currentLocale, setLocale } from "./locales";`;
  }

  #classDeclaration() {
    const interfaces = this.scopes.implementedInterfaces
      .map((interfaceName) => `    ${interfaceName}`)
      .join(",\n");

    return `class ${this.pluginName}
  implements
${interfaces}`;
  }

  /** One Map per item-registering scope, keyed and typed by the contract. */
  #itemMapFields() {
    return this.scopes.itemMapScopes
      .map(({ contract }) => `  ${contract.field}: Map<string, ${contract.item}> = new Map();\n`)
      .join("\n");
  }

  /** The plain members of the scopes that keep no map: API, Settings, PostMessage. */
  #scopeMembers() {
    const members = this.scopes.scopes
      .filter(({ spec }) => spec.members)
      .map(({ spec }) => spec.members())
      .join("\n");

    return members ? `\n${members}` : "";
  }

  #onLoadCallback() {
    return `  // Register items here rather than at module scope. Both are read in time, but
  // setLanguage and setAPI only run after the bundle executes - so a factory that
  // translates a label or calls getAPI() at module scope would capture empty values.
  //
  // Icons are referenced by file name and resolved against assets/. Labels should
  // come from t() in ./locales, which means adding the key to TStrings first.
  onLoadCallback = async (): Promise<void> => {
${this.#registrationTodos()}
  };`;
  }

  /**
   * What to write, per scope, where the items belong. Required and filter fields come
   * from the contract; the closing note is the scope spec's own gotcha.
   */
  #registrationTodos() {
    const todos = this.scopes.itemMapScopes.map(({ name, spec, contract }) => {
      const lines = [
        `    // TODO: this.${contract.adder}({ ... }) - ${contract.item} requires ${contract.required.join(", ")}.`,
        `    //   Restrict it to user types with ${contract.filter} if it should not be visible to everyone.`,
      ];

      if (spec.note) lines.push(`    //   ${name}: ${spec.note}.`);

      return lines.join("\n");
    });

    return (
      todos.join("\n\n") ||
      "    // None of the declared scopes registers items, so there is nothing to add here."
    );
  }

  #statusMembers() {
    return `  updateStatus = (status: PluginStatus): void => {
    this.status = status;
  };

  getStatus = (): PluginStatus => this.status;

  setOnLoadCallback = (callback: () => Promise<void>): void => {
    this.onLoadCallback = callback;
  };`;
  }

  #localisationMembers() {
    return `  // The portal calls this when the interface language changes. Labels are captured
  // when an item is built, so the items have to be rebuilt here - otherwise they
  // keep the language they were registered in.
  setLanguage = (language: PluginLocale): void => {
    setLocale(language);
${this.#rebuildTodos()}
  };

  getLanguage = (): PluginLocale => currentLocale();`;
  }

  #rebuildTodos() {
    const todos = this.scopes.itemMapScopes.map(
      // EventListener has no updater - re-adding overwrites by key just the same.
      ({ name, contract }) =>
        `    // TODO: this.${contract.updater ?? contract.adder}(...) for every ${name} item registered above.`,
    );

    return todos.join("\n") || "    // Nothing to rebuild while no items are registered.";
  }

  /** The adder, getter and updater the loader calls, per item-registering scope. */
  #itemMapMethods() {
    return this.scopes.itemMapScopes.map((scope) => this.#itemMapMethodsFor(scope)).join("\n");
  }

  #itemMapMethodsFor({ spec, contract }) {
    const { field, item, key, adder, getter, updater } = contract;

    const extraMethods = spec.extraMethods ? `\n${spec.extraMethods(contract)}` : "";

    // EventListener is the one scope with no updater in the SDK.
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
  }

  /**
   * The key under window.Plugins has to equal pluginName in the manifest - the loader
   * finds nothing on a mismatch. The portal creates window.Plugins, not the bundle.
   */
  #registration() {
    return `const plugin = new ${this.pluginName}();

declare global {
  interface Window {
    Plugins: Record<string, unknown>;
  }
}

window.Plugins.${this.pluginName} = plugin || {};

export default plugin;
`;
  }
}

/** Locale tags are not identifiers: pt-BR has to become pt_BR to name a const. */
const asIdentifier = (localeTag) => localeTag.replace(/[^a-z0-9]/gi, "_");

/**
 * src/locales.ts - the plugin's strings: plain typed strings rather than an i18n
 * dependency, with the example key commented out so no unwritten string ships.
 */
export class LocalesSource extends SourceFile {
  /**
   * @param {{
   *   scopes: import("./scopes.mjs").ScopeSelection,
   *   extraLocales: string[],
   *   sdkPackage: string,
   *   year?: number,
   * }} options
   */
  constructor({ scopes, extraLocales, sdkPackage, year }) {
    super({ sdkPackage, year });

    this.scopes = scopes;
    this.extraLocales = extraLocales;
  }

  body() {
    return `import { PluginLocale } from "${this.sdkPackage}";

/**
 * Plain typed strings rather than an i18n library: the bundle stays small and a
 * missing key is a compile error instead of a blank label at runtime.
 *
 * Add one key per user-visible string as the items are written. t() accepts only
 * keys listed here, which is the point - a label that was never translated fails
 * the build rather than rendering blank in the portal.
 */
export type TStrings = {
  // "${this.#exampleKey}": string;
};

const en: TStrings = {
  // "${this.#exampleKey}": "Do the thing",
};

${this.#extraLocaleTables()}const translations: Partial<Record<string, TStrings>> = {
  [PluginLocale.EN_US]: en,
${this.#translationEntries()}
};

${this.#accessors()}`;
  }

  /** Named after the first item-registering scope, or a neutral key when there is none. */
  get #exampleKey() {
    const [firstItemScope] = this.scopes.itemMapScopes;

    return firstItemScope ? `${firstItemScope.camelCaseName}.label` : "myItem.label";
  }

  #extraLocaleTables() {
    return this.extraLocales
      .map(
        (localeTag) =>
          `// TODO: the same keys as en, translated.\nconst ${asIdentifier(localeTag)}: TStrings = {};\n\n`,
      )
      .join("");
  }

  #translationEntries() {
    return this.extraLocales
      .map((localeTag) => `  "${localeTag}": ${asIdentifier(localeTag)},`)
      .join("\n");
  }

  #accessors() {
    return `let locale: PluginLocale = PluginLocale.EN_US;

export const setLocale = (next: PluginLocale): void => {
  locale = translations[next] ? next : PluginLocale.EN_US;
};

export const currentLocale = (): PluginLocale => locale;

export const t = (key: keyof TStrings): string => (translations[locale] ?? en)[key];
`;
  }
}

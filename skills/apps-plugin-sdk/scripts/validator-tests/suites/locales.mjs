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
 * Locale tables. The portal calls setLanguage with a PluginLocale value, so a table filed
 * under a tag the enum does not have - "ja" where the enum says "ja-JP" - is never read and
 * that language quietly reads English. It compiles, it installs, and only the reader of the
 * enum ever finds out; hence a check.
 */

import { contextMenuProject, manifestFor } from "../fixtures.mjs";

export const title = "locales";

/** What a plugin written without the enum looks like: strings all the way down. */
const handWrittenLocalesFile = `
const tables = {
  "en-US": { "item.label": "Do the thing" },
  "ja": { "item.label": "Yaru" },
};
export const t = (key) => tables["en-US"][key];
`;

const localesFile = (entries) => `
import { PluginLocale } from "@onlyoffice/docspace-plugin-sdk";
const en = { "item.label": "Do the thing" };
const other = { "item.label": "Etwas tun" };
const translations = {
  [PluginLocale.EN_US]: en,
${entries}
};
export const t = (key) => (translations[PluginLocale.EN_US] ?? en)[key];
`;

export default ({ workspace, check }) => {
  const withLocales = (dirName, entries) => {
    const dir = workspace.write(dirName, contextMenuProject(dirName, "FixtureLocales"));
    workspace.writeSourceFile(dir, "locales.ts", localesFile(entries));
    return workspace.validate(dir);
  };

  const shortTag = withLocales("locales-short-tag", `  "ja": other,`);

  check(
    "a locale table keyed by a language subtag is an error naming the enum member",
    shortTag.hasFindingMentioning("locale", '"ja"', "PluginLocale.JA_JP"),
    shortTag.messageSummary,
  );
  check(
    "the message says what the user would see",
    shortTag.errorsMention("falls back to English"),
    shortTag.messagesFor("locale"),
  );

  const region = withLocales("locales-region-tag", `  "pt-BR": other,\n  [PluginLocale.RU]: other,`);

  check(
    "a tag the enum does have is left alone, whether quoted or a member",
    !region.errorCodes.includes("locale"),
    region.messagesFor("locale"),
  );

  const notALocale = withLocales("locales-other-keys", `  "ok": other,\n  "tab": other,`);

  check(
    "a short key that is not a near-miss of any locale is not guessed at",
    !notALocale.errorCodes.includes("locale"),
    notALocale.messagesFor("locale"),
  );

  const english = withLocales("locales-bare-en", `  "en": other,`);

  check(
    "\"en\" is reported too - the enum has en-US and en-GB, not en",
    english.hasFindingMentioning('"en"', "PluginLocale.EN_US"),
    english.messagesFor("locale"),
  );

  // The audit case: a plugin that never imports the enum is exactly the one that gets the
  // tags wrong, so the file being named for its strings is enough to look at it.
  const handWritten = workspace.write("locales-hand-written", contextMenuProject("hand-written", "FixtureHandWritten"));
  workspace.writeSourceFile(handWritten, "locales.ts", handWrittenLocalesFile);
  const foreign = workspace.validate(handWritten);

  check(
    "a table written without importing PluginLocale is still checked",
    foreign.hasFindingMentioning("locales.ts", '"ja"', "PluginLocale.JA_JP"),
    foreign.messageSummary,
  );

  const manifest = workspace.validateProject("locales-manifest", {
    ...contextMenuProject("manifest", "FixtureLocaleManifest"),
    pkg: manifestFor("manifest", "FixtureLocaleManifest", {
      nameLocale: { "en-US": "Fixture", ja: "Fixture" },
      descriptionLocale: { "pt-BR": "Descricao" },
    }),
  });

  check(
    "a nameLocale entry under a tag the portal never asks for is a warning",
    manifest.warningCodes.includes("pkg.nameLocale") && manifest.hasFindingMentioning('"ja"', '"ja-JP"'),
    manifest.messagesFor("pkg.nameLocale"),
  );
  check(
    "a manifest locale table the enum does have is left alone",
    !manifest.warningCodes.includes("pkg.descriptionLocale"),
    manifest.messagesFor("pkg.descriptionLocale"),
  );
};

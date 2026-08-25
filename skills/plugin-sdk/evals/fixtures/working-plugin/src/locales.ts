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

import { PluginLocale } from "@onlyoffice/docspace-plugin-sdk";

/**
 * Plain typed strings rather than an i18n library: the bundle stays small and a
 * missing key is a compile error instead of a blank label at runtime.
 */
export type TStrings = {
  "note.edit": string;
  "note.title": string;
  "note.placeholder": string;
  "note.save": string;
  "note.saved": string;
};

const en: TStrings = {
  "note.edit": "Edit room note",
  "note.title": "Room note",
  "note.placeholder": "Anything the next person should know",
  "note.save": "Save",
  "note.saved": "Note saved",
};

const de: TStrings = {
  "note.edit": "Raumnotiz bearbeiten",
  "note.title": "Raumnotiz",
  "note.placeholder": "Was der Nächste wissen sollte",
  "note.save": "Speichern",
  "note.saved": "Notiz gespeichert",
};

const translations: Partial<Record<string, TStrings>> = {
  [PluginLocale.EN_US]: en,
  [PluginLocale.DE]: de,
};

let locale: PluginLocale = PluginLocale.EN_US;

export const setLocale = (next: PluginLocale): void => {
  locale = translations[next] ? next : PluginLocale.EN_US;
};

export const currentLocale = (): PluginLocale => locale;

export const t = (key: keyof TStrings): string => (translations[locale] ?? en)[key];

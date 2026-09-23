<!-- synced-from: docspace-ui-kit-react 4.0.0 (fafb716c) providers/translation/README.md -->
<!-- do-not-edit: regenerate with `node tools/sync-ui-kit.mjs --from <kit> --write`; correct the text in the kit -->
<!-- body-sha256: 6060038b56d5a9cca926042b032f304abdf1932550e106a0dc9858c6765c9935 -->

> Synced from the kit's own `providers/translation/README.md` at 4.0.0. Where this page and [SKILL.md](../../../SKILL.md) disagree, the skill's rule wins until the kit is corrected.

# TranslationProvider

Wraps children with `I18nextProvider` when translations are available. Falls back to plain rendering when no translations are provided.

## Props

| Prop           | Type              | Required | Description                                         |
| -------------- | ----------------- | -------- | --------------------------------------------------- |
| `settings`     | `SettingsDto`     | No       | Portal settings (used for `culture` and `timezone`) |
| `user`         | `EmployeeFullDto` | No       | Current user (used for `cultureName`)               |
| `locale`       | `string`          | No       | Explicit locale override (takes highest priority)   |
| `translations` | `TTranslations`   | No       | Translation resources map                           |
| `children`     | `React.ReactNode` | Yes      | Child components                                    |

## `TTranslations` Type

```ts
type TTranslations = Map<string, Map<string, Record<string, string>>>;
```

The structure is a nested Map:

```
TTranslations
 └─ key: language code (e.g. "en", "fr", "de")
     └─ value: Map
         └─ key: namespace (e.g. "Common")
             └─ value: JSON object { translationKey: translatedString }
```

The default (and currently only) namespace is `"Common"`.

## How to Import and Pass Translations

### Step 1 — Import the JSON locale files

Translation files live in `locales/<lang>/Common.json`. Import the ones you need:

```ts
// Single language
import enCommon from "@onlyoffice/apps-ui-kit/locales/en/Common.json";

// Other languages come from your own resources
import frCommon from "./locales/fr/Common.json";
import deCommon from "./locales/de/Common.json";
```

The package ships `locales/en` and nothing else. Every other language is the
host application's to supply -- the provider takes whatever map it is given,
so the keys are what has to match, not the file's origin.

### Step 2 — Import the `TTranslations` type

```ts
import type { TTranslations } from "@onlyoffice/apps-ui-kit/providers/translation";
```

### Step 3 — Build the translations Map

Each entry in the outer Map is a language. Each entry in the inner Map is a namespace (`"Common"`) mapped to the imported JSON.

```ts
// English only
const translations: TTranslations = new Map([
  ["en", new Map([["Common", enCommon]])],
]);

// Multiple languages
const translations: TTranslations = new Map([
  ["en", new Map([["Common", enCommon]])],
  ["fr", new Map([["Common", frCommon]])],
  ["de", new Map([["Common", deCommon]])],
]);
```

### Step 4 — Pass translations to the provider

```tsx
import { TranslationProvider } from "@onlyoffice/apps-ui-kit/providers/translation";

<TranslationProvider translations={translations} locale="en">
  <App />
</TranslationProvider>;
```

### Full example

```tsx
import { TranslationProvider } from "@onlyoffice/apps-ui-kit/providers/translation";
import type { TTranslations } from "@onlyoffice/apps-ui-kit/providers/translation";
import { useTranslation } from "react-i18next";

import enCommon from "@onlyoffice/apps-ui-kit/locales/en/Common.json";
import frCommon from "./locales/fr/Common.json"; // your own resources: the package ships English only

const translations: TTranslations = new Map([
  ["en", new Map([["Common", enCommon]])],
  ["fr", new Map([["Common", frCommon]])],
]);

function MyComponent() {
  const { t } = useTranslation("Common");
  return <p>{t("SaveButton")}</p>; // renders "Save" in English
}

function App() {
  return (
    <TranslationProvider translations={translations} locale="en">
      <MyComponent />
    </TranslationProvider>
  );
}
```

## Language Resolution

Priority order: `locale` > `user.cultureName` > `settings.culture` > `"en"`

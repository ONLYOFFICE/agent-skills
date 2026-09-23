# Setting the kit up in an application

What an application does once, before any component of the kit renders correctly. Everything
here was read from the kit's source at 4.0.0; where a synced component page disagrees, this
page is the one to follow.

## Install it

The package is on no registry. It is installed from a tarball packed out of a checkout of
`docspace-ui-kit-react`:

```sh
pnpm build && pnpm pack            # in the kit's checkout; pnpm, not npm
npm i ../docspace-ui-kit-react/onlyoffice-apps-ui-kit-4.0.0.tgz
```

**Packed with pnpm, not npm.** The kit keeps its published entry points in
`publishConfig` — a pnpm feature. An npm-packed tarball has no `exports` and no `main` at
all, and every import from it fails to resolve.

Four peer dependencies are required and are not installed for you:

```sh
npm i react@^19 react-dom@^19 i18next@^25.5.2 react-i18next@^15.7.3
```

Fifteen further peers (`mobx`, `axios`, `socket.io-client`, `@onlyoffice/ai-chat`, …) are
declared optional. They belong to the portal-internal modules; an application that imports
none of those installs none of them.

## Do not import the stylesheet

Every module of the kit imports its own CSS —
`dist/esm/components/button/Button.module.scss/index.css` arrives with `Button` — so a
bundler that resolves CSS imports from `node_modules` needs nothing added. Vite, webpack 5
and Next all do.

`@onlyoffice/apps-ui-kit/styles.css` exists for builds that cannot: it is the whole library
in one file, 727 KB, and importing it in an application that only uses a dozen components
ships the styles of the other eighty-six.

If components render unstyled, the bundler is not following those CSS imports. Check that
the kit is not marked external or excluded from transformation before reaching for
`styles.css`.

## Mount the two providers

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeKeys } from "@onlyoffice/apps-ui-kit/enums";
import { ThemeProvider } from "@onlyoffice/apps-ui-kit/providers/theme";
import { TranslationProvider } from "@onlyoffice/apps-ui-kit/providers/translation";
import common from "@onlyoffice/apps-ui-kit/locales/en/Common.json";

import { App } from "./App";

// Map<language, Map<namespace, resources>>. The kit's own labels live in the
// "Common" namespace; add namespaces of your own to the inner map.
const translations = new Map([["en", new Map([["Common", common]])]]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider initialTheme={ThemeKeys.BaseStr} locale="en">
      <TranslationProvider locale="en" translations={translations}>
        <App />
      </TranslationProvider>
    </ThemeProvider>
  </StrictMode>,
);
```

`$SKILL/templates/main` and `$SKILL/templates/providers` are this, split into the entry point
and a composed `AppProviders`, ready to copy into a project. The JSON import needs
`"resolveJsonModule": true` in `tsconfig.json`.

### ThemeProvider

From `@onlyoffice/apps-ui-kit/providers/theme`, also in the root barrel. It takes
`initialTheme`, `systemTheme`, `colorTheme` and `locale`, and renders nothing of its own: it
resolves a theme object and hands it to the kit's lower-level provider, which writes the
theme onto the document.

- `initialTheme` — a `ThemeKeys`: `BaseStr` ("Base", light), `DarkStr` ("Dark") or `SystemStr`
  ("System", which reads the OS preference). Omitted, the OS preference decides.
- `locale` — decides both the writing direction (`ar`, `he` and the rest resolve to RTL) and
  the font family the document gets. It is not the language of the labels; that is
  `TranslationProvider`'s `locale`. Pass the same string to both.
- `colorTheme` — the portal's custom accent palette, a `CustomColorThemesSettingsDto`.
  **An application outside the portal leaves it out.** Without it the kit's own accent is
  used and nothing is fetched: the provider looks as though it asks the portal for the
  palette, but the call it makes builds a request rather than sending one and its result is
  discarded. No network, no error, no accent override.

`ThemeProviderComponent` from `components/theme-provider` is the layer underneath, and it
expects a resolved theme object rather than a key. Mount `providers/theme`, never that one.
Never mount `providers/Providers` either: that is the portal's composed root, which pulls in
the REST client and fetches portal settings.

### TranslationProvider

From `@onlyoffice/apps-ui-kit/providers/translation`, also in the root barrel. Its
`translations` prop is a `Map<string, Map<string, Record<string, string>>>` — language, then
namespace, then the flat key/value table. The kit ships those tables in the package:
`@onlyoffice/apps-ui-kit/locales/en/Common.json` has 685 keys.

The provider builds an i18next instance of its own rather than touching the i18next
singleton, so an application already using i18next keeps its own configuration untouched.

**Without `translations` the provider renders its children and nothing else** — no i18next
context is installed. The kit's translated surfaces then come out blank, because the helper
behind them returns an empty string when it can find no instance, and the console gets one
line per key:

```
[i18n] Missing translation for key "Common:Copy". Ensure the TranslationProvider is mounted
or window.i18n.loaded contains the required namespaces [Common].
```

Empty toast titles, blank tile menus and an unlabelled back button in `Article` are all this
one cause.

## Fonts are not shipped

The kit sets `--font-family` on `<body>` to `Open Sans, sans-serif, Arial` and does not
provide the font. Either load Open Sans yourself or override the variable:

```css
:root {
  --font-family: Inter, system-ui, sans-serif;
}
```

## What the providers write on the document

The theme is applied through attributes and classes, not through a React context the
components read:

| Where | What |
|---|---|
| `<html>` | `data-theme="light"` or `"dark"`, `data-dir="ltr"` or `"rtl"`, `--interface-direction` |
| `<body>` | class `light` or `dark`, class `ltr` or `rtl`, `--font-family` |

Two consequences. A component rendered outside the provider is not merely unthemed — the
document carries no `data-theme` at all, and the variables its stylesheet reads resolve to
nothing. And a test that renders a component without the provider sees the light theme's
fallbacks, which is why the kit's own tests mount it.

## Vite and Next

- **Vite** — nothing to configure. Import SVGs of your own with `?url` or a plugin; the
  kit's own icons are already modules inside the package.
- **Next** — the kit's client modules carry `"use client"`, so they work in the app router
  as long as the providers are mounted in a client component. The theme is written in an
  effect, so a server-rendered first paint has no `data-theme`; render the shell on the
  client if that flash matters.
- Never import from `@onlyoffice/apps-ui-kit/dist/…`. The `exports` map is the public
  surface, and a path into the build output is not covered by it.

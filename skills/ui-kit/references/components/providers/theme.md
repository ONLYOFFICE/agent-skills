<!-- synced-from: docspace-ui-kit-react 4.0.0 providers/theme/README.md -->
<!-- do-not-edit: regenerate with `node tools/sync-ui-kit.mjs --from <kit> --write`; correct the text in the kit -->
<!-- body-sha256: eb59dc69aae2e5c191d3286b4249b4defeaa92269aae36cea5eb8737181e34ab -->

> Synced from the kit's own `providers/theme/README.md` at 4.0.0. Where this page and [SKILL.md](../../../SKILL.md) disagree, the skill's rule wins until the kit is corrected.

# ThemeProvider

Resolves the active theme (light, dark, or system) and applies it to the document through `ThemeProviderComponent`, which writes `data-theme` and `data-dir` on `<html>` and the `light`/`dark` and `ltr`/`rtl` classes on `<body>`. Components read it from there through custom properties, not from a React context.

## Props

| Prop           | Type                           | Required | Description                                                                            |
| -------------- | ------------------------------ | -------- | -------------------------------------------------------------------------------------- |
| `initialTheme` | `ThemeKeys`                    | No       | The initial theme (`BaseStr`, `DarkStr`, `SystemStr`)                                  |
| `systemTheme`  | `ThemeKeys`                    | No       | Override for the detected system theme                                                 |
| `colorTheme`   | `CustomColorThemesSettingsDto` | No       | The portal's custom accent palette. Left out, the kit's own accent is used — see below |
| `locale`       | `string`                       | No       | Locale for RTL detection and font family resolution                                    |
| `children`     | `React.ReactNode`              | Yes      | Child components that receive theming                                                  |

## Usage

```tsx
import { ThemeProvider } from "@onlyoffice/apps-ui-kit/providers/theme";
import { ThemeKeys } from "@onlyoffice/apps-ui-kit/enums";

<ThemeProvider initialTheme={ThemeKeys.BaseStr} locale="en">
  <App />
</ThemeProvider>;
```

## How it works

1. `useTheme` resolves the base theme (`Base` or `Dark`) from `initialTheme` / `systemTheme`
2. The accent palette comes from `colorTheme`, and only from there. Without it the kit's own
   accent stays: the fetch the code appears to make calls the API SDK's parameter builder,
   which returns request arguments rather than a response, so nothing is loaded and nothing
   fails. See [`docs/known-defects.md`](../_known-defects.md)
3. Font family and interface direction are determined from the `locale`
4. System theme changes are monitored via `matchMedia`

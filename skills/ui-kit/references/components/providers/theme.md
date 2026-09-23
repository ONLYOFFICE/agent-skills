<!-- synced-from: docspace-ui-kit-react 4.0.0 (fafb716c) providers/theme/README.md -->
<!-- do-not-edit: regenerate with `node tools/sync-ui-kit.mjs --from <kit> --write`; correct the text in the kit -->
<!-- body-sha256: dabcd2bec3b0e5d50fbeebda7a2758ab9fa6f0f804f9c82ad9b210c819a92aca -->

> Synced from the kit's own `providers/theme/README.md` at 4.0.0. Where this page and [SKILL.md](../../../SKILL.md) disagree, the skill's rule wins until the kit is corrected.

# ThemeProvider

Resolves the active theme (light, dark, or system) and provides it to child components through `ThemeProviderComponent` from styled-components.

## Props

| Prop           | Type                           | Required | Description                                           |
| -------------- | ------------------------------ | -------- | ----------------------------------------------------- |
| `initialTheme` | `ThemeKeys`                    | No       | The initial theme (`BaseStr`, `DarkStr`, `SystemStr`) |
| `systemTheme`  | `ThemeKeys`                    | No       | Override for the detected system theme                |
| `colorTheme`   | `CustomColorThemesSettingsDto` | No       | Color theme data; fetched from API if not provided    |
| `locale`       | `string`                       | No       | Locale for RTL detection and font family resolution   |
| `children`     | `React.ReactNode`              | Yes      | Child components that receive theming                 |

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
2. If `colorTheme` is not provided, it is fetched from the API
3. Font family and interface direction are determined from the `locale`
4. System theme changes are monitored via `matchMedia`

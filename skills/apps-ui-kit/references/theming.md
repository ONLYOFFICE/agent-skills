# Theming, dark mode and direction

The kit has no theme object you pass around and no styled components. Everything is CSS
custom properties, and the provider's whole job is to write two attributes and two classes on
the document. The provider's props, the `ThemeKeys` enum, the theme object and the colour
tokens are on the site's [Themes](https://api.onlyoffice.com/docspace/ui-kit/getting-started/themes.md)
page; this one is the mechanism, and what goes wrong with it.

## How the theme reaches a component

| Where | What `ThemeProvider` writes |
|---|---|
| `<html>` | `data-theme="light"` or `"dark"`, `data-dir="ltr"` or `"rtl"`, `--interface-direction` |
| `<body>` | class `light` or `dark`, class `ltr` or `rtl`, `--font-family` |

Each component's stylesheet declares its own variables under those classes — `Button.module.scss`
sets `--button-background-primary`, `--button-color-base` and two dozen more, once for light
and once for dark — and then uses them. So:

- A component rendered **outside** the provider is not merely unthemed: the document has no
  `light`/`dark` class at all, the component's variables are never declared, and every
  `var(--button-…)` in its stylesheet resolves to nothing.
- Switching the theme switches one class, and the CSS does the rest. `ThemeContext` updates as
  well, so a component that reads it re-renders — but a component that hard-codes a colour of
  its own keeps it.

Set the starting theme with `initialTheme` — `ThemeKeys.BaseStr` (light), `ThemeKeys.DarkStr`,
or `ThemeKeys.SystemStr` to follow the operating system. `System` keeps following it: the
provider subscribes to `prefers-color-scheme` and re-resolves when it changes.

## Overriding a colour

Two levels, and they behave differently.

**A component's own variables.** Every component page carries a *CSS variables* table with
the names it declares. Set one on the element or a class of your own and it wins inside that
subtree, because the component reads it with `var()`:

```tsx
import type { CSSProperties } from "react";
import { Button, ButtonSize } from "@onlyoffice/apps-ui-kit/components/button";

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      primary
      size={ButtonSize.normal}
      label="Delete"
      onClick={onClick}
      style={{ "--accent-button": "#f21c0e" } as CSSProperties}
    />
  );
}
```

**The button accent.** `--accent-button` is not declared by the kit anywhere — it is read with
a fallback (`var(--accent-button, #{$light-second-main})`) by `Button`, primary and tinted, and
by `Avatar`'s badge, and by nothing else. Set it on the element that should change and not on a
panel or a dialog — putting it on a dialog recolours every button inside it. The floating
button, the add button, the calendar's selection and `IconButton`'s hover read
`--color-scheme-main-accent` instead (below), so `--accent-button` leaves them as they were.

`--font-family` is set by the provider as an inline style on `<body>`, so a rule on `:root`
or `body` loses to it. Declare it on an element of your own inside the body — the app's
root — and everything below inherits that.

**The portal's palette.** `colorTheme` is a different mechanism: the provider writes
`--color-scheme-main-accent`, `--color-scheme-text-accent`, `--color-scheme-main-buttons` and
`--color-scheme-text-buttons` from it, and thirteen components read those. It is the portal's
per-tenant accent, and an application of its own has nothing to pass — leave it out and use
`--accent-button` for buttons. To recolour the components that read the palette instead,
declare `--color-scheme-main-accent` on an element above them.

## Checking dark mode

Render once in each theme. Two things go wrong and neither is visible in light:

- **Skeletons.** `RectangleSkeleton` and `CircleSkeleton` default to black at 10% and 15%
  opacity — fixed, not themed — so on a dark surface they nearly disappear. Declare the colour
  as a pair of your own under `.light` / `.dark` and pass the variable:
  `backgroundColor="var(--members-skeleton)"`. The props become the SVG stops' `stop-color`
  attribute, where a `var()` resolves against the page, so the skeleton switches with the
  theme. Do not pick a hex in JavaScript from a dark-mode flag: that is a second copy of the
  theme, and it is exactly the literal colour the next bullet warns about.
- **Anything of yours with a literal colour.** A `#fff` background in your own markup stays
  white under `.dark`. Use the kit's variables, or declare a pair of your own under
  `.light` / `.dark` the way the components do.

## Direction

`locale` on `ThemeProvider` decides it: Arabic, Hebrew and the rest resolve to RTL, everything
else to LTR. The provider writes `data-dir` and the `rtl` class, and the components' own
stylesheets do the rest — `ToggleButton`'s switch, for instance, is mirrored by a class rule
rather than by a prop.

Two caveats. `locale` here is the *document's* direction and font, not the language of the
labels; pass the same string to `TranslationProvider`. And the toast container is `rtl` in
every language — `react-toastify`'s flag is hard-coded on, so a toast's cross sits on the left
whatever the document says.

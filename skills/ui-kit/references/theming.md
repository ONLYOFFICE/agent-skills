# Theming, dark mode and direction

The kit has no theme object you pass around and no styled components. Everything is CSS
custom properties, and the provider's whole job is to write two attributes and two classes on
the document.

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
- Switching the theme is switching one class. Nothing re-renders, no context updates, and a
  component that hard-codes a colour of its own keeps it.

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

**The shared accent.** `--accent-button` is not declared by the kit anywhere — it is read with
a fallback (`var(--accent-button, #{$light-second-main})`) by everything that paints an accent:
primary buttons, the floating button, the add button, the calendar's selection, the avatar's
badge. Setting it recolours all of them at once, which is why it belongs on the element that
should change and not on a panel or a dialog — putting it on a dialog recolours the close
button too.

`--font-family` is the same kind of knob: declared by the provider on `<body>`, overridable on
`:root`.

**The portal's palette.** `colorTheme` is a different mechanism: the provider writes
`--color-scheme-main-accent`, `--color-scheme-text-accent`, `--color-scheme-main-buttons` and
`--color-scheme-text-buttons` from it, and thirteen components read those. It is the portal's
per-tenant accent, and an application of its own has nothing to pass — leave it out and use
`--accent-button`.

## Checking dark mode

Render once in each theme. Two things go wrong and neither is visible in light:

- **Skeletons.** `RectangleSkeleton` and `CircleSkeleton` default to black at 10% and 15%
  opacity — fixed, not themed — so on a dark surface they nearly disappear. Pass
  `backgroundColor` and `foregroundColor` when the surface is dark.
- **Anything of yours with a literal colour.** A `#fff` background in your own markup stays
  white under `.dark`. Use the kit's variables, or declare a pair of your own under
  `.light` / `.dark` the way the components do.

The toast container is the one place where the theme can be lost through no fault of yours:
it renders into `#root`, and an application whose root element has another id gets the toasts
on `document.body` — outside the element the class is written on.

## Direction

`locale` on `ThemeProvider` decides it: Arabic, Hebrew and the rest resolve to RTL, everything
else to LTR. The provider writes `data-dir` and the `rtl` class, and the components' own
stylesheets do the rest — `ToggleButton`'s switch, for instance, is mirrored by a class rule
rather than by a prop.

Two caveats. `locale` here is the *document's* direction and font, not the language of the
labels; pass the same string to `TranslationProvider`. And the toast container is `rtl` in
every language — `react-toastify`'s flag is hard-coded on, so a toast's cross sits on the left
whatever the document says.

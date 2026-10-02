# Setting the kit up in an application

**Read the kit's own `docs/getting-started.md` first.** It ships inside the package, and the
docs site carries it as
[Installation](https://api.onlyoffice.com/docspace/ui-kit/getting-started/installation.md).
It is the authority on installing the package, the four required peer dependencies, why no
stylesheet is imported, both providers with their props, the fonts, the import forms and the
public/portal-internal boundary.

This page is what that one does not say.

## Copy the two files

`$SKILL/templates/main` and `$SKILL/templates/providers` are the entry point and a composed
`AppProviders`, ready to drop into `src/`. The JSON import in the second one needs
`"resolveJsonModule": true` in `tsconfig.json` — the kit's page shows the same import without
mentioning the flag.

## The symptom, in the console

When `TranslationProvider` is missing — or mounted without `translations`, which installs no
i18next context at all and simply renders its children — the kit's labels come out as empty
strings and the console gets one line per key:

```
[i18n] Missing translation for key "Common:Copy". Ensure the TranslationProvider is mounted
or window.i18n.loaded contains the required namespaces [Common].
```

That message is how the symptom is recognised; [`i18n.md`](i18n.md) covers the rest.

## Vite, Next and the first paint

- **Vite** — nothing to configure. Import SVGs of your own with `?url` or a plugin; the kit's
  own icons are already modules inside the package.
- **Next** — most of the kit's modules do **not** carry `"use client"`: 59 of the 1231 in the
  built package do, and `Button`, `ModalDialog`, `TextInput`, `ComboBox` and both providers are
  not among them. Imported into a Server Component, a component that uses hooks fails the
  build. Render the kit only from files of your own marked `"use client"`, and mount the
  providers in one of them.
- **The theme is written in an effect**, not during render: `ThemeProviderComponent` sets
  `data-theme` on `<html>` and the `light`/`dark` class on `<body>` from `useEffect`. A
  server-rendered first paint therefore has no theme class and none of the components'
  variables are declared, which shows as an unstyled flash. Render the shell on the client
  when that matters.
- **Testing** needs the same two providers around the render, for the same reason —
  [`testing.md`](testing.md).

## What the providers write on the document

Worth having in one place, because it is what makes a component outside the provider
*unstyled* rather than merely untinted:

| Where | What |
|---|---|
| `<html>` | `data-theme="light"` or `"dark"`, `data-dir="ltr"` or `"rtl"`, `--interface-direction` |
| `<body>` | class `light` or `dark`, class `ltr` or `rtl`, `--font-family` |

Every component's stylesheet declares its own variables under those classes. No class, no
declarations, and every `var(--button-…)` in the component resolves to nothing.

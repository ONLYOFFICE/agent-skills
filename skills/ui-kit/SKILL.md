---
name: ui-kit
description: Build React 19 screens with the ONLYOFFICE UI kit (@onlyoffice/apps-ui-kit, successor of @docspace/ui-kit) in your own web app — forms, dialogs, side panels, lists, empty states, toasts, theming and translations. Use when someone wants their app to look like ONLYOFFICE DocSpace or Apps ("a dialog in the DocSpace style", "a settings form like the portal's", "use the DocSpace components in our admin") even if they never name the kit; when they ask which kit component fits a job or what a prop is called (visible vs isVisible vs isOpen vs open); when kit components render unstyled, with empty labels, an i18n console error, a collapsed toggle, a 1px textarea or doubled spacing; when an import from the kit does not resolve or pulls in portal-only modules (selectors, billing, uploader); or when reviewing code that uses the kit. Not for plugins inside the DocSpace portal (plugin-sdk), for embedding DocSpace in an iframe (embed-sdk), or for other component libraries.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
  sdk-version: "4.0.0"
---

# ONLYOFFICE UI kit

The component library ONLYOFFICE DocSpace and ONLYOFFICE Apps are built from, used from your
own React application. It is the same library the portal ships as `@docspace/ui-kit`; outside
the portal it is `@onlyoffice/apps-ui-kit`. It fails quietly: a wrong prop name is ignored, a
missing provider empties every label, and nothing is logged.

## Pinned facts

- `@onlyoffice/apps-ui-kit` **4.0.0**, ESM only, React 19. No registry carries it: it is
  installed from a tarball packed with **pnpm** (an npm-packed one has no `exports` at all).
- Four required peers: `react`, `react-dom`, `i18next` (^25.5.2), `react-i18next` (^15.7.3).
  Fifteen more are optional and belong to the portal-internal modules.
- **Each module imports its own CSS.** Nothing is imported by hand;
  `@onlyoffice/apps-ui-kit/styles.css` is the whole library, 727 KB, for builds that cannot
  follow those imports.
- 98 components, each with a README of its own inside the package. 89 are importable by name
  from the root barrel; nine are default exports and reach you only through their subpath.
- Two providers, both mounted by the application: `ThemeProvider` from `providers/theme` and
  `TranslationProvider` from `providers/translation`.

## Step 0 — find out what you are working against

1. Read `node_modules/@onlyoffice/apps-ui-kit/package.json` and compare its `version` with the
   4.0.0 above. Say in your answer which version you read.
2. Not installed? Ask how it is meant to be — there is no registry, so the answer decides the
   specifier.
3. A **DocSpace portal plugin** (`@onlyoffice/docspace-plugin-sdk` in `package.json`, or
   imports of `@docspace/ui-kit`) is a different job: stop and load the `plugin-sdk` skill. The
   portal's shim resolves one specifier per package and throws on a subpath import.
4. Prefer what the installed package says over what you remember: its own
   `components/<folder>/README.md`, and `dist/types/**/*.d.ts` for props.

## Which component for this job

| They want | Use | Not |
|---|---|---|
| A field in a form | `FieldContainer` `isVertical labelVisible` around the control | the control alone — no label is drawn |
| A confirmation | `ModalDialog` rendered conditionally, `visible` | mounting it always and toggling `visible` |
| A side panel | `Aside`, or `ModalDialog` with `displayType` aside | `Section`'s info panel, which is portal furniture |
| A choice from a short list | `ComboBox` | a native `<select>`, which is unstyled here |
| A search box | `SearchInput` — `onChange` gets the **string** | `TextInput`, whose `onChange` gets the event |
| On or off | `ToggleButton` in a wrapper with a height, or `Checkbox` | `ToggleButton` bare: it takes no space |
| A list of your own data | your own rows of `Text`/`Avatar` | `Rows`/`Tiles`, which are the portal's file list |
| A sortable, resizable table | `components/table` | `Rows` |
| A list is loading | `RectangleSkeleton` | `Loader` without a `type`, which draws nothing |
| Nothing to show | `EmptyView` | an empty `<div>` |
| A transient message | `toastr.*` plus one mounted `<Toast />` | `StatusMessage`, which stays |
| An icon action | `IconButton` with a URL in `iconName` | an icon name — there is no icon set by name |
| Picking from a long, fetched list | generic `Selector` in a `ModalDialog` | `selectors/*`, which are portal-internal |

## Where to read more

| Question | Read |
|---|---|
| Install, providers, CSS, fonts | [references/components/\_getting-started.md](references/components/_getting-started.md), then [references/setup.md](references/setup.md) for the templates, Vite/Next and SSR |
| Which component, and what is portal furniture | [references/choosing.md](references/choosing.md) |
| A form: fields, spacing, validation, submit | [references/forms.md](references/forms.md) |
| Dialogs, panels, menus, toasts | [references/overlays.md](references/overlays.md) |
| Loading, empty and paged lists | [references/lists-and-tables.md](references/lists-and-tables.md) |
| Dark mode, CSS variables, RTL | [references/theming.md](references/theming.md) |
| Translations and why labels are blank | [references/i18n.md](references/i18n.md) |
| Testing a screen built on it | [references/testing.md](references/testing.md) |
| Public versus portal-internal | [references/public-api.md](references/public-api.md) |
| A symptom with no error | [references/troubleshooting.md](references/troubleshooting.md) |
| One component in detail, faults in it included | [references/components/\<name\>.md](references/components/README.md) — synced from the kit |

The component pages are copies of the kit's own READMEs. Where one contradicts a rule below,
the rule wins and the kit's page is what should be corrected.

## Rules

1. **Do not import a stylesheet.** Every module brings its own CSS. Importing `styles.css`
   ships 727 KB of the library the application does not use; unstyled components mean the
   bundler is not following those imports, not that a stylesheet is missing.
2. **Mount both providers, from their own subpaths.** `ThemeProvider` from `providers/theme`,
   `TranslationProvider` from `providers/translation` with a
   `Map<lang, Map<namespace, table>>` built from `locales/en/Common.json` — the package ships
   `en` and nothing else, so every other language is the application's to supply. Leave
   `colorTheme` out: it is the portal's palette, and without it the kit's own accent is used —
   nothing is fetched. A provider given no `translations` installs no context at all.
3. **Never `providers/Providers`** (the portal's composed root: it reaches the REST API) and
   never mount `components/theme-provider` yourself (it expects a resolved theme object).
4. **The prop that shows and hides is per component.** `visible` — `ModalDialog`, `Aside`,
   `Backdrop`, `Portal`; `isOpen` — `Tooltip`, `HelpButton`, `LinkWithDropdown`,
   `CollapsibleCard`; `opened` — `ComboBox`, `ContextMenuButton`, `MainButtonMobile`; `open` —
   `DropDown`. Never guess `isVisible`: a wrong name is ignored and nothing appears.
5. **Portal-internal modules do not work outside the portal**: `selectors`, `billing`,
   `uploader`, `ai-agent`, `api`, `providers/api`, `document-editor`, `utils/socket`, and
   eleven components including `Section`, `Article`, `Navigation` and `Filter`. The root barrel
   re-exports `uploader` and `billing`, so those names reach you with no warning.
6. **Nine components are default exports** — `AppLoader`, `Article`, `Dropzone`, `Navigation`,
   `OperationsProgressButton`, `PublicRoomBar`, `QuantityPicker`, `RoomType`, `Section` —
   and `export *` does not carry a default, so they come from their subpath or not at all.
7. **`FieldContainer.labelVisible` defaults to `false`.** Without it `labelText` renders no
   label, no required marker, no help button, and reports nothing.
8. **`FieldContainer` carries its own `margin: 0 0 16px`.** A column with `gap: 16` spaces
   fields 32px apart, because the gap adds to the margin. Use no gap, or `removeMargin`.
9. **Name every field with `labelFor` and the control's `id`.** That pair is what makes the
   caption clickable and announces it with the field; `FieldContainer` alone captions nothing.
   A control with no visible caption takes `aria-label` instead, and `Textarea` takes
   `aria-label` or `aria-labelledby` as real props, because its props type is closed and
   `labelFor` cannot reach it. Do **not** add `tabIndex={0}` to make a control reachable —
   every control is in the tab order already, and `tabIndex` is for taking one out.
10. **`TextInput` requires `type` and `value`**, is 173px wide without `scale`, and its
    `onChange` receives the event. `SearchInput.onChange` receives the **string**, is debounced
    by a second, and its clear button does not call it at all.
11. **`ComboBox` selects nothing by itself**: `onSelect` reports, `selectedOption` is yours.
    It matches by label rather than key, and its list is 200px wide without `scaledOptions`.
12. **Three controls have no size of their own.** `ToggleButton` needs a wrapper with a height
    (it is absolutely positioned and overlaps the next row), `Textarea` needs `width: 100%`
    through `wrapperClassName` — a `style` you pass lands on its inner scroller, which is
    already full width, and never on the element that carries the max-width — and `Loader`
    needs an explicit `type` or it renders its label as text.
13. **`ModalDialog`: `visible` mounts nothing** — the body and its effects run while it is
    invisible, so render the dialog conditionally too. `Header`/`Body`/`Footer` must be direct
    children or they vanish. The footer is a flex row: give both buttons `scale` and wrap
    neither, or the wrapped one stops being an equal item.
14. **`toastr` needs one `<Toast />` mounted**, and its `timeout` is positional milliseconds
    where anything below 750 becomes 5000.
15. **Buttons**: one `primary` per screen, `ButtonSize.normal` in dialogs, `isLoading` around
    an `await`, footer order primary then cancel. There is no destructive variant — override
    `--accent-button` on the button itself, never on the dialog around it.
16. **No `PUBLIC_DIR`, no path into `dist/`.** `PUBLIC_DIR` is a DocSpace client alias. Icons
    come from `@onlyoffice/apps-ui-kit/assets/…` or your own SVG, and `IconButton.iconName` is
    a URL.

## Before handing over

- Say which version of the kit you read, and name any rule above that overrode a component
  page.
- Render once in the dark theme: skeletons are fixed-colour and literal colours of your own do
  not switch.
- Run `node $SKILL/scripts/check-usage.mjs <project>`: leave no errors, and no warning you
  cannot explain. The warnings are the silent half — a toggle that occupies no space, a field
  outside the tab order, a textarea that never fills its field — and every one of them renders
  without complaining. It reads the project as text and knows the kit from the synced
  manifest: wrong visibility props, portal-internal imports, a missing provider, the form
  traps that fail quietly.

## Not covered

Plugins that run inside the portal (`plugin-sdk`), embedding DocSpace in an iframe
(`embed-sdk`), the DocSpace REST API, and the portal-internal modules above.

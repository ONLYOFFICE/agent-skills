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
own React application: the portal's `@docspace/ui-kit`, published as `@onlyoffice/apps-ui-kit`.
It fails quietly: a wrong prop name is ignored, a missing provider empties every label, and
nothing is logged.

## Pinned facts

- `@onlyoffice/apps-ui-kit` **4.0.0** from npm, ESM only, React 19. Four required peers:
  `react`, `react-dom`, `i18next` (^25.5.2), `react-i18next` (^15.7.3); fifteen more are
  optional and belong to the portal-internal modules.
- **Each module imports its own CSS.** Nothing is imported by hand;
  `@onlyoffice/apps-ui-kit/styles.css` is the whole library, 727 KB, for builds that cannot
  follow those imports.
- 98 components, each with a README of its own inside the package; the root barrel carries
  every one by name, and still is not the way in — see rule 6. Two providers, both mounted by
  the application: `ThemeProvider` from `providers/theme`, `TranslationProvider` from
  `providers/translation`.

## Step 0 — find out what you are working against

1. Read `node_modules/@onlyoffice/apps-ui-kit/package.json` and compare its `version` with the
   4.0.0 above. Say in your answer which version you read.
2. Not installed? `npm install @onlyoffice/apps-ui-kit`, then read the version it brought.
3. A **DocSpace portal plugin** (`@onlyoffice/docspace-plugin-sdk` in `package.json`, or imports
   of `@docspace/ui-kit`) is the `plugin-sdk` skill's job: the portal decides how a plugin gets
   the kit, so load that skill — it says which rules below still hold in a plugin (most do).

## Sources, and which one wins

When two disagree, the higher one wins — say so instead of switching between them.

1. **The installed package.** `components/<folder>/README.md` is the component's own page,
   faults included; `docs/components.md` the catalogue — the close calls, and the prop that
   shows and hides each component; `docs/getting-started.md` and `docs/public-api.md` the setup
   and the public boundary; `dist/types/**/*.d.ts` the exact props. It describes the version the
   project builds against, so it wins on names, props and defaults.
2. **The docs site**, `https://api.onlyoffice.com/docspace/ui-kit/`: the same pages for the
   released kit, plus what the package has no page for — `getting-started/{hooks|utils|
   constants|themes|translation|structure}`. A component is under `ui/<group>/<slug>`
   (`ui/overlays/aside`, `ui/form-controls/text-input`); the site's `components/` section is
   the portal's composites — selectors, errors, providers — not these. Read a page as Markdown
   by appending `.md`, and look a component up in
   [`llms.txt`](https://api.onlyoffice.com/docspace/ui-kit/llms.txt), one line per page, rather
   than guessing its group. Skip the `import` lines and the `<ThemedImage>` and `<APITable>`
   tags: they are the site's own.
3. **This skill** — the rules below and the references: what happens when components are
   composed, and the failures that render without a word. Where a kit page and a rule
   disagree, the rule was checked against the source last: follow it and say so.

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
| A list is loading | `RectangleSkeleton` | `Loader` without a `type`, which prints its label as text |
| Nothing to show | `EmptyView` | an empty `<div>` |
| A transient message | `toastr.*` plus one mounted `<Toast />` | `StatusMessage`, which stays |
| An icon action | `IconButton` with the icon as JSX in `iconNode`, or a URL in `iconName` | an icon name, or a kit asset in `iconName` |
| Picking from a long, fetched list | generic `Selector` in a `ModalDialog` | `selectors/*`, which are portal-internal |

## Where to read more

| Question | Read |
|---|---|
| Install, providers, CSS, fonts | the package's `docs/getting-started.md` ([Installation](https://api.onlyoffice.com/docspace/ui-kit/getting-started/installation.md) on the site), then [references/setup.md](references/setup.md) for the templates, Vite/Next and SSR |
| Which component, and what is portal furniture | [references/choosing.md](references/choosing.md) |
| A form: fields, spacing, validation, submit | [references/forms.md](references/forms.md) |
| Dialogs, panels, menus, toasts | [references/overlays.md](references/overlays.md) |
| Loading, empty and paged lists | [references/lists-and-tables.md](references/lists-and-tables.md) |
| Dark mode, CSS variables, RTL | [references/theming.md](references/theming.md); the theme object and the tokens on [Themes](https://api.onlyoffice.com/docspace/ui-kit/getting-started/themes.md) |
| Translations and why labels are blank | [references/i18n.md](references/i18n.md); the provider's props on [Translation](https://api.onlyoffice.com/docspace/ui-kit/getting-started/translation.md) |
| Hooks, utils, constants and enums | [Hooks](https://api.onlyoffice.com/docspace/ui-kit/getting-started/hooks.md), [Utils](https://api.onlyoffice.com/docspace/ui-kit/getting-started/utils.md) and [Constants](https://api.onlyoffice.com/docspace/ui-kit/getting-started/constants.md) on the site — the package carries no page for them |
| Testing a screen built on it | [references/testing.md](references/testing.md) |
| Public versus portal-internal | [references/public-api.md](references/public-api.md) |
| A symptom with no error | [references/troubleshooting.md](references/troubleshooting.md) |
| One component in detail, faults in it included | its `README.md` in the package, or its `ui/<group>/<slug>.md` page on the site — find it in `llms.txt` |

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
6. **Import from the subpath, not the root barrel.** The barrel also re-exports `billing` and
   `uploader`, which import `mobx`, `mobx-react`, `react-router` and `axios` — optional peers
   an application of its own does not install — and a bundler resolves them before it drops
   what is unused, so `import { Button } from "@onlyoffice/apps-ui-kit"` fails the build. Nine
   components are default exports on their subpath (`import Section from "…/components/section"`),
   and a named import there resolves to nothing.
7. **`FieldContainer.labelVisible` defaults to `false`.** Without it `labelText` renders no
   label, no required marker, no help button, and reports nothing.
8. **`FieldContainer` carries its own `margin: 0 0 16px`.** A column with `gap: 16` spaces
   fields 32px apart, because the gap adds to the margin. Use no gap, or `removeMargin`.
9. **Name every field with `labelFor` and the control's `id`.** That pair is what makes the
   caption clickable and announces it with the field; `FieldContainer` alone captions nothing.
   The pair works for `TextInput`-based fields and `Textarea` only: `ComboBox` and
   `RadioButtonGroup` put `id` on a `<div>`, `ToggleButton` on a `<div>` and a `<label>`,
   `Checkbox` on its wrapping `<label>` — `<label for>` reaches none of them. Caption
   `ToggleButton` and `Checkbox` with their own `label` prop.
   A control with no visible caption takes `aria-label` instead — `Textarea` among them, whose
   props type is closed, so the three `aria-*` it accepts are props of its own rather than
   attributes you can pass. Do **not** add `tabIndex={0}` to make a control reachable —
   every control is in the tab order already, and `tabIndex` is for taking one out. The
   exceptions are `InputBlock`, which still defaults to `-1`, and `SearchInput` and
   `PasswordInput`, built on it: pass `tabIndex={0}` to those three. `SearchInput` also cannot be captioned
   by `labelFor` — its `id` lands on the wrapper as well as the input.
10. **`TextInput` requires `type` and `value`**, is 173px wide without `scale`, and its
    `onChange` receives the event. `SearchInput.onChange` receives the **string**, is debounced
    by a second, and its clear button does not call it at all.
11. **`ComboBox` selects nothing by itself**: `onSelect` reports, `selectedOption` is yours.
    It matches by label rather than key, and its list is 200px wide without `scaledOptions`.
12. **Three controls size themselves unexpectedly.** `ToggleButton` needs a wrapper with a
    height (it is absolutely positioned and overlaps the next row). `Textarea` fills the field
    it is in; a width of your own goes through `wrapperClassName` — a `style` lands on its
    inner scroller, which is already full width — and in a `FormWrapper` or a flex row it is
    the `FieldContainer` that shrinks, so give the container the width. `Loader` needs an
    explicit `type` or it renders its label as text.
13. **`ModalDialog`: `visible` mounts nothing** — the body and its effects run while it is
    invisible, so render the dialog conditionally too. `Header`/`Body`/`Footer` must be direct
    children or they vanish. The footer is a flex row: give both buttons `scale` and wrap
    neither, or the wrapped one stops being an equal item.
14. **`toastr` needs one `<Toast />` mounted**, and its `timeout` is positional milliseconds
    where `0` means the toast never closes and anything else below 750 becomes 5000.
15. **Buttons**: one `primary` per screen, `ButtonSize.normal` in dialogs, `isLoading` around
    an `await`, footer order primary then cancel. There is no destructive variant — override
    `--accent-button` on the button itself, never on the dialog around it.
16. **No `PUBLIC_DIR`, no path into `dist/`.** `PUBLIC_DIR` is a DocSpace client alias. Icons
    come from `@onlyoffice/apps-ui-kit/assets/…` or your own SVG. The kit's assets are React
    components, not URLs: `iconNode={<CrossIcon />}`. `IconButton.iconName` takes a URL only —
    a kit asset there type-checks against Vite's `*.svg` declaration and renders nothing.

## Before handing over

- Say which version of the kit you read, and name any rule above that overrode a component
  page.
- Render once in the dark theme: skeletons are fixed-colour and literal colours of your own do
  not switch.
- Run `node $SKILL/scripts/check-usage.mjs <project>` — on an application, not a DocSpace
  plugin, where it reports the portal's providers as missing: leave no errors, and no warning you
  cannot explain. The warnings are the silent half — a toggle that occupies no space, a caption
  attached to no control, a textarea that never fills its field — and every one of them renders
  without complaining. It reads the project as text and knows the kit from a manifest derived
  from the kit's own metadata: wrong visibility props, portal-internal imports, a missing
  provider, the form traps that fail quietly.

## Not covered

Plugins that run inside the portal (`plugin-sdk`), embedding DocSpace in an iframe
(`embed-sdk`), the DocSpace REST API, and the portal-internal modules above.

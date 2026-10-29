# Building UI with `@onlyoffice/apps-ui-kit`

The portal's own component library: it reads theme, accent and direction from contexts the portal fills, so a kit `Button` is the portal's button in either theme. Reach for the kit first — it is the first of the three sources of style a plugin has, and the only one that follows a re-theme on its own ([styles.md](styles.md#where-a-style-can-come-from)). Colors, the portal's measurements and how a stylesheet gets scoped are there too.

**The kit's own documentation holds inside a plugin** — everywhere except the rows of [the table below](#what-a-plugin-does-differently). Three places carry it; read the first two before writing a surface:

- **the installed package** — `node_modules/@onlyoffice/apps-ui-kit/components/<folder>/README.md` for one component, with `docs/getting-started.md` and `docs/components.md` beside them for the whole kit: the kit's own text, faults included, for exactly the version the project builds against;
- **the [UI kit docs](https://api.onlyoffice.com/docspace/ui-kit/llms.txt)** — the same pages for the released kit, one per component under `ui/<group>/<slug>` (read as Markdown with `.md` appended), plus the hooks, utils, constants and theming pages the package has no page for; the one source when the kit is not installed yet;
- **the `apps-ui-kit` skill** — load it by name (`onlyoffice:apps-ui-kit` in the plugin both ship in). Its rules are the failures that render without a word, and its routing table leads to forms, overlays, lists and a symptom index. Installed without it, the package's pages are all there is.

Their examples import from subpaths and mount providers; translate them by the table below. Of those rules, the browser pass measures the ones that show in a box — a collapsed control, a toggle over the next row, a field with no label ([build.md → See it](build.md#7-see-it--the-step-that-catches-what-looks-broken)); the rest are yours to get right. What stays in **this** file is what a plugin does differently, and what the kit's documentation leaves out for a plugin.

**The styles ship too, and they are where layout surprises are answered.** The kit is ESM-only: `dist/esm/components/<name>/<Name>.module.scss/index.js` holds the class-name map and imports `index.css` beside it, and that CSS file is the component's real stylesheet. When a control collapses, overflows, or draws somewhere you did not put it, read that file before theorising: a `position: absolute` on a label or a `display: inline-block` on a wrapper explains the behaviour that no prop does. It is worth one look **before** writing a surface too, not only after it looks wrong — the rules and the trap list below are the components where that look has already been taken, not the extent of the problem. The same goes for what the kit does *not* contain — check the package rather than assuming a component exists or does not.

Contents: [What a plugin does differently](#what-a-plugin-does-differently) · [Layout conventions](#layout-conventions) · [Behavioural traps](#behavioural-traps) · [Icons and assets](#icons-and-assets)

## What a plugin does differently

| The kit's documentation says | In a plugin |
|---|---|
| Import from the subpath, not the root barrel (`apps-ui-kit` rule 6) — every example does | From `@onlyoffice/apps-ui-kit` only: the portal hands a plugin the root barrel of its own copy and refuses a subpath at load, the kit's icons under `assets/` included ([below](#icons-and-assets)). The barrel carries every component by name, the nine default exports too (`export { default as Section }`), and with the kit external its `billing` and `uploader` imports never reach the plugin's build — the reason rule 6 exists. Never bundle the kit: it and its stylesheets are the portal's ([bundling.md](bundling.md)) |
| Mount `ThemeProvider` and `TranslationProvider` | Mount neither — the portal's tree has both, and the kit a plugin imports is the portal's own copy. A `ThemeProvider` of yours writes its theme class, direction and font onto the portal's `<html>` and `<body>`, and nothing puts them back; a `TranslationProvider` overwrites the portal's strings in the kit's one i18n instance. Without either, the kit renders in the portal's theme and language |
| A `ModalDialog` or `Aside`, rendered conditionally | `showModal` from `usePluginActions()`: the portal draws it, sizes it and keeps one open at a time ([modal-dialog.md](components/modal-dialog.md)) |
| `toastr` with one mounted `<Toast />` | `showToast` from `usePluginActions()` |
| The generic `Selector` in a `ModalDialog`; the ready-made pickers are portal-internal | The SDK's selector — files, rooms, people, groups, or a list of your own ([selector.md](components/selector.md)) |
| Portal-internal modules and components do not work outside the portal | Inside it the barrel carries some of them — the `uploader` and `billing` names, and all eleven portal-internal components (`apps-ui-kit` rule 5; each one's README says so in its metadata) — and the kit promises nothing about them: they may change or move in any release, and with the barrel as a plugin's whole API that change breaks the plugin with no compile error anywhere |
| Before handing over, run `check-usage.mjs` (the `apps-ui-kit` skill's last step) | Not on a plugin. It checks an application of its own, so on a plugin it reports the two things this table tells you to do — no `ThemeProvider` mounted (`E-no-theme-provider`), imports from the root barrel (`W-root-barrel`) — and its fix for the first is the one the provider row forbids. `validate-plugin.mjs` is the plugin's check |
| `ButtonSize` from the kit | The SDK exports a `ButtonSize` too — the kit's is for the kit's `Button`, the SDK's for the `ButtonGroup` passed to `setSaveButton`. Alias one when both meet in a file (`import { ButtonSize as SdkButtonSize } from "@onlyoffice/docspace-plugin-sdk"`) |

## Layout conventions

**Markup handed to a kit component lands in a box you do not own.** Anything passed in as `children`, as a `content` / `body` prop, or as a component the kit renders for you is wrapped in an element of the component's own making, and most of those wrappers are flex boxes centred on the cross axis — the kit lays out its own parts that way, and your markup inherits the box. So hand over **one** element and put the layout on it yourself (`width: 100%`, `min-width: 0`, the direction you actually meant). Several children — a fragment, an array, a bare list of blocks — become flex items side by side, vertically centred, and any `flex-wrap` inside them then breaks each control onto its own line: a page's worth of blocks arranged as a row of columns, which reads as a broken stylesheet and is not one. Nothing catches this; the render pass does not apply the portal's CSS, and the surface looks correct in every check.

**And several kit components bring their own outer margin.** Your `gap` does not replace it, it adds to it — so before spacing a stack yourself, check whether the parts already space themselves (`grep margin` in the component's `.module.scss/index.css`) and pick one of the two. Doubled spacing is the quieter half of this failure: nothing overlaps, nothing overflows, the surface just drifts apart with empty bands in it.

The mirror image is props that sound like they size a control: `scale`, `scaled…` and `size` describe it against **its container**, never against its own content, so a label longer than the control is clipped rather than accommodated — a width of your own is the fix.

The portal's type scale, spacing and surface widths are in [styles.md](styles.md#conventions). Give the root and every control an `id` — plugin markup carries no test ids.

## Behavioural traps

The kit's own defaults are in the `apps-ui-kit` rules and the components' READMEs; these are what they leave out for a plugin:

- **`ToggleButton`** takes no width either, not only the height its `apps-ui-kit` rule is about: across a flex row it is shrunk to the switch alone and the label spills out of the row, off the section and into a horizontal scrollbar on the whole page; down the settings aside the label draws over the aside's metadata block. So the wrapper supplies both — `<div style={{ position: "relative", height: 20, display: "flex", alignItems: "center", flex: "0 0 auto" }}>` and, in a row, a width wide enough for the label. Keep the label to one line; a caption that wraps belongs on `Checkbox`, whose label is in normal flow.
- **Read-only is the same control, disabled.** When the viewer may read but not write, keep the editor's control and pass it `isReadOnly` or `isDisabled` rather than swapping it for a `Text`: a field greyed out says the value is editable by someone, plain text cannot be told from a bug, and the two branches drift apart as the editor gains fields.
- **`IconButton`** is what fits the 32×32 sidebar slot: `size={32}` and `iconNode={<svg …/>}` (inline JSX — simplest), or `iconName` as a URL.
- **A running row's spinner** is a `Loader` with an explicit `type` — `LoaderTypes.oval`, `dualRing` or `track` — `size="16px"` and `color="var(--accent-main)"`: the default stroke is the pale `--loader-color`.
- **`Row` / `RowContent` / `RowContainer`** are the portal's file list, and their READMEs say how they read their children. Inside the portal `RowContainer` virtualises through the portal's own `#sectionScroll`: for items of your own pass `useReactWindow={false}`, or skip these for plain rows of `Checkbox`/`Text`.

## Icons and assets

Two mechanisms: **item icons** (`icon`, `fileRowIcon`) are asset **file names** — `"icon-16.svg"` — resolved against the plugin's `assets/` and recolored for menus, but only shapes with an explicit `fill`/`stroke` **attribute** are repainted, so ship monochrome SVGs with `fill` on every shape. **Inside a component** nothing is resolved: use an inline SVG, or the plugin's base URL, which the portal sets on the exported object after load — `${plugin.iconUrl}/assets/logo.svg` (not declared by the SDK; read through a cast). The logo's size is in [portal.md → Limits](portal.md#limits), each item icon's on its interface's docs page, linked from the scope's page.

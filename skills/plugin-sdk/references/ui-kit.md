# Building UI with `@docspace/ui-kit`

The portal's own component library: it reads theme, accent and direction from contexts the portal fills, so a kit `Button` is the portal's button in either theme. Reach for the kit first, plain `div`s with inline styles for layout, a stylesheet where inline styles cannot reach — `:hover`, keyframes, media queries, generated markup — as long as every selector is scoped ([react.md → Scoped CSS](react.md#scoped-css)). Raw HTML controls never: an unstyled `<button>` or `<input>` is the one thing that immediately looks foreign.

**Props are documented in the package itself**, one JSDoc line per prop: `node_modules/@docspace/ui-kit/dist/types/components/<name>/<Name>.types.d.ts` (enums in `<Name>.enums.d.ts`). Read those rather than guessing or casting; this file only records what the types cannot tell you.

**The styles ship too, and they are where layout surprises are answered.** `dist/cjs/components/<name>/<Name>.module.scss.js` carries the component's real CSS, inlined as a string next to its class-name map. When a control collapses, overflows, or draws somewhere you did not put it, read that file before theorising: a `position: absolute` on a label or a `display: inline-block` on a wrapper explains the behaviour that no prop does. The same goes for what the kit does *not* contain — check the package rather than assuming a component exists or does not.

## Imports and enums

Import from the barrel only — `@docspace/ui-kit/components/button` is refused by the portal at load. Never bundle the kit ([react.md → Bundling](react.md#bundling)).

`ButtonSize` exists in **both** the kit and the SDK: the kit's is for the kit's `Button`, the SDK's for the `ButtonGroup` passed to `setSaveButton`. Alias one when both appear in a file (`import { ButtonSize as SdkButtonSize } from "@onlyoffice/docspace-plugin-sdk"`).

Toasts and dialogs are not kit components for a plugin: `showToast`/`showModal` from `usePluginActions()`, so the portal draws them and keeps one dialog open at a time.

## Layout conventions

- Typography inherits Open Sans **13px / 400**; secondary lines 12px; emphasis `fontWeight={600}` (700 is headings). Headings come from `Heading` (`level` = tag, `size` = look; an `h1` at `medium` is the usual page title).
- 16px outer padding in dialogs and panels, 8–12px between controls, 20px page padding on a section page. Radius 3px on controls, 6px on dialogs. Literal px is normal — there are no spacing tokens.
- Widths: info panel body ≈ 337px; modal 400px (280px tall unless `autoMaxHeight`); aside 480px; section page — full width, cap text at ~640px.
- Buttons in a row: primary first, then secondary, 8px apart, both `scale` to split the width. `ButtonSize.normal` (40px) in dialogs and pages, `small` (32px) in dense rows. One `primary` per view.
- Give the root and controls an `id` — plugin markup carries no test ids.

## Colors

For anything you color yourself, use the portal's CSS variables — they flip with the theme and follow a re-branded accent. A hardcoded hex breaks in the other theme.

| Variable | Use for |
|---|---|
| `--text-color` / `--text-disable-color` | primary / muted text |
| `--accent-main` | accent (never hardcode `#4781d1` — admins re-brand it) |
| `--background-color` / `--background-service-color` | main surface / secondary panel |
| `--border-service-color` | **the** divider and border color |
| `--input-error-color` | error text and borders |
| `--status-icon-color-positive` / `--status-warning` | success / warning |

Traps: `--error-color`, `--success-color` and `--border-color` **do not exist** (an invalid `var()` silently inherits); `--warning-color` exists but resolves to the error red.

**A kit `color` prop is a CSS value, not a token** — with one exception. `Text` puts `color` straight into the element's inline `style`, so `color="accent"` is invalid CSS and the text silently inherits whatever colour surrounds it: pass `color="var(--accent-main)"`. `Link` is the exception — it maps the literal `"accent"` to `var(--accent-main)` itself, so both spellings work there. When a kit prop takes a colour and its `.d.ts` says `string`, assume the value reaches `style` unchanged and give it a real CSS value; the component's `.module.scss.js` settles it in one look.

When the theme is needed as a **fact** — a whole palette for generated markup, an asset in two versions, a canvas — `useTheme()` from the kit returns `{ theme, isBase, currentColorScheme }`; `isBase` (`true` = light) is already resolved, there is no `prefers-color-scheme` to consult.

## Behavioural traps

Defaults and layout facts the `.d.ts` does not state:

- **`FieldContainer`**: `labelVisible` defaults to **`false`** and the whole label block is behind it — `labelText` alone renders no label. Use `isVertical labelVisible` in asides and pages.
- **`ToggleButton`** has no intrinsic size in **either** axis — inline-block wrapper, and the label is `position: absolute`, so it contributes nothing to the control's width or height. Down a flex column it collapses and the label draws over the next row, or over the settings aside's metadata block; across a flex row it is shrunk to the switch alone (its min-content width) and the label spills out of the row, off the section and into a horizontal scrollbar on the whole page. So the wrapper has to supply both: `<div style={{ position: "relative", height: 20, display: "flex", alignItems: "center", flex: "0 0 auto" }}>` and, in a row, a width wide enough for the label. Keep the label to one line; a caption that wraps belongs on `Checkbox`, whose label is in normal flow.
- **`Textarea`** has a `max-width` but no `width`: as a flex item it shrinks to ~1px yet stays focusable — the panel looks empty and swallows typing. Give it `flex: 1 1 auto; width: 100%; min-width: 0`.
- **`TextInput`**: `type` and `value` are required; without `scale` the `base` size is 173px wide; `maxLength` defaults to 255. `onChange` receives the event (`e.target.value`) — **except `SearchInput`, whose `onChange` receives the string.**
- **`Checkbox.onChange` still fires when `isDisabled`** — guard it.
- **`ComboBox`** matches the selected row by **label**, not key — keep labels unique; `scaledOptions` makes the list match the control (else 200px), `dropDownMaxHeight` past ~6 options.
- **`Button.isLoading`** swaps the label for a spinner and blocks clicks — set it yourself around an `await`. Labels never wrap.
- **`IconButton`** is what fits the 32×32 sidebar slot: `size={32}`, `iconNode={<svg …/>}` (inline JSX — simplest) or `iconName` as a **URL**, not an asset name.
- **`Link`**: ellipsis needs `truncate`, not `isTextOverflow`; `LinkType.action` for handlers, `LinkType.page` for navigation.
- **Loading**: `RectangleSkeleton` (`width`/`height` CSS strings) while an effect fetches; `Loader` for an inline spinner.
- **Empty states** are `EmptyView` or `EmptyScreenContainer`. `EmptyView` places itself: `margin-inline: auto`, a 480px cap and 61px of top padding of its own, all overridable through `--empty-view-width` / `--empty-view-padding-top`. Wrapping it in padding or centring of your own fights those defaults instead of setting them.

## Icons and assets

Two mechanisms: **item icons** (`icon`, `fileRowIcon`) are asset **file names** — `"icon-16.svg"` — resolved against the plugin's `assets/` and recolored for menus, but only shapes with an explicit `fill`/`stroke` **attribute** are repainted, so ship monochrome SVGs with `fill` on every shape. **Inside a component** nothing is resolved: use an inline SVG, or the plugin's base URL, which the portal sets on the exported object after load — `${plugin.iconUrl}/assets/logo.svg` (not declared by the SDK; read through a cast). Sizes are in [portal.md → Limits](portal.md#limits).

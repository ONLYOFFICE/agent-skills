# Building UI with `@docspace/ui-kit`

The portal's own component library: it reads theme, accent and direction from contexts the portal fills, so a kit `Button` is the portal's button in either theme. Reach for the kit first, plain `div`s with inline styles for layout, a stylesheet where inline styles cannot reach — `:hover`, keyframes, media queries, generated markup — as long as every selector is scoped ([react.md → Scoped CSS](react.md#scoped-css)). Raw HTML controls never: an unstyled `<button>` or `<input>` is the one thing that immediately looks foreign.

**Props are documented in the package itself**, one JSDoc line per prop: `node_modules/@docspace/ui-kit/dist/types/components/<name>/<Name>.types.d.ts` (enums in `<Name>.enums.d.ts`). Read those rather than guessing or casting; this file only records what the types cannot tell you.

**The styles ship too, and they are where layout surprises are answered.** `dist/cjs/components/<name>/<Name>.module.scss.js` carries the component's real CSS, inlined as a string next to its class-name map. When a control collapses, overflows, or draws somewhere you did not put it, read that file before theorising: a `position: absolute` on a label or a `display: inline-block` on a wrapper explains the behaviour that no prop does. It is worth one look **before** writing a surface too, not only after it looks wrong — the trap list below is the handful of components where that look has already been taken, not the extent of the problem. The same goes for what the kit does *not* contain — check the package rather than assuming a component exists or does not.

## Imports and enums

Import from the barrel only — `@docspace/ui-kit/components/button` is refused by the portal at load. Never bundle the kit ([react.md → Bundling](react.md#bundling)).

`ButtonSize` exists in **both** the kit and the SDK: the kit's is for the kit's `Button`, the SDK's for the `ButtonGroup` passed to `setSaveButton`. Alias one when both appear in a file (`import { ButtonSize as SdkButtonSize } from "@onlyoffice/docspace-plugin-sdk"`).

Toasts and dialogs are not kit components for a plugin: `showToast`/`showModal` from `usePluginActions()`, so the portal draws them and keeps one dialog open at a time.

## Layout conventions

**Markup handed to a kit component lands in a box you do not own.** Anything passed in as `children`, as a `content` / `body` prop, or as a component the kit renders for you is wrapped in an element of the component's own making, and most of those wrappers are flex boxes centred on the cross axis — the kit lays out its own parts that way, and your markup inherits the box. So hand over **one** element and put the layout on it yourself (`width: 100%`, `min-width: 0`, the direction you actually meant). Several children — a fragment, an array, a bare list of blocks — become flex items side by side, vertically centred, and any `flex-wrap` inside them then breaks each control onto its own line: a page's worth of blocks arranged as a row of columns, which reads as a broken stylesheet and is not one. Nothing catches this; the render pass does not apply the portal's CSS, and the surface looks correct in every check.

**And several kit components bring their own outer margin.** Your `gap` does not replace it, it adds to it — so before spacing a stack yourself, check whether the parts already space themselves (`grep margin` in the component's `.module.scss.js`) and pick one of the two. Doubled spacing is the quieter half of this failure: nothing overlaps, nothing overflows, the surface just drifts apart with empty bands in it.

The mirror image is props that sound like they size a control: `scale`, `scaled…` and `size` describe it against **its container**, never against its own content, so a label longer than the control is clipped rather than accommodated — a width of your own is the fix.

- Typography inherits Open Sans **13px / 400**; secondary lines 12px; emphasis `fontWeight={600}` (700 is headings). Headings come from `Heading` (`level` = tag, `size` = look; an `h1` at `medium` is the usual page title).
- 16px outer padding in dialogs and panels, 8–12px between controls, 20px page padding on a section page. Radius 3px on controls, 6px on dialogs. Literal px is normal — there are no spacing tokens.
- Widths to lay out against: info panel body ≈ 337px; modal 400px; aside 480px; section page — full width, cap text at ~640px. What a modal will and will not grow to is in [react.md → Modals](react.md#modals).
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

- **`FieldContainer`**: `labelVisible` defaults to **`false`** and the whole label block is behind it — `labelText` alone renders no label. Use `isVertical labelVisible` in asides and pages. It also carries **its own `margin: 0 0 16px`**, so a form that is a flex column with `gap: 16` spaces its fields 32px apart and reads as a band of empty space under each one: either drop the `gap` and let the fields space themselves, or pass `removeMargin` and own the spacing. The error line is separate — it appears only with `hasError`, so a field does not reserve room for a message it is not showing.
- **`ToggleButton`** has no intrinsic size in **either** axis — inline-block wrapper, and the label is `position: absolute`, so it contributes nothing to the control's width or height. Down a flex column it collapses and the label draws over the next row, or over the settings aside's metadata block; across a flex row it is shrunk to the switch alone (its min-content width) and the label spills out of the row, off the section and into a horizontal scrollbar on the whole page. So the wrapper has to supply both: `<div style={{ position: "relative", height: 20, display: "flex", alignItems: "center", flex: "0 0 auto" }}>` and, in a row, a width wide enough for the label. Keep the label to one line; a caption that wraps belongs on `Checkbox`, whose label is in normal flow.
- **`Textarea`** has a `max-width` but no `width`: as a flex item it shrinks to ~1px yet stays focusable — the panel looks empty and swallows typing. Give it `flex: 1 1 auto; width: 100%; min-width: 0`.
- **`TextInput`**: `type` and `value` are required; without `scale` the `base` size is 173px wide; `maxLength` defaults to 255. `onChange` receives the event (`e.target.value`) — **except `SearchInput`, whose `onChange` receives the string.**
- **Read-only is a prop, not a missing editor.** `Textarea` and `TextInput` carry `isDisabled` and `isReadOnly`; `Button` and the rest carry `isDisabled`. When the viewer may read but not write, render the same control disabled rather than swapping it for a `Text` — a reader who sees the field greyed out knows the value is editable by someone, while a reader who sees plain text cannot tell the feature from a bug, and the two branches drift apart as the editor gains fields.
- **`ComboBox`** matches the selected row by **label**, not key — keep labels unique; `scaledOptions` makes the list match the control's own width, which clips the options of a narrow control (without it the list is `manualWidth`, 200px by default), `dropDownMaxHeight` past ~6 options.
- **`Button.isLoading`** swaps the label for a spinner and blocks clicks — set it yourself around an `await`. Labels never wrap.
- **`IconButton`** is what fits the 32×32 sidebar slot: `size={32}`, `iconNode={<svg …/>}` (inline JSX — simplest) or `iconName` as a **URL**, not an asset name.
- **`Link`**: ellipsis needs `truncate`, not `isTextOverflow`; `LinkType.action` for handlers, `LinkType.page` for navigation.
- **Loading**: `RectangleSkeleton` (`width`/`height` CSS strings) while an effect fetches; `Loader` for an inline spinner.
- **`Row` / `RowContent` / `RowContainer` are the portal's file list, not a generic one.** `RowContent` takes an **array** of children and reads it by index — `[0]` the main cell, `[1]` badges, `[2…]` side cells, which the kit hides (`display: none`) and reprints as one right-hand line joined with `" | "`. So it is not a column layout, and one child or a fragment throws. `Row` builds its context-menu header from `children.props.item` — a portal entity (`icon`, `avatar`, `title`, `logo`) — and shows a checkbox only if the `checked` prop is present at all. `RowContainer` virtualises by default, through the portal's `#sectionScroll` and a width measured off the literal element id `rowContainer`: an `id` of your own makes it 0px wide. For synthetic items pass `useReactWindow={false}`, or skip these for plain rows with `Checkbox`/`Text`.
- **Empty states** are `EmptyView` or `EmptyScreenContainer`. `EmptyView` places itself: `margin-inline: auto`, a 480px cap and 61px of top padding of its own, all overridable through `--empty-view-width` / `--empty-view-padding-top`. Wrapping it in padding or centring of your own fights those defaults instead of setting them.

## Icons and assets

Two mechanisms: **item icons** (`icon`, `fileRowIcon`) are asset **file names** — `"icon-16.svg"` — resolved against the plugin's `assets/` and recolored for menus, but only shapes with an explicit `fill`/`stroke` **attribute** are repainted, so ship monochrome SVGs with `fill` on every shape. **Inside a component** nothing is resolved: use an inline SVG, or the plugin's base URL, which the portal sets on the exported object after load — `${plugin.iconUrl}/assets/logo.svg` (not declared by the SDK; read through a cast). Sizes are in [portal.md → Limits](portal.md#limits).

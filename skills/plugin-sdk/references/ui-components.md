# Building UI

A plugin never renders anything itself. It returns a **description** of a UI, and the portal renders it with its own React components. There is no DOM, no React and no CSS-in-JS in your bundle — which is also why the UI automatically matches the portal's theme.

Everything here is verified against the DocSpace client this skill targets and the ui-kit revision it ships. Where the SDK's types and the host's behaviour disagree, both are stated — the type decides what compiles, the host decides what renders.

Contents:

- [How the host renders your tree](#how-the-host-renders-your-tree)
- [The portal's visual language](#the-portals-visual-language) — typography, spacing, theme tokens, icons
- [Component reference](#component-reference) — per-component props, defaults, pixel sizes, traps
- [Modals and asides](#modals-and-asides)
- [Toasts](#toasts)
- [Selectors](#selectors)
- [The create-file dialog](#the-create-file-dialog)
- [Media viewer](#media-viewer)
- [The floating operations button](#the-floating-operations-button)
- [Updating a live panel](#updating-a-live-panel)
- [Async content and `onLoad`](#async-content-and-onload)

## How the host renders your tree

Every node is a discriminated union of a component kind and its props:

```ts
type Component = {
  component: Components;      // enum
  props: IBox | IButton | IText | …;
  contextName?: string;       // addressable name, see "Updating a live panel"
};
```

Containers nest through `IBox.children` — **only `box` can have children**. A toast or a modal is triggered by an action, not placed in a tree.

What the host does with a node:

- **`box`** renders a plain `<div>`. Nine props are mapped to CSS (`widthProp`→`width`, `heightProp`→`height`, `paddingProp`→`padding`, `marginProp`→`margin`, `displayProp`→`display`, `backgroundProp`→`background`, `flexProp`→`flex`, `overflowProp`→`overflow`, `borderProp`→`border`/`border-radius`), and **every remaining prop is copied into `style` verbatim** — so the typed flex props (`flexDirection`, `alignItems`, `justifyContent`, `flexWrap`, `textAlign`, …) are just camelCase CSS, and at runtime *any* camelCase CSS property works. The SDK type only declares the listed set; anything beyond it (`gap`, `maxWidth`, `minHeight`, …) compiles only behind a cast (`{ gap: "8px" } as IBox`). Prefer the typed props — `marginProp` on children instead of `gap` — so the tree stays checkable.
- **Every other component** gets your props spread into the matching ui-kit component as-is. Style-mapping does **not** happen there: `widthProp` on a `text` does nothing. To size or position a control, wrap it in a `box`.
- **Callbacks are wired per component** and the returned `IMessage` is dispatched:

| Component | Callback | Receives |
|---|---|---|
| `input`, `textArea` | `onChange` | the new string value |
| `checkbox`, `toggleButton` | `onChange` | **nothing** — flip your own state and return `updateProps` with the new `isChecked` |
| `comboBox` | `onSelect` | the whole option object you supplied |
| `button` | `onClick` | nothing; the host `await`s it |
| `iconButton`, `link` | `onClick` (optional) | nothing; awaited |

`borderProp`: **only the object form renders** — `{ width, style, color, radius }`, joined into CSS (`radius` alone gives just a border-radius). A CSS shorthand string (`"1px solid red"`) type-checks and is then **silently ignored** by the host.

## The portal's visual language

Match these and a plugin looks native; fight them and it looks broken in one theme or the other.

**Typography.** Everything inherits `Open Sans` at **13px / weight 400** from the portal body. `text` renders a `<p>` (block, margin 0) at 13px/400; secondary lines are 12px, emphasis is `fontWeight: 600` (the portal rarely uses 700 outside headers). Modal headers are set by the host at 21px/700 — do not build your own.

**Spacing and radius.** The portal's dialogs and panels use 16px outer padding, 8–12px between controls, and border-radius 3px on controls, 6px on dialogs/toasts, 12px on cards. There are no spacing tokens — literal px is normal.

**Colors — use the theme variables.** The portal swaps a `light`/`dark` class on `<body>`; every variable below flips with it, and inline styles pick the change up live with no re-render. Never hardcode a hex pair. The admin can also re-brand the accent, so even "DocSpace blue" `#4781d1` is wrong on some portals — use the accent tokens.

| Variable | Light | Dark | Use for |
|---|---|---|---|
| `--text-color` | `#333333` | `#ffffff` | primary text (inherited default) |
| `--text-disable-color` | `#a3a9ae` | `#5c5c5c` | disabled/muted text |
| `--row-side-color` | `#a3a9ae` | `#858585` | secondary text |
| `--link-color` | `#333333` | `#ffffff` | links |
| `--accent-main` | admin accent, fallback `#4781d1` | same | accent color |
| `--accent-button` / `--accent-button-text` | accent / `#ffffff` | accent / `#333333` | primary-button pair |
| `--background-color` | `#ffffff` | `#333333` | main surface |
| `--input-bg` | `#ffffff` | `#282828` | field surface |
| `--filled-button-background-color` | `#eceef1` | `#242424` | subtle filled block |
| `--background-service-color` | `#f3f4f4` | `#3d3d3d` | secondary panel |
| `--border-service-color` | `#eceef1` | `#474747` | **the** generic divider/border |
| `--checkbox-border-color` | `#d0d5da` | `#474747` | stronger control outline |
| `--input-border-focus` | `#5299e0` | `#ffffff` | focus ring |
| `--input-error-color` | `#f24724` | `#e06451` | **error text/border** |
| `--status-icon-color-positive` | `#35ad17` | `#3ba420` | success |
| `--status-warning` | `#ed7309` | `#e17415` | warning |
| `--input-border-radius` | `3px` | `3px` | control radius |

Three traps, all verified: **`--error-color` and `--success-color` do not exist** (an invalid `var()` silently falls back to inherited color); **`--warning-color` exists but resolves to the error red** — use `--status-warning`; there is no generic `--border-color` — use `--border-service-color`.

A callback can branch on theme via `window.theme?.isBase` (`true` = light), but CSS variables are almost always the better tool — they update on theme switch without any plugin involvement.

**Icons.** Icon fields on items and `iconButton` take a **file name from `assets/`**, resolved by the host to a cache-busted URL. SVGs are inlined and recolored by the portal — but each surface recolors differently:

- `iconButton` repaints every `path`/`rect` unconditionally (default grey, or your `color` prop — `"accent"` and `"--any-var"` are understood).
- Context menus and dropdowns repaint only shapes that carry an explicit `fill="…"`/`stroke="…"` **attribute** — a path styled via internal CSS or `currentColor` keeps its own color.
- The mobile context menu and any non-SVG image render **as-is**, never recolored.

So: ship monochrome SVGs, put an explicit `fill` attribute on every shape, and pick a mid-grey base color so the one surface that does not recolor still reads in both themes. PNGs are never recolored — avoid them for anything but logos.

## Component reference

Props listed are the SDK-typed ones the host honours, with runtime defaults. "Dead" means: compiles, does nothing on this host — the validator warns about the known ones.

### box

Typed props: the nine mapped style props plus `flexDirection`, `alignItems`, `alignContent`, `alignSelf`, `justifyContent`, `justifyItems`, `justifySelf`, `flexBasis`, `flexWrap`, `gridArea`, `textAlign`, `className`, `id`, `children`. No required props. This is the only container and the only place `children` works.

The standard column form:

```ts
{ displayProp: "flex", flexDirection: "column", children: [ /* rows */ ] }
```

There is no typed `gap` — space children with `marginProp` (e.g. `marginProp: "0 0 12px 0"` on each row but the last), or cast if you must.

### text

Renders a `<p>`, 13px/400, margin 0, color inherited from the theme. Required: `text`. Honoured: `fontSize` (string, e.g. `"12px"`), `fontWeight` (400/600), `isBold` (forces 700, beats `fontWeight`), `isItalic`, `color`, `textAlign`, `lineHeight`, `truncate` (single line + ellipsis), `noSelect`, `isInline` (inline-block), `display`... note `display` is typed but **dead** — use `isInline` or wrap in a box.

Because each `text` is a block paragraph, consecutive texts stack; set `lineHeight` explicitly when baselines matter (there is no global line-height token).

### label

A `<label>` at 13px with **weight 600 hard-coded**. Required: `text`. Honoured: `htmlFor`, `error` (red), `isRequired` (red `*`), `truncate`, `isInline`, `title`, `className`, `id`. The component takes a fixed prop list — anything else (`fontSize`, `color`, …) is **silently dropped**. For styled captions use `text` with `fontWeight: 600` instead.

### link

An `<a>`, 13px, colored `--link-color`. Props from `IText` plus: `type` (`LinkType.page` → solid underline on hover, `LinkType.action` → dashed underline — use `action` for handlers, `page` for navigation), `href`, `target` (`LinkTarget`), `textDecoration`, `noHover`, `isHovered`, `isSemitransparent` (opacity .5), `enableUserSelect`, `onClick` (no arguments; may return an `IMessage`). `color: "accent"` resolves to the portal accent.

Trap: `isTextOverflow` only sets `max-width: 100%` — **ellipsis needs `truncate`**.

### button

Required by the SDK type: `label`, `size`, `onClick`. **`onClick` is the one that is fatal** — the host calls it unguarded, so a button without it throws on click and takes the portal down. A missing `label` or `size` degrades quietly (blank button, no size class) rather than throwing. Sizes:

| `ButtonSize` | Height | Font |
|---|---|---|
| `extraSmall` | **broken — do not use** | |
| `small` | 32px | 13px |
| `normal` | 40px | 14px |
| `medium` | 44px | 16px |

The SDK emits `"extra-small"` where the host's stylesheet expects `"extraSmall"`, so `ButtonSize.extraSmall` produces a button with **no height class at all** — a collapsed pill. `small`/`normal`/`medium` match exactly. `normal` is the dialog default; there is no `big`.

Honoured: `primary` (accent-filled — exactly one per dialog), `scale` (width 100%), `isDisabled`, `isLoading` (spinner replaces the label and blocks clicks), and two host-managed conveniences worth using on anything async:

- `withLoadingAfterClick: true` — the host shows the spinner from click until your `onClick` promise settles, and while it runs **every** button in the same dialog with these flags follows suit;
- `disableWhileRequestRunning: true` — same, but disabled instead of loading.

Labels never wrap (ellipsis on overflow) — keep them short. The `icon` prop in the ui-kit type needs a React node and is not reachable from a plugin.

### iconButton

No required props (an empty one renders a blank 20px square). `iconName`/`iconHoverName`/`iconClickName` are **asset file names**, resolved by the host. `size` is a number of pixels (default 20). `color`/`hoverColor`/`clickColor` accept `"accent"`, a `--var-name`, or raw CSS color; the SVG is repainted with it (default grey). `isFill` (default true) vs `isStroke` picks which attribute is repainted. `onClick` optional, may return a message.

### input

Required: `value`, `onChange` (called with the new string). Sizes — the SDK type offers five, the host implements three:

| `InputSize` | Width | Height | Note |
|---|---|---|---|
| `base` (default) | 173px | 32px | |
| `middle` | 300px | 32px | font-weight 600 |
| `big`, `huge` | — | — | **dead** — the host enum has only `base`/`middle`/`large`, so these produce no size class and a collapsed field |
| `large` | 550px | 44px | 16px font |

In practice: `scale: true` plus the default size is the right call inside dialogs — `scale` overrides the fixed width, the size then only sets font/padding.

Honoured: `placeholder`, `type` (`InputType.text`/`password`), `hasError` (red border), `hasWarning` (amber), `isDisabled`, `isReadOnly`, `isAutoFocused`, `autoComplete`, `onBlur`/`onFocus` (string value), `iconName` + `onIconClick` etc. (in-field icon), `name`, `id`, `className`.

Two silent defaults to know: **`maxLength` defaults to 255**, and **`tabIndex` defaults to `-1`** — pass `tabIndex: 0` if keyboard users matter, and raise `maxLength` for long values (it is typed as a string in the SDK: `maxLength: "1024"`).

### textArea

Required: `value`, `onChange` (new string). Default box is ~90px tall, 13px font, not user-resizable. `heightTextArea` (number = px, or a CSS string) sets the height — but is ignored if `isFullHeight` (auto-grow to content) or `heightScale` (65vh) is set. `fontSize` is a **number** here, not a string. `hasError` for the red border; `maxLength` (number) has **no default cap** unlike `input`; `tabIndex` again defaults to `-1`. `isJSONField: true` pretty-prints and red-flags invalid JSON on its own — including for an empty string, so only set it once there is content.

### checkbox

Required: `isChecked`, `onChange` (no arguments — track state yourself and return `updateProps`). `label` renders at 13px/400; without it you get a bare 16px box. `isIndeterminate` wins over `isChecked` visually. `hasError` turns the label **and** box red. `truncate` for one-line labels.

Trap: **`onChange` still fires when `isDisabled` is true** — guard in your handler if the click must not act.

### toggleButton

Required: `isChecked`, `onChange` (no arguments). Optional `label` (13px/400), `isDisabled`.

**Layout trap:** the control is a 28×16 switch whose inner label is absolutely positioned, so the component has **no intrinsic size** — dropped straight into a column it overlaps the next row. Always give it a row of its own with an explicit height:

```ts
{ component: Components.box, props: { heightProp: "20px", displayProp: "flex", alignItems: "center",
    children: [{ component: Components.toggleButton, props: { label: t("…"), isChecked, onChange } }] } }
```

### comboBox

Required: `options` (must be an array — the host dereferences `.length` unguarded, so even "no options yet" must be `[]`) and `selectedOption`. Every option needs `key` **and** `label` (`{ key, label, icon?, disabled? }` — `icon` is an asset file name); a missing `key` throws during render.

Behaviour to design around, all defaults of the real component:

- `scaled` defaults to **true** — the control fills its container. Wrap it in a box of the right width rather than fighting it.
- The **currently selected row shows greyed-out and unclickable** in the list. That is the portal's normal look, not a bug.
- Options are matched by **`label`, not `key`** — two options with the same label both grey out. Keep labels unique.
- The dropdown panel is 200px wide regardless of the control; pass `scaledOptions: true` to make it match the control, and `dropDownMaxHeight` (px number) once you have more than ~6 options, or the list grows unbounded.
- `onSelect` receives the full option object; the dropdown closes itself. Selection does **not** update the button — return `updateProps` with the new `selectedOption` from `onSelect`.

`modernView: true` is the borderless 28px look used in toolbars; default is the bordered 32px field look. Typed but dead on this host: `showDisabledItems` (always on) and `opened` (broken on first mount).

### img / iFrame

`img` renders a raw `<img>` — required `src` and `alt`, plus `width`/`height`/`style`. The src is **not** resolved against `assets/` — use a data: URI or an external URL (external hosts must be in `cspDomains`).

`iFrame` renders a raw `<iframe>` with `border: none; min-height: 100%` — required `src`, plus `width`/`height`/`name`/`sandbox`/`id`/`style`. Give it an `id` if you plan to `sendPostMessage` to it.

### skeleton

Required: `width`, `height` (CSS strings). Optional `borderRadius` (default 3px). A shimmering placeholder bar that works in both themes; the standard filler while `onLoad` fetches. Compose several in a column to sketch the coming layout — e.g. a 16px bar at 60% width over an 80px bar at 100%.

## Modals and asides

`Actions.showModal` + `modalDialogProps` (an `IModalDialog`). The host renders its standard dialog: your `dialogHeader` string becomes a 53px header at 21px/700 with a close cross, `dialogBody` and `dialogFooter` are boxes rendered with 16px side padding, footer buttons sit in a row.

Dimensions that decide your layout, from the real stylesheet:

| Display | Width | Max-height |
|---|---|---|
| `ModalDisplayType.modal` | 400px | **280px** |
| modal + `autoMaxHeight` | 400px | unset — grows to content |
| `ModalDisplayType.aside` | 480px, full height | — |

**The 280px default max-height is the number that bites.** A modal has no scroll container of its own — content taller than that simply overflows the rounded corners. So: a modal with more than ~three rows needs `autoMaxHeight: true`; anything form-like or long is usually better as an `aside`, which is full-height. For a scrollable region in either, give an inner box `overflowProp: "auto"` and an explicit `heightProp` — that stays inside the SDK type, unlike the host's own `withBodyScroll` (see below).

Footer convention: buttons in one row, gap 8px, **primary action first**, both with `scale: true` so two buttons split the width — the pattern every portal dialog uses:

```ts
const dialogFooter: IBox = {
  displayProp: "flex",
  children: [
    { component: Components.button, props: { label: t("save"), size: ButtonSize.normal, primary: true, scale: true,
        withLoadingAfterClick: true, disableWhileRequestRunning: true, onClick: onSave } },
    { component: Components.box, props: { widthProp: "8px" } },   // the gap
    { component: Components.button, props: { label: t("cancel"), size: ButtonSize.normal, scale: true,
        onClick: () => ({ actions: [Actions.closeModal] }) } },
  ],
};
```

Contract points, each one a real failure mode:

- **`onLoad` is required and replaces header, body and footer together.** The host assigns all three from what you return — `{ newDialogBody }` alone **wipes an existing footer and header**. Always return every section the dialog has: `{ newDialogHeader, newDialogBody, newDialogFooter }`.
- **`onClose` must itself return `{ actions: [Actions.closeModal] }`** — Esc, the cross and a backdrop click all call your `onClose`, but none of them hides the dialog; that is your message's job. While a `withLoadingAfterClick` request is running, closing is suppressed.
- `withoutBodyPadding`, `withoutHeaderMargin`, `withFooterBorder` do what they say (footer border is on by default only in asides).
- `fullScreen: true` renders your body into a fixed full-viewport overlay — **no header, no footer, no close button**; you must draw your own chrome and closing control.
- `eventListeners: [{ name, onAction }]` subscribes to window events for the dialog's lifetime; the returned message is dispatched, and the dialog shows its running state while `onAction` is pending.
- Extra `ModalDialog` props the host honours but `IModalDialog` does **not declare** — `withBodyScroll` and `withBodyScrollForcibly` for managed scrolling, `isLarge` (520×400) and `isHuge` for width — reach them only behind a cast; passing one directly is a TS2353 build error, not a runtime problem. `autoMaxWidth` and `autoMaxHeight` *are* declared, so prefer those.

## Toasts

`Actions.showToast` + `toastProps: IToast[]` — each `{ type, title }` shows one toast, top-right, 320px wide, auto-closing after 5 seconds.

What the type offers but the host ignores: **`withCross` and `timeout` are dead** — every plugin toast is click-to-dismiss with the fixed 5s timeout. And the naming is a trap: your `title` becomes the toast **body**; the heading is the portal's own localized word for the type ("Done", "Warning", "Alert", "Info") and cannot be changed. So write `title` as a sentence, not a heading, and keep it short — long text wraps and grows the toast.

## Selectors

`Actions.showSelector` + `selectorProps: { type: SelectorType, props: … }` opens the portal's standard picker panel (files, rooms, people, groups, or your own list). `closeSelector` closes it; the selector does not close itself — do it in `onSubmit`/`onCancel`. Callbacks may return any `IMessage`.

| `SelectorType` | Props type | `onSubmit` receives |
|---|---|---|
| `Files` | `TFilesSelector` | `{ selectedItemId, folderTitle, fileName, selectedFileInfo, breadCrumbs, isChecked }` |
| `Room` | `TRoomSelector` | `(selectedIds: (string\|number)[])` |
| `People` | `TPeopleSelector` | `{ selectedIds, fileName, isFooterCheckboxChecked }` |
| `Groups` | `TGroupsSelector` | `{ selectedIds }` |
| `Base` | `TBaseSelector` — your own `items` | `{ selectedIds, fileName, isFooterCheckboxChecked }` |

Every selector renders as an **aside** — there is no inline or modal form — and only the props its type declares reach the host; anything cast in on top is dropped.

`TFilesSelector.getIsDisabled` is **required**, and called with `{ isFirstLoad, isRoot, selectedItemId, selectedItemType, selectedItemSecurity, selectedFileInfo }`; its boolean disables the submit button. Minimal working files picker:

```ts
{
  actions: [Actions.showSelector],
  selectorProps: {
    type: SelectorType.Files,
    props: {
      isRoomsOnly: false,
      submitButtonLabel: t("select"),
      getIsDisabled: ({ isFirstLoad, selectedItemId }) => isFirstLoad || !selectedItemId,
      onSubmit: ({ selectedItemId, fileName }) => ({ actions: [Actions.closeSelector], /* … use it … */ }),
      headerProps: { label: t("pickFile"), isCloseable: true,
        onCloseClick: () => ({ actions: [Actions.closeSelector] }) },
    },
  },
}
```

For `Base`, each item is `{ id, label, icon? }` (icon = asset file name); items can also be inline inputs (`isInputItem`) or a "create new" row (`isCreateNewItem`) — see `TSelectorItem` in the SDK.

**The Room selector is single-selection only.** `isMultiSelect` is in the type but a plugin cannot drive it, so leave it off: submit stays disabled until a room is highlighted, and clicking the same room again clears it. For acting on several rooms, skip the selector and register a context menu item with `isGroupAction`/`onGroupClick` — the rooms the user ticked in the file list arrive as the argument, which is the surface the portal built for bulk actions.

## The create-file dialog

`Actions.showCreateDialogModal` + `createDialogProps: ICreateDialog` opens the portal's own "create file" dialog — the same one Document/Spreadsheet use, so it inherits correct focus, validation and buttons for free. Use it for File-scope "new file" flows instead of building a modal.

```ts
{
  actions: [Actions.showCreateDialogModal],
  createDialogProps: {
    title: t("createFile"), startValue: "New file", visible: true, isCreateDialog: true,
    extension: ".myext",
    onSave: async (e, value) => { await createFile(`${value}.myext`); return { actions: [Actions.showToast], … }; },
    onCancel: () => {}, onClose: () => {},
  },
}
```

Host behaviour worth knowing: the input caps at 165 characters and strips emoji; Enter submits, Esc cancels; invalid file-name characters flip the field into its error state with the portal's message; `options`/`selectedOption`/`onSelect` add a combobox under the field (same option shape as `comboBox`); `isCloseAfterCreate` defaults to true; if `onSave` throws, your `onError` is awaited and its message dispatched. **The `extension` is not appended for you** — it only drives the "don't ask again" checkbox; append it yourself in `onSave`.

## Media viewer

`Actions.showMediaViewer` + `mediaViewerProps: IMediaViewer` replaces the portal media viewer's content with your box, full-screen, with the viewer's own chrome. The host reads `fileId`, `content` (an `IBox`), `title`, `onLoad({ fileId })` and `onClose`. `closeMediaViewer` closes it; `updateMediaViewer` swaps the props (typically from `onLoad` once the real content is ready).

**Playlist and navigation are wired up**, though not in the same place as the rest of the viewer — they live in the portal's media-viewer store:

- `playlistFilter` narrows which files the viewer will page through: `filesExsts` (matched case-insensitively, with or without the leading dot), `filesSecurity` (**every** listed key must be allowed on the file), `devices` and `usersTypes`. Without it the viewer uses the folder's full media playlist.
- `navigation.onNext` / `navigation.onPrevious` fire when the user pages, and `navigation.onFileChange({ fileId })` fires afterwards with the file being moved to. All three return an `IMessage` that is dispatched normally — `onFileChange` is where you swap your content, usually with `updateMediaViewer`.

The ordering is worth knowing: `onNext`/`onPrevious` run **before** the viewer advances its current file, `onFileChange` **after**. Do the work in `onFileChange`, where the new `fileId` is the one you are given.

## The floating operations button

The portal's own progress button — the one that tracks downloads, conversions and moves — accepts plugin entries, which is the right surface for any long-running background job. It is the only way to report progress without holding a modal open.

`Actions.addFloatingOperationsButton` + `floatingOperationsButtonProps: IFloatingOperationsButton`:

```ts
{
  actions: [Actions.addFloatingOperationsButton],
  floatingOperationsButtonProps: {
    id: "myplugin-export",
    operations: [{
      id: "job-1", label: t("exporting"), operation: FloatingOperationType.Other,
      alert: false, completed: false, percent: 0, icon: "icon-16.svg",
    }],
    showCancelButton: true,
    onCancelOperationFromList: (operationId) => ({ /* … */ }),
  },
}
```

Each operation is `{ id, label, operation, alert, completed, percent?, icon? }`; `operation` is a `FloatingOperationType` (`Download`, `Convert`, `Copy`, `Upload`, `Backup`, … or `Other` for anything that is not one of the portal's own jobs), and `icon` is an asset file name resolved by the host.

The mechanics that decide whether this works:

- **`id` on the button is the handle.** `removeFloatingOperationsButton` takes it as `floatingOperationsButtonPropsId` — a bare string, not an object, unlike every other action's payload.
- **Add before you update.** `addFloatingOperationsButton` ignores an id that is already registered, and `updateFloatingOperationsButton` ignores one that is not — so an update sent first is a silent no-op, and progress never appears. To advance a percentage, re-send the whole props object with `update`.
- **Operation ids are namespaced by the host**, which prefixes them with your plugin name. `onCancelOperationFromList` hands you back your own unprefixed id, so compare against what you sent.
- `cancelOperation` fires when the user cancels everything at once; `onCancelOperationFromList(operationId)` fires for a single row. Both return an `IMessage`.
- `onLoad` is the odd one out — it receives a **dispatch function** rather than returning a message, so it can push updates as the job progresses.
- When the button is dismissed, the portal drops **all** of your operations. Treat that as the end of the job and re-add if it is still running.

## Updating a live panel

Two mechanisms, and the distinction matters:

**Self-update** — change the props of the element whose callback is running:

```ts
onChange: (value: string) => ({ actions: [Actions.updateProps], newProps: { value } })
```

**Sibling update** — change another element, addressed by its `contextName`:

```ts
// declaration
{ component: Components.text, contextName: "error", props: { text: "" } }

// from another element's callback
{ actions: [Actions.updateContext],
  contextProps: [{ name: "error", props: { text: t("invalidUrl"), color: "var(--input-error-color)", fontSize: "12px" } }] }
```

This is how live validation works: the input's `onChange` returns both actions in one message — `updateProps` to stay editable, `updateContext` to set the error text.

The fine print, all host-verified:

- Both actions only work from callbacks **inside a rendered plugin tree** (modal, settings, info panel, article body). From a menu item they do nothing / throw — open a modal and update from within. [host-behavior.md](host-behavior.md) has the full matrix.
- `newProps` **replaces** the element's props rather than merging — send the complete new set. Sending `updateProps` with no `newProps` at all wipes the element.
- The `IMessage.newProps` type only admits form controls (`IInput | ICheckbox | IToggleButton | IButton | ITextArea | IComboBox`). A `text` or `box` cannot self-update — give it a `contextName` and use `updateContext`, whose payload accepts every component.
- In the settings block, `updateContext` addressed at the save button's `contextName` updates the save button.

## Async content and `onLoad`

`InfoPanel`, `ArticleButton`, `Settings` items and modals all accept an `onLoad` returning a promise. Use it for anything that fetches: register the item with a `skeleton` placeholder body, resolve with the real content. Doing the fetch in `onLoadCallback` instead delays installation of the whole plugin — and an exception there aborts it silently.

What each surface expects back — returning the wrong shape blanks the section:

| Surface | `onLoad` must resolve to |
|---|---|
| Modal (`IModalDialog`) | `{ newDialogHeader, newDialogBody, newDialogFooter }` — **all sections the dialog has**; omitted ones are wiped |
| Settings (`ISettings`) | `{ settings }` (always) `+ { saveButton }` (optional — kept if omitted) |
| Info panel item | `{ body }` |
| Article button item | `{ body }` |

Handle your own errors inside `onLoad` and resolve with an error body — a rejected `onLoad` is an unhandled rejection and the skeleton stays forever.

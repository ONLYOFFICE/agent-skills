# Modal dialog

The portal's modal or aside, with a React component of the plugin's as its body.

| | |
|---|---|
| Types | [`IModalDialog`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/IModalDialog.md) (`ModalDisplayType`) |
| Class side | `Actions.showModal` with `modalDialogProps` (carrying `dialogBodyComponent`); `Actions.closeModal` |
| From a component | `showModal(props)`, `closeModal()` from `usePluginActions()` |
| Surface | header from `dialogHeader`, close cross, **no footer slot**; a modal is padded on every side, an **aside only on the sides** — its vertical gutter is yours |
| `useCurrentFile()` in the body | the opening component's current file; `null` when a class-side callback opened it ([hooks.md](../react/hooks.md#what-usecurrentfile-returns-where)) |

```ts
showModal({
  displayType: ModalDisplayType.aside,   // or modal (default)
  dialogHeader: t("details"),
  dialogBodyComponent: DetailsPanel,
  autoMaxHeight: true,
  onClose: () => { /* user-initiated close only */ },
});
```

Every prop on the [`IModalDialog`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/IModalDialog.md) page is honoured on a React modal except the deprecated `dialogBody`/`dialogFooter`/`onLoad`, which are ignored when `dialogBodyComponent` is present.

- **Size.** `modal` is 400px wide and capped at **280px high** unless `autoMaxHeight`; `aside` is 480px and full height; the portal leaves the kit's body scroll off for a plugin aside, so a long panel needs an overflow region of its own (below). `autoMaxWidth` + `autoMaxHeight` hand sizing to the body — **a large dialog is an ordinary modal with both flags** and a width on the component's root. The kit's `isLarge`/`isHuge` are not forwarded. `fullScreen: true` is not a bigger modal: an opaque full-viewport div with no header, padding or close control — right on a phone, wrong on a desktop.
- **No footer slot.** Render the action row in the body: `Button primary scale`, then the cancel, 8px apart; call `closeModal()` from both.
- **An aside scrolls only where you give it the region.** Its body has a definite height, so a percentage resolves: root `display: flex; flex-direction: column; height: 100%`, the scrolling part `flex: 1 1 auto; min-height: 0; overflow: auto`, anything held out of it `flex: 0 0 auto`. A modal's body is sized by its content and needs none of this.
- **An aside has no vertical padding and no gap under its header.** The kit scopes both 16px rules to `.displayTypeModal`, so an aside body is `padding: 0 16px` under a 53px header block: the first line sits against the header, and with the `height: 100%` above, the last one sits on the bottom edge. Give the root `padding-block: var(--modal-dialog-padding-y, 16px)` and `box-sizing: border-box`. The *side* padding is there, so a divider meant to span the full 480px has to cancel it — `margin-inline: calc(var(--modal-dialog-padding-x, 16px) * -1)`, the padding put back on the inside. Keep those fallbacks: the kit declares both variables on the modal wrapper, which the browser pass never renders — and that pass gives a dialog a bare box with neither the aside's padding nor its height, so it cannot show either defect.
- **One dialog at a time; props are frozen.** A second `showModal` *replaces* the first (without calling its `onClose`). A confirmation over a dialog is a state the same body renders, not a second modal. Anything that would change the props is a re-open with new ones.
- **`onClose` cannot cancel the close.** It runs on cross/Esc/backdrop; the host awaits it, closes, then dispatches what it returned — for a `dialogBodyComponent`; an SDK 2 tree modal stays open until its `onClose` returns `closeModal` ([sdk-2-plugins.md](../sdk-2-plugins.md)). So "keep unsaved work" is: hold the draft in **module** state (it survives the unmount) and have `onClose` return a `showModal` that re-opens the same dialog with the confirmation showing:

```ts
let draft: { value: T | null; saved: T | null; confirm: boolean } | null = null;   // module state; the body mirrors edits into it
const isDirty = () => !!draft && draft.value !== null && !equal(draft.value, draft.saved);

const workDialog = (): IModalDialog => ({
  dialogHeader: t("dialog.title"), dialogBodyComponent: DialogBody, autoMaxWidth: true, autoMaxHeight: true,
  onClose: () => {
    if (!isDirty()) { draft = null; return; }
    draft.confirm = true;
    return { actions: [Actions.showModal], modalDialogProps: workDialog() };   // same dialog, asking
  },
});
// DialogBody renders the question in place of its content while draft.confirm is set;
// confirming clears draft and calls closeModal(), going back clears the flag.
```

- **The body inherits `white-space: pre-line`.** Composed JSX does not notice; markup you *generate* comes out double-spaced, and a rule on your wrapper does not fix it — [styles.md → What beats your rules](../styles.md#what-beats-your-rules).

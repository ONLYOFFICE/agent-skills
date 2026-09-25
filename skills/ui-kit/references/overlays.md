# Dialogs, panels, menus and toasts

Everything the kit draws over the page. Each component's own page is under
`references/components/`; this one is the part that decides between them and the part that
only bites when they are composed.

## The prop that shows and hides it

There is no single name, and guessing wrong is silent — the prop is ignored, nothing is
logged, and the overlay simply never appears. Derived from the components themselves:

| Prop | Components |
|---|---|
| `visible` | `ModalDialog`, `Aside`, `Backdrop`, `Portal`, `AvatarEditorDialog`, `RoomLogoCoverDialog` |
| `isOpen` | `Tooltip`, `HelpButton`, `LinkWithDropdown`, `CollapsibleCard` |
| `opened` | `ComboBox`, `ContextMenuButton`, `MainButtonMobile` |
| `open` | `DropDown` |

`ContextMenu` and `Selector` have none at all: the first is opened through a ref, the second
fills whatever box you put it in.

## Dialog or panel

`ModalDialog` is the one to reach for. It covers both shapes: `displayType={ModalDialogType.modal}`
is the centred dialog, `ModalDialogType.aside` is the same component docked to the edge. Use
`Aside` itself when the panel is part of the page's furniture rather than an interruption —
details of a selected row, a filter panel — and you want no dialog behaviour around it.

```tsx
import { useState } from "react";
import { Button, ButtonSize } from "@onlyoffice/apps-ui-kit/components/button";
import { ModalDialog, ModalDialogType } from "@onlyoffice/apps-ui-kit/components/modal-dialog";

export function DeleteRoomDialog({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button label="Delete room" onClick={() => setOpen(true)} size={ButtonSize.normal} />
      {open ? (
        <ModalDialog visible displayType={ModalDialogType.modal} onClose={() => setOpen(false)}>
          <ModalDialog.Header>Delete room?</ModalDialog.Header>
          <ModalDialog.Body>This cannot be undone.</ModalDialog.Body>
          <ModalDialog.Footer>
            <Button primary scale size={ButtonSize.normal} label="Delete" onClick={onConfirm} />
            <Button scale size={ButtonSize.normal} label="Cancel" onClick={() => setOpen(false)} />
          </ModalDialog.Footer>
        </ModalDialog>
      ) : null}
    </>
  );
}
```

Four things in that block are deliberate.

**The dialog is rendered conditionally, and `visible` is separate from that.** `visible` does
not mount or unmount anything: the dialog and its whole body are in the document either way,
and the prop only toggles CSS classes. Effects, subscriptions and fetches inside the body run
while it is invisible. Render `<ModalDialog>` only when it is open, and pass `visible`.

**The slots are direct children.** `ModalDialog.Header`, `.Body`, `.Footer` and `.Container`
return `null` — the dialog scans its children for their display names and renders the content
itself. A slot wrapped in a fragment or in a component of your own disappears with no error,
and any child that is not one of the four is dropped. Two of a kind: the last wins.

**The footer is a flex row the buttons share.** Give each button `scale` and the two come out
the same width. Wrapping one in an element of your own — to scope a CSS variable, say — takes
it out of that arrangement: the wrapper sizes to its content and the other button takes the
rest of the row. Put the variable on the button; `Button` forwards `style` to its `<button>`.

**Primary first, cancel second**, and one primary on the screen.

Other things a dialog does that its types do not say: Escape and Backspace are handled on
`window`, so Escape closes wherever focus is and Backspace fires `onBackClick` unless the
target is an `<input>` or `<textarea>`. `isLoading` replaces the body entirely, losing the
state inside it. `embedded` disables closing ahead of `isCloseable` — no cross, no Escape,
`onClose` never called. The dialog portals into `document.body`, so no parent's `overflow`
matters; layering is `zIndex`, 310 by default.

**Name the dialog yourself.** `role="dialog"` and `aria-modal` sit on the dialog surface, and
`aria-labelledby`, `aria-label` and `aria-describedby` are props that reach it. Prefer
`aria-labelledby` pointing at an `id` on the heading you already render in
`ModalDialog.Header`; a dialog given neither is announced as an unnamed dialog.

**An `Aside` lays its own body out.** The panel is a flex column and the scrolling body takes
the space the header leaves, so a long list reaches its last item with nothing on your side.
Do not add a `className` making it a flex column or reach for `withoutBodyScroll` to fix
scrolling — both were the workaround for a defect the kit has since fixed, and the second one
now costs you the scroller you would otherwise get for free.

If you do pass `withoutBodyScroll` and bring a scroller of your own, give it `flex: 1 1 0` and
`min-height: 0`. A plain `height: 100%` there resolves against the whole panel and hangs its
bottom below the edge — which is exactly the shape the old defect had.

`style` is not a way into the panel: `Aside` writes `style={{ zIndex }}` before spreading the
rest of its props, so a `style` of yours replaces it and lands on the header as well.

## Menus

`DropDown` with `DropDownItem` is a menu anchored under a control. `ContextMenu` is the
right-click menu and positions itself at the pointer.

`DropDown` is the sharpest edge in the kit:

- **Nothing closes it by itself.** `open` is yours; `clickOutsideAction` is called by the
  backdrop and by whichever DOM events you list in `eventTypes`, and there is no default list
  and no Escape handling.
- **It needs `forwardedRef` pointing at the anchor** — it measures that element on open, on
  resize and on scroll. Without it the menu lands wherever the stylesheet leaves it.
- **`maxHeight` changes how children render.** Without it, every child is rendered as given,
  with no scrollbar and no keyboard navigation. With it the list is virtualised and each
  child's height is taken from its `height` prop (32px, 36 on a tablet, 12 for a separator) —
  a child that is really taller overlaps its neighbour.
- **An open menu with keyboard navigation prevents the default of every key press in the
  document**, so a text field elsewhere stops accepting characters. Pass
  `enableKeyboardEvents={false}` for a menu beside an input.
- Its width is `manualWidth`, not the anchor's.

## Toasts

Two pieces: one `<Toast />` mounted once, anywhere in the tree, and `toastr.success(...)`
calls from wherever you like.

```tsx
import type { ReactNode } from "react";
import { Toast, toastr } from "@onlyoffice/apps-ui-kit/components/toast";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toast />
    </>
  );
}

export const saved = () => toastr.success("Room settings saved");
```

- **Nothing appears until `<Toast />` is mounted.** Calls made before that are queued and
  shown when it arrives.
- **Almost all of `ToastProps` is ignored** — the container reads `className`, `style` and
  `isSSR`. `title`, `type`, `timeout` and the rest describe a toast; pass them to `toastr`.
- **The arguments are positional and the third is a trap.** `timeout` is in milliseconds, `0`
  means never, and **anything below 750 is silently replaced with 5000**.
- **A toast closes on click unless `withCross` is set** — the two are exclusive.
- **The default title is translated at call time** from the `Common` namespace. Without
  `TranslationProvider` it comes back as an empty string, and the title is rendered only when
  it is truthy — so the toast arrives with no title line at all, not with a blank one. Passing
  `null` deliberately reaches the same result, which is what makes a missing provider read as
  a design decision.
- **The container renders into `#root`**, falling back to `document.body`. An application
  whose root element has another id gets its toasts on the body — outside the element the
  theme class is written on, so the colours go with it.

`Snackbar` and `ColumnarInfoBar` are the banners that stay until closed; `StatusMessage` is
the one that stays until the state changes and has no close control.

## Tooltips

`Tooltip` is `isOpen`, and most components that want one take `title`/tooltip props of their
own through a wrapper the kit applies — `Button` among them. Reach for the component directly
only when the tooltip is not attached to a kit control.

## Backdrop and Portal

`Backdrop` is the dimming layer and `Portal` is the escape hatch to `document.body`; both take
`visible`. `ModalDialog` and `Aside` bring their own, so mount these two only when building an
overlay of your own.

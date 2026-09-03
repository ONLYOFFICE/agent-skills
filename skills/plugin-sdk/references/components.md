# Components the portal draws

The SDK's `interfaces/components` — the surfaces the **host** renders on the plugin's behalf, as opposed to the mounting points in [items.md](items.md) and the components the plugin writes itself ([react.md](react.md#where-components-render)). A modal, a picker, the create-file prompt, the media viewer, the progress button: reach for these before building a list, a file-name field or a progress modal of your own, because they carry the portal's search, paging, validation and look.

Every shape here is the same from a component (`usePluginActions()`) and from a class-side `IMessage` — the difference is only whether the payload travels as an argument or as a field ([react.md → Actions](react.md#actions)). What none of them do is manage each other: the portal renders each surface from its own visibility flag, so **one portal-drawn surface at a time** is the plugin's job to enforce.

The declarative primitives that also live in that folder — `IBox`, `IButton`, `IText`, `IInput` and the rest of the `body: IBox` tree — belong to SDK 2 and are not used by a module plugin ([sdk-2-plugins.md](sdk-2-plugins.md)).

Contents: [Modals](#modals) · [Selectors](#selectors) · [The create-file dialog](#the-create-file-dialog) · [Media viewer](#media-viewer) · [The floating operations button](#the-floating-operations-button) · [Work that takes a while](#work-that-takes-a-while)

## Modals

```ts
showModal({
  displayType: ModalDisplayType.aside,   // or modal (default)
  dialogHeader: t("details"),
  dialogBodyComponent: DetailsPanel,
  autoMaxHeight: true,
  onClose: () => { /* user-initiated close only */ },
});
```

Honoured on a React modal: `displayType`, `dialogHeader`, `autoMaxWidth`, `autoMaxHeight`, `withoutBodyPadding`, `withoutHeaderMargin`, `withFooterBorder`, `fullScreen`, `eventListeners`, `onClose`. `dialogBody`/`dialogFooter`/`onLoad` are ignored when `dialogBodyComponent` is present.

- **Size.** `modal` is 400px wide and capped at **280px high** unless `autoMaxHeight`; `aside` is 480px, full height, scrolls. `autoMaxWidth` + `autoMaxHeight` hand sizing to the body — **a large dialog is an ordinary modal with both flags** and a width on the component's root. The kit's `isLarge`/`isHuge` are not forwarded. `fullScreen: true` is not a bigger modal: an opaque full-viewport div with no header, padding or close control — right on a phone, wrong on a desktop.
- **No footer slot.** Render the action row in the body: `Button primary scale`, then the cancel, 8px apart; call `closeModal()` from both.
- **One dialog at a time; props are frozen.** A second `showModal` *replaces* the first (without calling its `onClose`). A confirmation over a dialog is a state the same body renders, not a second modal. Anything that would change the props is a re-open with new ones.
- **`onClose` cannot cancel the close.** It runs on cross/Esc/backdrop; the host awaits it, closes, then dispatches what it returned. So "keep unsaved work" is: hold the draft in **module** state (it survives the unmount) and have `onClose` return a `showModal` that re-opens the same dialog with the confirmation showing:

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

- **The body inherits `white-space: pre-line`.** Composed JSX does not notice; markup you *generate* comes out double-spaced, and a rule on your wrapper does not fix it — [styles.md → What beats your rules](styles.md#what-beats-your-rules).

## Selectors

`showSelector({ type: SelectorType.x, props })` opens the portal's picker as an aside. The shapes are the same from a component and from a class-side `IMessage`.

| `SelectorType` | Props type | `onSubmit` receives |
|---|---|---|
| `Files` | `TFilesSelector` | `{ selectedItemId, folderTitle, fileName, selectedFileInfo, breadCrumbs, isChecked }` |
| `Room` | `TRoomSelector` | `(selectedIds: (string \| number)[])` — an array, and `isMultiSelect` works: the host forwards it to the kit's `RoomSelector`, which keeps a set, and maps everything picked into the array |
| `People` | `TPeopleSelector` | `{ selectedIds, fileName, isFooterCheckboxChecked }` |
| `Groups` | `TGroupsSelector` | `{ selectedIds }` |
| `Base` | `TBaseSelector` — your own `items: { id, label, icon? }[]` | `{ selectedIds, fileName, isFooterCheckboxChecked }` |

- **A header needs `withHeader: true`, not just `headerProps`.** The label and the close cross are drawn only under that flag, so `headerProps` alone gives an aside with no title and no visible way out — Esc and the backdrop are all the user has left.
- **It never closes itself, and which handler the cross calls depends on the type.** `closeSelector()` has to be called from `onSubmit` *and* from the cancel path — which is `onCancel` for `SelectorType.Files` and `headerProps.onCloseClick` for `Room`, `People`, `Groups` and `Base`. Supply **both** and the selector closes whichever type it turns out to be; supply only one and half the selectors leak a dead aside.
- **A selector opened while your modal is open is unreachable.** The portal renders each of its surfaces from its own visibility flag, side by side and uncoordinated, so nothing stops two from being open at once — and the modal's backdrop then covers the selector aside: the user sees it, dimmed, and cannot touch it. The portal's own dialogs avoid this by swapping the selector *into* the dialog, which a plugin cannot do because it does not own those props. So `closeModal()` first, open the selector, and reopen the modal from `onSubmit` and from the close handler, holding the form's values in module scope so nothing is lost across the round trip. The same applies to any pair: **one portal-drawn surface at a time**, and it is your job to sequence them.
- Only the props the type declares reach the host; anything cast in is dropped.
- `TFilesSelector.getIsDisabled({ isFirstLoad, isRoot, selectedItemId, … })` is **required**; its boolean disables submit.
- **A helper that builds one needs its return type written out.** `TSelector` discriminates on `type`, and `SelectorType.Files` in an unannotated literal widens to plain `SelectorType`, which matches no branch: `const pick = () => ({ type: SelectorType.Files, props })` will not assign. Inline it compiles; behind a helper write `(): IMessage =>`, or `(): TSelector =>` for the props alone.

**One surface at a time, sequenced by hand.** The round trip below is what a "pick a destination" field in a dialog costs, and it is the same three steps for any pair of portal surfaces. The form's values live in module scope because the dialog is unmounted and remounted, and every exit from the selector — submit *and* close — has to reopen the dialog, or the user is left with nothing on screen:

```ts
// Module scope: it survives the dialog's unmount, which component state does not.
const draft: { targetId: number | null; targetTitle: string; name: string } = { targetId: null, targetTitle: "", name: "" };

const exportDialog = (): IModalDialog => ({
  dialogHeader: t("export.title"),
  dialogBodyComponent: ExportDialog,     // reads and writes `draft`; renders draft.targetTitle in the field
  autoMaxHeight: true,
});

/** Called from the dialog's "Choose…" button. */
const pickDestination = ({ showModal, showSelector, closeModal, closeSelector }: PluginActions) => {
  closeModal();                          // first: the dialog's backdrop would cover the selector

  const cancel = () => { closeSelector(); showModal(exportDialog()); };   // cancel must return too

  showSelector({
    type: SelectorType.Files,
    props: {
      submitButtonLabel: t("export.choose"),
      getIsDisabled: ({ isRoot, selectedItemId }) => isRoot || !selectedItemId,
      onSubmit: ({ selectedItemId, folderTitle }) => {
        draft.targetId = Number(selectedItemId);
        draft.targetTitle = folderTitle;
        closeSelector();
        showModal(exportDialog());       // back to the dialog, now showing the choice
      },
      withHeader: true,                  // without it there is no title and no close cross
      onCancel: cancel,                  // the Files selector's cross calls this one
      headerProps: { label: t("export.pickFolder"), isCloseable: true, onCloseClick: cancel },
    },
  });
};
```

From a class-side callback the same sequence is two messages instead of two calls: return `showSelector` from the click, and return `showModal` from the selector's own `onSubmit`.

```ts
showSelector({
  type: SelectorType.People,
  props: {
    submitButtonLabel: t("notify"),
    onSubmit: ({ selectedIds }) => { setRecipients(selectedIds); closeSelector(); },
    withHeader: true,
    onCancel: () => closeSelector(),
    headerProps: { label: t("pickPeople"), isCloseable: true, onCloseClick: () => closeSelector() },
  },
});
```

## The create-file dialog

`showCreateDialog({ title, startValue, visible: true, isCreateDialog: true, extension: ".myext", onSave, onCancel, onClose })` is the portal's own "create file" dialog — focus, validation and buttons for free; the right thing for a `File`-scope "new file" flow. `onSave(e, value)` returns an `IMessage`; if it throws, `onError` is awaited. **`extension` is not appended for you** — it only drives the "don't ask again" checkbox; append it yourself, and create the file with `enableExternalExt: true` ([rest-api.md](rest-api.md#creating-a-file-whose-extension-the-portal-does-not-own)). `options`/`selectedOption`/`onSelect` add a combobox under the field.

## Media viewer

```ts
showMediaViewer({
  title: file.title,
  component: Preview,                                  // reads the file on screen with useCurrentFile()
  playlistFilter: { filesExsts: [".png", ".jpg"], filesSecurity: [FilesSecurity.Read] },
  onClose: () => ({ actions: [Actions.closeMediaViewer] }),
});
```

The component re-renders as the user pages, so `navigation.onFileChange`/`onLoad` are not needed — fetch in an effect keyed on `file?.id`. `playlistFilter` narrows what the viewer pages through — `filesExsts` (case-insensitive, dot optional), `filesSecurity` (every key must be allowed), and also `usersTypes` and `devices`. Those last two are not per-file tests: they compare the *current* user role and device, so they either let the whole playlist through or empty it. Without a filter the folder's full media playlist is used. Bytes come from the file's `viewUrl`, which answers 404 until the file has been written once ([rest-api.md](rest-api.md#a-files-contents-are-not-part-of-the-api)).

## The floating operations button

The portal's progress button (downloads, conversions) accepts plugin entries — the way to show progress without holding a surface open, and it works from a component and from a class-side callback alike ([below](#work-that-takes-a-while)).

```ts
const op = (percent: number, completed = false) => ({
  id: "my-plugin-export",
  operationsCompleted: completed,   // ← the field the portal watches; the one below only draws the row
  operations: [{ id: "export", label: t("exporting"), operation: FloatingOperationType.Other, alert: false, completed, percent }],
});
addFloatingOperationsButton(op(0));
for (…) { await …; updateFloatingOperationsButton(op(pct)); }
updateFloatingOperationsButton(op(100, true));   // sets operationsCompleted - the portal takes it from here
```

- **Add before update.** `add` ignores an id already registered, `update` ignores one that is not — an update sent first is a silent no-op. `update` takes the whole props object again.
- **Two different `completed` fields, and only the outer one ends the job.** `operations[i].completed` draws that row; **`operationsCompleted` on the button props** is what the portal reads. When it turns true the panel waits 4 seconds, plays its hide animation, and on the animation's end clears every operation the plugin registered — so the button removes *itself*, and the entry stops claiming to be running. Set only the inner `completed` and the button never leaves: the job is over, the label still reads "…ing", and it stays there until the page is reloaded. Nothing catches this — the validator sees a correct add/update sequence and a render pass has no panel — so it is worth re-reading the last `update` you write against this bullet.
- **The finished wording is the portal's, not yours.** At completion it renders your operation `label` inside its own phrase — `"{{label}}: Done"`, or `"{{label}}: Error"` in the error path — so the label wants to be a plain name of the work ("Archiving rooms"), never rewritten to the past tense on the last update.
- **The 4-second dismissal waits for the user.** It does not run while the pointer is over the button or while the operations dropdown is open, which is deliberate: the completed state is readable before it goes.
- **`onLoad` is the class's handle on the button.** `IFloatingOperationsButton.onLoad?: (dispatchMessage) => …` is called by the host once the entry appears, and it is handed the same dispatcher a callback's returned `IMessage` goes through. Keep that function and a class-side job can send `updateFloatingOperationsButton` as often as it likes, from its own loop, with nothing mounted — see [below](#work-that-takes-a-while). It fires once per `id` while the Files page is mounted, and again after the entry has been cleared, so treat it as "the button now exists" rather than "start the work here".
- **Give the button an id nobody else will use** — prefix it with the manifest `name`, as with item keys. The host tracks entries by the bare `id`, so two plugins that both call theirs `export` write over each other's progress.
- `remove` takes the button `id` as a bare string (`floatingOperationsButtonPropsId` class-side). The normal end of a job needs no `remove` — reach for it to drop the button *early*, or from a cleanup when the surface goes away with the work still unfinished.
- Operation ids are prefixed by the host with the plugin name; `onCancelOperationFromList(operationId)` hands back your unprefixed id. `cancelOperation` fires for "cancel all". Dismissing the button drops all your operations.
- `FloatingOperationType`: `Download`, `Convert`, `Copy`, `Upload`, `Backup`, … or `Other`.

## Work that takes a while

Packing an archive, walking a room, converting a batch: anything past a second or two. Two shapes fit it, and the question that picks between them is whether the user needs a **surface** — something to look at or interact with while it runs — not where the click came from.

**No surface: run it from the class, and report through the progress button's `onLoad`.** A callback returns one `IMessage` and cannot send a second, but `addFloatingOperationsButton` carries an `onLoad` the host calls with its dispatcher, and holding that function is holding a channel back to the portal for as long as the plugin wants one. So a menu item that exports a folder needs no modal at all:

```ts
let dispatch: ((message: IMessage) => void) | null = null;
const BUTTON = "my-plugin-export";                       // manifest-prefixed: the host keys buttons by bare id

const button = (percent: number, completed = false, alert = false): IFloatingOperationsButton => ({
  id: BUTTON, operationsCompleted: completed, operationsAlert: alert,
  operations: [{ id: "export", label: t("export.running"), operation: FloatingOperationType.Other, alert, completed, percent }],
  onLoad: (dispatchMessage) => { dispatch = dispatchMessage; },
});

const progress = (percent: number, completed = false, alert = false) =>
  dispatch?.({ actions: [Actions.updateFloatingOperationsButton], floatingOperationsButtonProps: button(percent, completed, alert) });

onItemClick = async (id: number): Promise<IMessage> => {
  void (async () => {                                     // the work outlives the message
    try {
      for (const [i, file] of (await listFiles(id)).entries()) { await pack(file); progress(pct(i)); }
      progress(100, true);
    } catch { progress(100, true, true); }                 // finish, flagged: the portal renders "…: Error"
  })();
  return { actions: [Actions.addFloatingOperationsButton], floatingOperationsButtonProps: button(0) };
};
```

The loop is unguarded by anything — the callback has already returned, so a throw escaping that `catch` is an unhandled rejection and the button stays at whatever percent it reached. And the plugin owns the whole lifetime: nothing unmounts, so nothing cancels for you.

**A surface: the work goes in its effect, and the effect can run twice.** When there *is* something to show — a preview, a per-row log, a form the job reads — the click opens the modal or page and hands over the id, and the component runs the work. React remounts effects (development double-invoke, a re-render with changed deps, the user reopening the panel), and a second run of "pack these 400 files" is duplicated writes rather than a slow render. Guard the start, own the cancellation, and never leave the button behind:

```tsx
const ExportPanel = () => {
  const { addFloatingOperationsButton, updateFloatingOperationsButton, removeFloatingOperationsButton, showToast } = usePluginActions();
  const api = usePluginAPI();
  const started = useRef(false);              // module scope if the work must survive a remount

  useEffect(() => {
    if (started.current) return;              // the second invocation is not a second job
    started.current = true;

    const controller = new AbortController();
    const BUTTON = "my-plugin-export";         // manifest-prefixed: the host keys buttons by bare id
    const button = (percent: number, completed = false, alert = false) => ({
      id: BUTTON,
      operationsCompleted: completed,          // the portal's own dismissal hangs off this one
      operationsAlert: alert,
      operations: [{ id: "export", label: t("export.running"), operation: FloatingOperationType.Other,
                     alert, completed, percent }],
    });
    // Ended: the portal shows "…: Done" (or "…: Error"), waits, and clears the entry itself.
    const finish = (alert = false) =>
      updateFloatingOperationsButton(button(100, true, alert));

    (async () => {
      addFloatingOperationsButton(button(0));  // add first, or every update is a no-op
      try {
        let percent = 0;
        for (let i = 0; i < files.length; i += 1) {
          // Abandoned, not finished - finish() here would announce "Done" over a partial job.
          if (controller.signal.aborted) return removeFloatingOperationsButton(BUTTON);
          await pack(api, files[i], controller.signal);

          const next = Math.round(((i + 1) / files.length) * 100);
          if (next > percent) updateFloatingOperationsButton(button((percent = next)));   // whole percents only
        }
        finish();
        showToast({ type: ToastType.success, title: t("export.done") });
      } catch (e) {
        finish(true);   // never leave it spinning: an unfinished entry is never dismissed
        showToast({ type: ToastType.error, title: isPluginApiError(e) ? e.message : t("export.failed") });
      }
    })();

    // No remove() here: a finished job is already on its way out, and one still writing keeps its
    // button - that is the only place it reports, so the surface closing must not take it away.
    return () => controller.abort();
  }, []);

  return <Text>{t("export.running")}</Text>;
};
```

- **The user closing the surface does not stop the work** — only the `AbortController` in the cleanup does, and only for what takes the signal. Decide deliberately which it should be: a half-written archive is worse than a slow one, so a job that writes usually finishes and reports through the toast, while a read-only walk aborts.
- **Rate-limit the updates.** One `updateFloatingOperationsButton` per file on 400 files is 400 re-renders of the portal's own button; update on whole percents.
- **Nothing wraps the effect.** An uncaught throw blanks the component ([react.md](react.md#errors-loading-language-styling)), so the `catch` is what turns a failure into a message instead of an empty panel.


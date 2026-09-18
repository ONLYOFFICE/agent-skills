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

- **Size.** `modal` is 400px wide and capped at **280px high** unless `autoMaxHeight`; `aside` is 480px and full height; the portal leaves the kit's body scroll off for a plugin aside, so a long panel needs an overflow region of its own (below). `autoMaxWidth` + `autoMaxHeight` hand sizing to the body — **a large dialog is an ordinary modal with both flags** and a width on the component's root. The kit's `isLarge`/`isHuge` are not forwarded. `fullScreen: true` is not a bigger modal: an opaque full-viewport div with no header, padding or close control — right on a phone, wrong on a desktop.
- **No footer slot.** Render the action row in the body: `Button primary scale`, then the cancel, 8px apart; call `closeModal()` from both.
- **An aside scrolls only where you give it the region.** Its body has a definite height, so a percentage resolves: root `display: flex; flex-direction: column; height: 100%`, the scrolling part `flex: 1 1 auto; min-height: 0; overflow: auto`, anything held out of it `flex: 0 0 auto`. A modal's body is sized by its content and needs none of this.
- **An aside has no vertical padding and no gap under its header.** The kit scopes both 16px rules to `.displayTypeModal`, so an aside body is `padding: 0 16px` under a 53px header block: the first line sits against the header, and with the `height: 100%` above, the last one sits on the bottom edge. Give the root `padding-block: var(--modal-dialog-padding-y, 16px)` and `box-sizing: border-box`. The *side* padding is there, so a divider meant to span the full 480px has to cancel it — `margin-inline: calc(var(--modal-dialog-padding-x, 16px) * -1)`, the padding put back on the inside. Keep those fallbacks: the kit declares both variables on the modal wrapper, which the browser pass never renders — and that pass gives a dialog a bare box with neither the aside's padding nor its height, so it cannot show either defect.
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

`showSelector({ type: SelectorType.x, props })` opens the portal's picker as an aside; the shape is the same from a component and from a class-side `IMessage`. Five types — what each hands back, and who enables Submit, is where the mistakes are:

| `SelectorType` | Props | `onSubmit` receives | Submit enabled by |
|---|---|---|---|
| `Files` | `TFilesSelector` | `{ selectedItemId, folderTitle, fileName, selectedFileInfo, breadCrumbs, isChecked }` — **`selectedItemId` is the folder being browsed, `selectedFileInfo` the clicked file** ([below](#the-files-selector-folder-vs-file)) | your **required** `getIsDisabled` |
| `Room` | `TRoomSelector` | `(selectedIds: (string \| number)[])` — an array even for one room; `isMultiSelect` works. A room id is its folder id | the kit, once a room is selected (multi-select: once the selection changed) |
| `People` | `TPeopleSelector` | `{ selectedIds, fileName, isFooterCheckboxChecked }` — user GUIDs, group GUIDs too under `withGroups`; the other two fields stay empty | the kit once someone is selected, and your `disabledSubmitButton` |
| `Groups` | `TGroupsSelector` | `{ selectedIds }` — one group GUID; single-select only | the kit, once a group is selected |
| `Base` | `TBaseSelector` — your own `items: { id, label, icon? }[]` | `{ selectedIds, fileName, isFooterCheckboxChecked }` — your ids | **only** your `disabledSubmitButton`; the kit never disables it, so refuse an empty `selectedIds` in `onSubmit` |

- **A header needs `withHeader: true`**, not just `headerProps`; without it there is no title and no close cross.
- **Nothing closes itself.** Call `closeSelector()` from `onSubmit` and from the cancel path — `onCancel` for `Files`, `headerProps.onCloseClick` for the other four; supply both and every type closes. An `onSubmit` that refuses its input returns nothing (plus a toast) and the selector stays open.
- **One portal surface at a time.** A selector opened over your modal sits behind its backdrop, visible and dead: `closeModal()`, open the selector, reopen the modal from `onSubmit` *and* from the cancel path, with the form's values in module scope ([below](#from-a-dialog-one-surface-at-a-time)). From a page nothing needs sequencing, so a picker can simply be awaited.
- **Only the props the type declares reach the host.** `Room`: `roomType`, `searchArea`, `excludeItems`, `withSearch`, `withCreate` with `createDefineRoomLabel`/`createDefineRoomType`. `People`: `roomId` + `onlyRoomMembers`, `withGroups`/`isGroupsOnly`, `withGuests`/`isGuestsOnly`, `excludeItems`, `currentUserId`, `disableDisabledUsers`, `disableInvitedUsers`, `alwaysShowFooter`. `Groups`: the header and nothing else — no cancel button, no search. `Base`: paging (`totalItems`, `hasNextPage`, `onLoadNextPage`), `isMultiSelect`, `maxSelectedItems`, `selectedItems`, breadcrumbs, `onSelect({ selectedId, isDoubleClick })`, an inline input row (`isInputItem`) and a "create new" row (`isCreateNewItem`), `icon` as an asset file name resolved like item icons — and no search.
- **Ids come back `string | number`; keep them so** ([rest-api.md → Identifiers](rest-api.md#identifiers)).
- **A helper that builds one needs its return type written out.** `TSelector` discriminates on `type`, and `SelectorType.Files` in an unannotated literal widens to plain `SelectorType`, which matches no branch: `const pick = () => ({ type: SelectorType.Files, props })` will not assign. Inline it compiles; behind a helper write `(): IMessage =>`, or `(): TSelector =>` for the props alone.

### The Files selector: folder vs file

Entering a folder sets `selectedItemId` to it (and `selectedItemType` to `"rooms"` on the rooms list, `"files"` inside); clicking a file leaves `selectedItemId` on the folder and fills `selectedFileInfo` (`{ id, title, fileExst }`). Both are current in `onSubmit`.

- **Gate on the folder, verify the file in `onSubmit`.** `getIsDisabled` sees `selectedFileInfo` one render after the click, and on portals before January 2026 never — a Select gated on it is dead there. Gate on `isFirstLoad || !selectedItemId || selectedItemType === "rooms"`; in `onSubmit` a `null` `selectedFileInfo` gets a toast and no return.
- `filterParam` filters what is *listed*, not what can be submitted. `FilterType` (`None 0`, `FilesOnly 1`, `FoldersOnly 2`, `DocumentsOnly 3`, `PresentationsOnly 4`, `SpreadsheetsOnly 5`, `ImagesOnly 7`) is **not exported from the SDK root** and a deep import is refused: `const DOCUMENTS_ONLY: TFilesSelector["filterParam"] = 3`.
- `selectedFileInfo` is `{ id, title, fileExst }` and `@inline` in the SDK — declare your own type where you store it; anything more is `GET /files/file/{id}`.

**Pick a document, pick a destination, copy, open**, from a page — awaited, one selector at a time, every exit resolving once:

```ts
type Picked = { id: string | number; title: string };
const DOCUMENTS_ONLY: TFilesSelector["filterParam"] = 3;

export const pickDocument = ({ showSelector, closeSelector, showToast }: PluginActions, label: string) =>
  new Promise<Picked | null>((resolve) => {
    let done = false;
    const finish = (value: Picked | null) => { if (!done) { done = true; resolve(value); } };
    const cancel = () => { finish(null); closeSelector(); };

    showSelector({
      type: SelectorType.Files,
      props: {
        withHeader: true, headerProps: { label, isCloseable: true, onCloseClick: cancel },
        withBreadCrumbs: true, withSearch: true, withCancelButton: true, submitButtonLabel: t("select"),
        filterParam: DOCUMENTS_ONLY,
        getIsDisabled: ({ isFirstLoad, selectedItemId, selectedItemType }) =>          // the folder: always known
          isFirstLoad || !selectedItemId || selectedItemType === "rooms",
        onSubmit: ({ selectedFileInfo }) => {                                          // the file: checked here
          if (!selectedFileInfo) { showToast({ type: ToastType.warning, title: t("pickAFile") }); return; }
          finish({ id: selectedFileInfo.id, title: selectedFileInfo.title });
          closeSelector();
        },
        onCancel: cancel,
        onClose: () => finish(null),
      },
    });
  });
```

A destination picker differs in three places: no `filterParam`, `isDisabledFolder` in the gate, and an `onSubmit` that reads `GET /files/folder/{selectedItemId}` and refuses `security.Create !== true` with a toast — there, while another folder can still be picked. Then:

```ts
const template = await pickDocument(actions, t("pickTemplate"));       if (!template) return;
const folder = await pickFolder(actions, api, t("pickDestination"));    if (!folder) return;
const copy = await api.post<{ id: string | number }>(`/files/file/${template.id}/copyas`,
  { destFolderId: folder.id, destTitle: name });   // the id as the DTO gave it - rest-api.md → Identifiers
openInEditor(copy.id);                             // a page load, not navigate() - react.md → Opening a document
```

Progress and failure of the copy: the third shape in [Work that takes a while](#work-that-takes-a-while).

### From a dialog: one surface at a time

The round trip below is what a "pick a destination" field in a dialog costs, and it is the same three steps for any pair of portal surfaces. The form's values live in module scope because the dialog is unmounted and remounted, and every exit from the selector — submit *and* close — has to reopen the dialog, or the user is left with nothing on screen:

```ts
// Module scope: it survives the dialog's unmount, which component state does not.
const draft: { targetId: string | number | null; targetTitle: string; name: string } = { targetId: null, targetTitle: "", name: "" };

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
        draft.targetId = selectedItemId ?? null;   // as it arrived - a number for a portal folder
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

**Your component gets the whole viewport, and the viewer's chrome is drawn over it.** The content box is `position: fixed; inset: 0` on a dark background. Above it, fixed and at a higher z-index, sit a **64px header band** across the top — title, close cross at the top-right; it fades after 2.5 s without mouse movement and is back on the next move, so it is there whenever the user is about to click — and, when the playlist has more than one entry, two **73px-wide, full-height paging strips** at the left and right edges, transparent until hovered, the whole strip being the click target. Anything drawn under them cannot be reached: a play button in the bottom-left corner pages to the previous file instead of playing. Keep interactive controls out of 64px at the top and 73px at both sides — `padding: 64px 73px 0` on the root is the blunt fix — and remember that a test folder with a single matching file shows no strips at all, so the overlap appears only on a real folder.

- **Keys belong to the viewer while it is open.** A `keydown` listener on `document` takes ←/→ (previous/next), Esc (close), Ctrl+S (download) and **Delete (the portal's delete flow for the file on screen)**, and calls `preventDefault` on all four arrows, Esc, Delete and the `+`/`-`/`=` keys. An input inside the component loses its arrows and its Delete to the viewer; stop the event at your root — `onKeyDown={(e) => e.stopPropagation()}` — and it never reaches `document`.
- **On phones and tablets the content is a swipe surface.** No header band, no strips, but a horizontal drag past a quarter of the width pages and a downward drag past 120px closes, on the very element your component lives in (`touch-action: none`). Content that is itself dragged — a model being rotated, a canvas being panned — competes with that on touch devices; with a mouse the gestures are off.
- **The backdrop does not close a plugin viewer** — the content box fills it — so the cross, Esc and your own `closeMediaViewer()` are the exits, and `onClose` still has to return `closeMediaViewer`.
- The browser pass mounts the component full-width with none of this chrome, so nothing measures the overlap; check the surface on a portal, in a folder with two matching files.

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

**A few named steps on a page: show the step, not a percentage, and make "again" cheap.** Three to ten steps started by hand — pick, copy, fill, upload, open — are too short for the progress button and too long for a merely disabled button. So: a list with one running row and a visible spinner on it, the failed row carrying its error text, and the start button turning into "Run again", which begins from a clean slate so a stale "failed" cannot be read as the new one. State lives on the surface — the user is looking at it, and nothing outlives the page.

```tsx
type Step = { id: string; label: string };
type Status = "idle" | "running" | "done" | "failed";
type Report = (id: string, status: Status, error?: string) => void;

const StepRun = ({ steps, run }: { steps: Step[]; run: (report: Report, signal: AbortSignal) => Promise<void> }) => {
  const [state, setState] = useState<Record<string, { status: Status; error?: string }>>({});
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const failed = Object.values(state).some((s) => s.status === "failed");

  const start = async () => {
    setState({});                                           // a rerun starts clean
    setBusy(true);
    controller.current = new AbortController();
    const report: Report = (id, status, error) => setState((s) => ({ ...s, [id]: { status, error } }));
    try {
      await run(report, controller.current.signal);         // each step: report(id, "running"); …; report(id, "done")
    } catch (e) {                                           // the step that threw reports itself as failed with the message
      if (!(isPluginApiError(e) && e.code === "ABORTED")) report("run", "failed", isPluginApiError(e) ? e.message : t("run.failed"));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => () => controller.current?.abort(), []);   // leaving the page abandons the run

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {steps.map((step) => {
        const s = state[step.id];
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 24 }}>
            {s?.status === "running"
              ? <Loader type={LoaderTypes.oval} size="16px" color="var(--accent-main)" label={step.label} />   // the default type draws text, not a spinner
              : <Text color={s?.status === "failed" ? "var(--input-error-color)" : "var(--text-disable-color)"}>{s?.status === "done" ? "✓" : s?.status === "failed" ? "!" : "·"}</Text>}
            <Text>{step.label}</Text>
            {s?.error && <Text color="var(--input-error-color)">{s.error}</Text>}
          </div>
        );
      })}
      <Button primary scale size={ButtonSize.normal} isLoading={busy} isDisabled={busy}
              label={failed ? t("run.again") : t("run.start")} onClick={() => void start()} />
    </div>
  );
};
```

- **The failure stays on screen with its cause, and the inputs stay editable.** A "no permission" from a copy is fixed by picking another folder, so the pickers above the list are not disabled by a failed run — only by a running one.
- **A step that writes is not a step to retry blindly.** "Run again" after a copy that *did* succeed and an upload that failed would copy twice; either make the earlier steps idempotent (reuse the id the copy returned) or start the rerun at the failed step.


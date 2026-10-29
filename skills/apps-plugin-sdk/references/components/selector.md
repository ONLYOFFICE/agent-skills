# Selector

The portal's own picker — files, rooms, people, groups, or a list of the plugin's own items — opened as an aside.

| | |
|---|---|
| Types | [`TSelector`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/Selector.md) — one type per `SelectorType`, all on that page |
| Class side | `Actions.showSelector` / `updateSelector` / `closeSelector` with `selectorProps` |
| From a component | the same names on `usePluginActions()` |

Contents: [The five types](#the-five-types) · [The Files selector: folder vs file](#the-files-selector-folder-vs-file) · [From a dialog: one surface at a time](#from-a-dialog-one-surface-at-a-time)

## The five types

`showSelector({ type: SelectorType.x, props })` opens the portal's picker as an aside; the shape is the same from a component and from a class-side `IMessage`, and the props of each type are on [Selector](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/Selector.md). Five types — what each hands back, and who enables Submit, is where the mistakes are:

| `SelectorType` | Props | `onSubmit` receives | Submit enabled by |
|---|---|---|---|
| `Files` | [`TFilesSelector`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/Selector.md#tfilesselector) | `{ selectedItemId, folderTitle, fileName, selectedFileInfo, breadCrumbs, isChecked }` — **`selectedItemId` is the folder being browsed, `selectedFileInfo` the clicked file** ([below](#the-files-selector-folder-vs-file)) | your **required** `getIsDisabled` |
| `Room` | [`TRoomSelector`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/Selector.md#troomselector) | `(selectedIds: (string \| number)[])` — an array even for one room; `isMultiSelect` works. A room id is its folder id | the kit, once a room is selected (multi-select: once the selection changed) |
| `People` | [`TPeopleSelector`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/Selector.md#tpeopleselector) | `{ selectedIds, fileName, isFooterCheckboxChecked }` — user GUIDs, group GUIDs too under `withGroups`; the other two fields stay empty | the kit once someone is selected, and your `disabledSubmitButton` |
| `Groups` | [`TGroupsSelector`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/Selector.md#tgroupsselector) | `{ selectedIds }` — one group GUID; single-select only | the kit, once a group is selected |
| `Base` | [`TBaseSelector`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/Selector.md#tbaseselector) — your own `items: { id, label, icon? }[]` | `{ selectedIds, fileName, isFooterCheckboxChecked }` — your ids | **only** your `disabledSubmitButton`; the kit never disables it, so refuse an empty `selectedIds` in `onSubmit` |

- **A header needs `withHeader: true`**, not just `headerProps`; without it there is no title and no close cross.
- **Nothing closes itself.** Call `closeSelector()` from `onSubmit` and from both ways out: `onCancel` is the cancel button (and the `Files` header cross), `headerProps.onCloseClick` the header cross of the other types; supply both and every type closes. An `onSubmit` that refuses its input returns nothing (plus a toast) and the selector stays open.
- **One portal surface at a time.** A selector opened over your modal sits behind its backdrop, visible and dead: `closeModal()`, open the selector, reopen the modal from `onSubmit` *and* from the cancel path, with the form's values in module scope ([below](#from-a-dialog-one-surface-at-a-time)). From a page nothing needs sequencing, so a picker can simply be awaited.
- **Only the props the type declares reach the host** — the per-type lists are on the Selector page. Two absences worth knowing: `Groups` has the header and nothing else — no cancel button, no search — and `Base` has no search either; a `Base` item's `icon` is an asset file name, resolved like item icons.
- **Ids come back `string | number`; keep them so** ([rest-api.md → Identifiers](../rest-api.md#identifiers)).
- **A helper that builds one needs its return type written out.** `TSelector` discriminates on `type`, and `SelectorType.Files` in an unannotated literal widens to plain `SelectorType`, which matches no branch: `const pick = () => ({ type: SelectorType.Files, props })` will not assign. Inline it compiles; behind a helper write `(): IMessage =>`, or `(): TSelector =>` for the props alone.

## The Files selector: folder vs file

Entering a folder sets `selectedItemId` to it (and `selectedItemType` to `"rooms"` on the rooms list, `"files"` inside); clicking a file leaves `selectedItemId` on the folder and fills `selectedFileInfo` (`{ id, title, fileExst }`). Both are current in `onSubmit`.

- **Gate on the folder, verify the file in `onSubmit`.** `getIsDisabled` sees `selectedFileInfo` one render after the click, and on some portal builds never — a Select gated on it is dead there. Gate on `isFirstLoad || !selectedItemId || selectedItemType === "rooms"`; in `onSubmit` a `null` `selectedFileInfo` gets a toast and no return.
- `filterParam` filters what is *listed*, not what can be submitted; it takes [`FilterType`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/enums/Utility.md) from the SDK root (`FilterType.DocumentsOnly`). The enum has seven members and the portal understands more — the selector passes the value through, so PDF files (`22`), media (`12`), archives (`10`) or diagrams (`25`) go in as the number: `filterParam: 22 as FilterType`.
- `selectedFileInfo` is `{ id, title, fileExst }` and `@inline` in the SDK — declare your own type where you store it; anything more is `GET /files/file/{id}`.

**Pick a document, pick a destination, copy, open**, from a page — awaited, one selector at a time, every exit resolving once:

```ts
type Picked = { id: string | number; title: string };

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
        filterParam: FilterType.DocumentsOnly,
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
openInEditor(copy.id);                             // a page load, not navigate() - actions.md → Opening a document
```

Progress and failure of the copy: the third shape in [Work that takes a while](floating-operations-button.md#work-that-takes-a-while).

## From a dialog: one surface at a time

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
      getIsDisabled: ({ isFirstLoad, selectedItemId, selectedItemType }) =>
        isFirstLoad || !selectedItemId || selectedItemType === "rooms",   // a folder, not the rooms list
      onSubmit: ({ selectedItemId, folderTitle }) => {   // a real destination also refuses security.Create !== true here, as above
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

From a class-side callback there are no hooks, so each step is a returned message instead of a call, and one `IMessage` carries several actions, each with its payload: the click returns `showSelector`, and the selector's `onSubmit` returns `closeSelector` and `showModal` together. A menu item that picks people, then opens a dialog about them:

```ts
// Module scope: the selector's answer, read by the dialog that opens after it.
let recipients: (string | number)[] = [];

const notifyDialog = (): IModalDialog => ({
  dialogHeader: t("notify.title"),
  dialogBodyComponent: NotifyDialog,     // reads `recipients`
  autoMaxHeight: true,
});

const closePicker = (): IMessage => ({ actions: [Actions.closeSelector] });

/** Returned from the menu item's click. */
const pickRecipients = (): IMessage => ({
  actions: [Actions.showSelector],
  selectorProps: {
    type: SelectorType.People,
    props: {
      submitButtonLabel: t("notify.choose"),
      withHeader: true,                  // without it there is no title and no close cross
      headerProps: { label: t("notify.pickPeople"), isCloseable: true, onCloseClick: closePicker },
      withCancelButton: true,            // without it onCancel is never wired
      onCancel: closePicker,
      onClose: closePicker,              // a click on the backdrop
      onSubmit: ({ selectedIds }) => {
        recipients = selectedIds;
        return { actions: [Actions.closeSelector, Actions.showModal], modalDialogProps: notifyDialog() };
      },
    },
  },
});
```

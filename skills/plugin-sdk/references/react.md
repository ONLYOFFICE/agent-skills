# The React runtime

How a plugin component is rendered, what it can reach, and the portal-provided UI it can open. Verified against the DocSpace client this skill targets; where the SDK's types and the host's behaviour differ, both are stated.

Contents: [Where components render](#where-components-render) · [Hooks](#the-hooks) · [What `useCurrentFile` returns where](#what-usecurrentfile-returns-where) · [Actions](#actions) · [API client](#the-api-client) · [Settings client](#the-settings-client) · [Modals](#modals) · [Portal-provided UI](#portal-provided-ui) · [Errors, loading, language, styling](#errors-loading-language-styling) · [Bundling](#bundling)

## Where components render

The portal wraps the component in the runtime provider and an error boundary and mounts it in its own React tree — same React, theme and direction as the page.

| Prop | Surface | What the host provides |
|---|---|---|
| `IArticleNavigationItem.component` | a full page at `/p/<key>` (under the section's path) | the section body — full width, scrolls; no heading, no padding (20px padding, a `Heading`, ~640px max text width read well) |
| `IInfoPanelItem.component` | body of an info panel tab | ~337px wide, already scrolls; the file/room title block above it, which only `isHeaderVisible: false` removes ([items.md](items.md#infopanel)) |
| `IArticleButtonItem.component` | a 32×32 slot in the sidebar, `overflow: hidden` | nothing — a single `IconButton size={32}` is what fits |
| `IModalDialog.dialogBodyComponent` | body of a modal or aside | header from `dialogHeader`, close cross, padding; **no footer slot** |
| `IMediaViewer.component` | the media viewer's content area | the viewer's chrome, full screen |
| `ISettings.component` | the plugin's settings aside | header, then the plugin's metadata below your component behind a separator the portal draws itself, a Save/Cancel footer |

`component` is the component itself, never an element (`component: Panel`, not `<Panel />`). Components receive **no props** — everything comes from hooks, module scope or closures.

**On a page, holding the width is your job.** The portal mounts the component with no markup of its own — an error boundary and the runtime provider, nothing else — directly inside the section body, whose only width guard is `max-width: 100vw`. That cap is measured against the viewport, so it does not subtract the sidebar the page sits beside: content wider than the space actually available is stopped by nothing and drags a horizontal scrollbar across the whole portal. Give the root `width: 100%; max-width: 100%; box-sizing: border-box` and `min-width: 0`, and keep every pixel `min-width` inside its own `overflow-x: auto` box. A single control that refuses to shrink does this as thoroughly as a wide table — and it is the harder one to see, because the page looks right until the window narrows.

## The hooks

All from `@onlyoffice/docspace-plugin-sdk/react`. They read a context the portal provides around the component, so they **throw outside one** — at module scope, in a class-side callback (`onItemClick`, `onClick`, `eventHandler`), in `onLoadCallback`.

| Hook | Returns |
|---|---|
| `useCurrentFile()` | `TCurrentFile \| null` — `{ id, title, fileExst?, isFolder?, isRoom?, roomType? }`; `fileExst` keeps the dot |
| `useCurrentUser()` | `TCurrentUser \| null` — `{ id, displayName, email, isOwner, isAdmin, isRoomAdmin }`; `null` while the profile loads |
| `usePluginActions()` | the [actions](#actions) object |
| `usePluginAPI()` | the [API client](#the-api-client) |
| `usePluginSettings()` | the [settings client](#the-settings-client) |
| `usePluginRuntime()` | all of the above as `{ currentFile, currentUser, actions, api, settings }` |

The runtime object is rebuilt only when the current file or user changes, so `api`, `actions` and `settings` are stable in effect dependencies.

## What `useCurrentFile` returns where

| Component rendered as | `useCurrentFile()` |
|---|---|
| Info panel tab | the selected file/folder/room, live |
| Media viewer | the file on screen, updates as the user pages |
| Modal opened from **another component** via `showModal` | that component's current file |
| Modal opened from a **class-side callback** (context menu, main button, file click, event) | **`null`** — the message carries no selection |
| Sidebar page, sidebar button, settings page | `null` |

So a menu action that opens a modal about the clicked file hands the id over itself — a module variable or a factory closing over it:

```ts
let targetId: string | number | null = null;

const item: IContextMenuItem = {
  key: "my-plugin-details", label: t("details"), icon: "icon-16.svg",
  onItemClick: (id) => {
    targetId = id;
    return { actions: [Actions.showModal], modalDialogProps: { dialogHeader: t("details"), dialogBodyComponent: DetailsModal } };
  },
};

function DetailsModal() {
  const api = usePluginAPI();   // read targetId here, e.g. api.get(`/files/file/${targetId}`)
}
```

## Actions

A class-side callback returns an `IMessage` — `{ actions: [Actions.x, …], <payload field> }` — and the host does nothing for an action whose payload field is missing. A component calls the same actions as functions on `usePluginActions()`, with the payload as the argument.

| `Actions.` | Payload field (class-side) | Function (component) | Notes |
|---|---|---|---|
| `showToast` | `toastProps: IToast[]` | `showToast({ type, title })` | `type` from `ToastType`; `title` is the toast **body** — the heading is the portal's word for the type. Top-right, 5 s, `withCross`/`timeout` are ignored |
| `showModal` / `closeModal` | `modalDialogProps` (with `dialogBodyComponent`) / — | `showModal(props)` / `closeModal()` | see [Modals](#modals); one dialog at a time |
| `showSelector` / `updateSelector` / `closeSelector` | `selectorProps` | same names | see [Selectors](#selectors) |
| `showCreateDialogModal` / `updateCreateDialogModal` | `createDialogProps` | `showCreateDialog(props)` | see [Create-file dialog](#the-create-file-dialog) |
| `showMediaViewer` / `updateMediaViewer` / `closeMediaViewer` | `mediaViewerProps` (with `component`) | same names | see [Media viewer](#media-viewer) |
| `addFloatingOperationsButton` / `updateFloatingOperationsButton` / `removeFloatingOperationsButton` | `floatingOperationsButtonProps` / same / `floatingOperationsButtonPropsId` (a bare string) | same names | see [Progress button](#the-floating-operations-button) |
| `navigate` | `navigatePath` | `navigate(path)` | an absolute portal path — the ones worth knowing are [below](#paths-navigate-takes). The SDK's doc says later actions run once navigation finishes; the host does not sequence anything (the action loop is a synchronous `forEach`), so the next action fires immediately, against the page you are leaving |
| `openInfoPanel` | `infoPanelTab?` | `openInfoPanel(tab?)` | `"info_details"`, `"info_members"`, `"info_history"`, `"info_share"`, `"info_ai_chat"`, or the `key` of your own info-panel item. **It closes your modal, aside, settings aside and selector first** — the panel is not a second surface beside them, so anything the user was filling in is gone. Pass your `key` unprefixed; the host makes `info_plugin-<key>` itself. To send someone from a list into an item with your tab already open, this is the pair to use — `navigate(path)` then `openInfoPanel(key)` — not a modal reproducing the tab, which would show the row's data in a surface the user cannot act on |
| `sendPostMessage` | `postMessage` | — | the target iframe must be in the DOM |
| `saveSettings` | `settings` | — (use `usePluginSettings().save()`) | |
| `updateProps` / `updateContext` | `newProps` / `contextProps` | — | SDK 2 declarative trees only; **silently ignored** elsewhere, never an error |
| `updateStatus` | none | — | class-side only: it is an `Actions` member with no counterpart in the runtime a component gets |
| `update*Items` (`updateContextMenuItems`, `updateInfoPanelItems`, `updateMainButtonItems`, `updateProfileMenuItems`, `updateFileItems`, `updateEventListenerItems`, `updateArticleButtonItems`, `updateArticleNavigationItems`) | none | same names | make the portal re-read the plugin's map for that scope |

An event handler (`EventListener`) is not limited by the host — its message goes through the same dispatcher as any other class-side callback, so a modal, a selector, `navigate` and the progress button all work from it. Keep it to item updates anyway: the event fires when the portal *opens a dialog*, not when anything completed ([items.md](items.md#the-event-fires-when-the-dialog-opens)). The three actions no class-side callback can use are `updateProps`, `updateContext` and `updateCreateDialogModal` (see the table row above). There is no action for opening the settings aside (`openInfoPanel` closes it).

#### Paths `navigate` takes

Every portal section is a route ending in `/filter`, and an entity is that route with its id in the middle. Guessing gets you a redirect to the root.

**The path alone does not open a room — `?folder={id}` is what does.** The Files section tells "the rooms list" from "one room's contents" by the **query string**, not the path, so a path-only link is taken for the list and the address bar is rewritten from that state: a literal `/rooms/shared/undefined/filter?searchArea=…` is the signature. Repeat the id in both places.

| Where | Path |
|---|---|
| A room, by id | `/rooms/shared/{id}/filter?folder={id}` — archived: `/rooms/archived/{id}/filter?folder={id}` |
| A folder inside a room | the same shape with the folder's id — `/rooms/shared/{folderId}/filter?folder={folderId}` |
| The Rooms list / the Archive | `/rooms/shared/filter` / `/rooms/archived/filter` |
| My documents / Recent / Favourites / Trash | `/rooms/personal/filter` / `/recent/filter` / `/files/favorite/filter` / `/files/trash/filter` |
| Your own `ArticleNavigation` page | `/p/{key}` — under `Section.Accounts` `/accounts/p/{key}`, under `Section.Settings` `/portal-settings/p/{key}` |

Which of the two room paths a room takes is normally already known — you listed it with `searchArea` (`Active` or `Archive`), so carry that through to the link; sending someone to the wrong one shows an empty list rather than an error. Otherwise the room's own `rootFolderType` decides it, against `FolderType.Archive` = **20**, which is also the test that separates "archive this" from "restore this" ([portal.md](portal.md#silent-failures-in-the-ui-layer)). The SDK types the field as a bare `number` and exports no constant, so name your own (`const ARCHIVE_ROOT = 20`) rather than leaving a literal in a condition.

**Changing an item from a component is two steps:** mutate the map through the plugin instance, then ask for a redraw — `setState` cannot reach the class.

```ts
plugin.updateArticleNavigationItem({ ...pageItem, label: `Visits (${++visits})` });
updateArticleNavigationItems();
```

## The API client

`usePluginAPI()` goes through the portal's own HTTP layer — authentication, public-room token and 401 handling come for free; no `API` scope needed.

```ts
const api = usePluginAPI();
const folder = await api.get<{ files: TFile[]; total: number }>("/files/@my", { count: 20 });
const file = await api.post<TFile>(`/files/${folderId}/file`, { title: "Report.docx" });
await api.put(`/files/file/${id}`, { title: "Renamed.docx" });
await api.delete(`/files/file/${id}`, { deleteAfter: false });
const ops = await api.request<TOperation[]>({ method: "PUT", path: "/files/fileops/delete", data: { fileIds: [1] }, params: { returnSingleOperation: true } });
```

- **Paths are relative to the API base**, which already includes `/api/2.0`: `"/files/@my"`. An absolute URL, a protocol-relative `//host`, a `..` segment or a scheme-like first segment is refused before sending (`PluginApiError`, `code: "INVALID_PATH"`). **`"/api/2.0/…"` is not** — it passes validation and goes out with the prefix twice, so the failure you get is a 404 from the portal rather than a path error, which is the harder one to read.
- **`patch` exists too**, alongside the four above and `request` for anything else.
- **The `response` envelope is unwrapped.** `api.get("/files/file/1")` resolves to the file; `.response` is `undefined`.
- **An endpoint carrying a top-level `total` resolves to `{ total, items }` — the rows are always under `items`, whatever the endpoint calls them.** The client rewraps that shape, so `api.get("/files/rooms/{id}/share").then((r) => r.folders)` is `undefined` with no error and the surface renders empty. It applies to the paged *collection* endpoints — room members, file links, `/people`, groups. Folder **contents** (`/files/{id}`, `/files/@my`, `/files/rooms`) carry their total inside the payload instead and arrive untouched, with `files`, `folders` and `total` as their own fields. Two shapes, so type the call you are making and check which one you got ([rest-api.md](rest-api.md#endpoints-to-start-from)).
- **Every failure is a `PluginApiError`**: `status` (0 when nothing reached the portal), `code` (`"ABORTED" | "NETWORK" | "INVALID_PATH"`), `request`, `details`, and `message` from the portal's own error text. Branch with `isPluginApiError(e) && e.status === 403`. A 403 does not navigate the user away as the portal's own requests do — you report it.
- **`signal`** in the options cancels; abort in the effect cleanup and ignore `code === "ABORTED"`.

```tsx
useEffect(() => {
  const controller = new AbortController();
  api.get<TRoomPage>("/files/rooms", undefined, { signal: controller.signal })
    .then((r) => setRooms(r.folders))
    .catch((e) => { if (!(isPluginApiError(e) && e.code === "ABORTED")) setError(isPluginApiError(e) ? e.message : t("loadFailed")); });
  return () => controller.abort();
}, [api]);
```

- **A `FormData` body goes through unchanged** — pass the form as `data` and set no `Content-Type` of your own, or the boundary is lost.

`api` is stable, so pass it into plain functions (`roomsApi(api).list(...)`) and keep React at the boundary. Give each domain two files: `rooms-api.ts`, which takes the client as an argument and imports nothing from React, and a hook beside it that is the only place calling `usePluginAPI()` —

```ts
export const useRooms = () => { const api = usePluginAPI(); return useMemo(() => roomsApi(api), [api]); };
```

A page that calls `usePluginAPI()` itself works, but every component that wants a request then has to know the client exists, and the request lands in the middle of the render logic where nothing can be tested or reused. **Do not stash it in a module variable**: the `/react` module is the host's single copy shared by every plugin and every mounted surface, so a module-level slot is neither private nor tied to one mount. The client's type is `PluginAPIClient` from the same subpath. Endpoint details, class-side `fetch` and file bytes are in [rest-api.md](rest-api.md).

**The client itself lives in the portal; the SDK ships only its type.** So no request written against `usePluginAPI()` can be exercised offline — the validator renders components but never lets one reach the network, and there is no local double for the HTTP layer. Anything about a request that only the portal can answer (a multipart body, a form field name, an unusual status) is therefore untested until it runs on a portal: keep such a call in one small function, check the path and the field names against the api-sdk types ([rest-api.md](rest-api.md#endpoints-to-start-from)), and say in the report that it is the part that was not verified locally.

## The settings client

`usePluginSettings()` — for `ISettings.component` and any component that wants a stored value.

| Method | Does |
|---|---|
| `load<T>()` | the stored object, or `null` when nothing was saved or the string is not JSON |
| `save(data)` | stores `JSON.stringify(data)`, then calls `setAdminPluginSettingsValue` on the class |
| `setSaveButton(button)` | supplies the aside's Save button — a `ButtonGroup` `{ component: Components.button, props: { label, size, onClick, isDisabled, withLoadingAfterClick, disableWhileRequestRunning } }` |

The portal owns the footer's Save/Cancel look, and it also overrides the button's `size`, `primary` and `scale` — what survives from the `ButtonGroup` is `label` (defaulting to "Save"), `isDisabled`, `isLoading`, `onClick`, `withLoadingAfterClick` and `disableWhileRequestRunning`.

**Without `setSaveButton` the Save button has no `onClick` and saves nothing** — for a React settings page, this is the call that makes the footer work. Make it in an effect that re-runs when the form changes; that is also how `isDisabled` tracks validity. After `onClick` resolves the portal closes the aside. The button state is per plugin and cleared on close.

`onClick` may also **return an `IMessage`**, which the host dispatches — a success or failure toast without reaching for a hook. (`ISettings.saveButton`, the static declaration beside `component`, still works and is not deprecated; it is the right choice only when the button never changes state — see [sdk-contract.md](sdk-contract.md#deprecated--do-not-use-in-new-code).)

```tsx
function SettingsPage() {
  const settings = usePluginSettings();
  const [config, setConfig] = useState<TConfig>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    settings.load<TConfig>().then((saved) => { if (saved) setConfig({ ...DEFAULTS, ...saved }); setLoaded(true); });
  }, [settings]);

  const invalid = config.webhook.length > 0 && !/^https:\/\//.test(config.webhook);

  useEffect(() => {
    if (!loaded) return;
    settings.setSaveButton({
      component: Components.button,                       // the SDK's Components and ButtonSize, not the kit's
      props: { label: t("save"), size: SdkButtonSize.normal, isDisabled: invalid, withLoadingAfterClick: true,
               onClick: async () => { await settings.save(config); } },
    });
  }, [settings, config, loaded, invalid]);

  if (!loaded) return <RectangleSkeleton height="120px" />;
  return (
    // No `gap` on the column: FieldContainer brings its own 16px bottom margin, and the two add up.
    <div style={{ display: "flex", flexDirection: "column" }}>
      <FieldContainer isVertical labelVisible labelText={t("webhook")} hasError={invalid} errorMessage={t("httpsOnly")}>
        <TextInput type={InputType.text} value={config.webhook} onChange={(e) => setConfig({ ...config, webhook: e.target.value })} scale hasError={invalid} />
      </FieldContainer>
      {/* ToggleButton has no intrinsic size, so the wrapper supplies the height and refuses to flex. */}
      <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center", flex: "0 0 auto" }}>
        <ToggleButton label={t("notify")} isChecked={config.notify} onChange={() => setConfig({ ...config, notify: !config.notify })} />
      </div>
    </div>
  );
}
```

Registered with `this.setAdminPluginSettings({ component: SettingsPage })` in `onLoadCallback`. Class-side code reads stored values in `setAdminPluginSettingsValue` — a string, arriving after installation; parse in `try/catch`.

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

- **The body inherits `white-space: pre-line`.** Composed JSX does not notice; markup you *generate* does — see the CSS note in [portal.md](portal.md#what-actually-breaks-the-portal).

## Portal-provided UI

The portal's own pickers, create dialog, progress button and media viewer are open to plugins. Reach for them before building a list, a file-name prompt or a progress modal of your own — they carry the portal's search, paging, validation and look.

### Selectors

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

### The create-file dialog

`showCreateDialog({ title, startValue, visible: true, isCreateDialog: true, extension: ".myext", onSave, onCancel, onClose })` is the portal's own "create file" dialog — focus, validation and buttons for free; the right thing for a `File`-scope "new file" flow. `onSave(e, value)` returns an `IMessage`; if it throws, `onError` is awaited. **`extension` is not appended for you** — it only drives the "don't ask again" checkbox; append it yourself, and create the file with `enableExternalExt: true` ([rest-api.md](rest-api.md#creating-a-file-whose-extension-the-portal-does-not-own)). `options`/`selectedOption`/`onSelect` add a combobox under the field.

### Media viewer

```ts
showMediaViewer({
  title: file.title,
  component: Preview,                                  // reads the file on screen with useCurrentFile()
  playlistFilter: { filesExsts: [".png", ".jpg"], filesSecurity: [FilesSecurity.Read] },
  onClose: () => ({ actions: [Actions.closeMediaViewer] }),
});
```

The component re-renders as the user pages, so `navigation.onFileChange`/`onLoad` are not needed — fetch in an effect keyed on `file?.id`. `playlistFilter` narrows what the viewer pages through — `filesExsts` (case-insensitive, dot optional), `filesSecurity` (every key must be allowed), and also `usersTypes` and `devices`. Those last two are not per-file tests: they compare the *current* user role and device, so they either let the whole playlist through or empty it. Without a filter the folder's full media playlist is used. Bytes come from the file's `viewUrl`, which answers 404 until the file has been written once ([rest-api.md](rest-api.md#a-files-contents-are-not-part-of-the-api)).

### The floating operations button

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
- **Nothing wraps the effect.** An uncaught throw blanks the component ([below](#errors-loading-language-styling)), so the `catch` is what turns a failure into a message instead of an empty panel.

## Errors, loading, language, styling

- **Errors are contained and silent.** A throw in render or an effect renders the component as **nothing**, with one console line `[Plugin: <name>] <error>`. A blank tab/page/modal is the symptom of a bug; `catch` and show text instead. Rejections in event handlers are not caught by the boundary.
- **Loading is yours.** No `onLoad`: render a `RectangleSkeleton`/`Loader` while the effect runs, and do not try to pre-load in `onLoadCallback` ([portal.md](portal.md#what-actually-breaks-the-portal)).
- **Language.** Components call `t()` at render time. A language change reloads the whole plugin as a fresh module, so no labels need rebuilding — but module-scope timers and listeners survive the reload and pile up ([sdk-contract.md](sdk-contract.md#localisation)).
- **Styling.** The kit's props first, then inline `style`, then a stylesheet for what inline `style` cannot express — `:hover`/`:focus`, pseudo-elements, keyframes, media queries, or markup you did not author. A `.css` import becomes `plugin.css`, injected into the portal's **own document, unscoped**, so it has to be scoped by hand — see [Scoped CSS](#scoped-css). Colors come from the theme variables in [ui-kit.md](ui-kit.md#colors).

### Scoped CSS

`plugin.css` lands in the portal's `<head>` *after* the portal's own stylesheets, so at equal specificity your rule wins: an unprefixed `pre {}` or `.card {}` restyles the product itself ([portal.md](portal.md#what-actually-breaks-the-portal)). **Nothing checks the rules** — the validator only reports how the stylesheet is imported and built — so this is read by hand or made impossible by construction:

- **A CSS module** — `styles.module.css`, imported as `import styles from "./styles.module.css"` and used as `className={styles.row}`. The build hashes every class name, so there is nothing to remember and nothing to get wrong. **Prefer this**: it is the only form that cannot go wrong unread. The generated `vite.config.ts` builds `css.modules.generateScopedName` out of the manifest `name` so the hashed classes carry the plugin's prefix too; a hand-written config needs the same line.
- **A prefix on every class**, taken from the manifest `name` (`archive-manager` → `.archive-manager-row`) — for a plain `.css` file, which the validator can only warn about. Never a bare type selector, `*`, `:root`, `html` or `body` at the top level, and never an unprefixed class: those match the portal's DOM, not yours.

Only the **leftmost** selector has to carry the scope; descendants inside a root you own are free, and that is how generated markup gets styled:

```css
.archive-manager-tree { display: grid; gap: 4px; }
.archive-manager-tree pre { white-space: pre; }
.archive-manager-row:hover { background: var(--button-background-hover); }
```

Custom properties go on your own root, never `:root`. Keyframe names are global too — prefix them. Reviewing a plugin, read every rule in its `.css` against this section; a `css` warning from the validator only means the stylesheet is in a form nothing can check.

## Bundling

The portal provides exactly six specifiers to a module plugin and rewrites the bundle's imports to its own copies:

```
react   react-dom   react/jsx-runtime   react/jsx-dev-runtime   @onlyoffice/docspace-plugin-sdk/react   @docspace/ui-kit
```

Everything else **must be bundled** — a bare import of anything else (`lodash-es`, the SDK root, a `@docspace/ui-kit/…` subpath) makes the loader refuse the plugin with a console error naming it. The reverse is quieter and worse: bundling one of the six installs cleanly and breaks at render — a second React or SDK React entry makes every hook throw (every component blank), a second ui-kit renders light and left-to-right. The SDK **root** is deliberately not external: it is enums and types, and the host does not provide it. The generator's `vite.config.ts` encodes the list; copy its `external` exactly if you write your own.

## Dependencies

Anything imported beyond those six is compiled into `plugin.js`, shipped inside the 5 MB archive, and executed in the portal's own window — its DOM, its cookies, the signed-in user's session. Both halves of that matter, and they pull in opposite directions.

**Do not hand-write what a well-known library already does.** Archive formats, PDF or spreadsheet output, HTML sanitising, markdown, date arithmetic, charts, fuzzy search, diffing — a few hundred lines of your own is a few hundred lines of unreviewed edge cases (zip64, CRC, DST, XSS), and they surface on the user's real file rather than on the one you tested. Take the established package and spend the effort on the feature.

**The bar for adding one is high**, and it is cleared before the import is written, not after. Everything below is one command each:

```sh
npm view <pkg> version license dependencies dist.unpackedSize time.modified
curl -s https://api.npmjs.org/downloads/point/last-week/<pkg>
```

| Take it only if | Because |
|---|---|
| It is the obvious, widely used choice — millions of weekly downloads, or the de-facto standard for the job | download count is the closest thing npm has to a review process; an obscure package with a plausible name is how typosquats and supply-chain payloads arrive |
| You verified the name on the registry rather than recalling it | a misremembered name is an unclaimed name, and unclaimed names get claimed |
| It was published within the last year or two and has a maintainer behind it | |
| The licence is permissive — MIT, ISC, Apache-2.0, BSD, MPL-2.0 | the plugin redistributes the code |
| Few or no transitive dependencies, and no install scripts | every transitive dependency runs in the portal too, on the same session |
| It runs in a browser — no `fs`, `path`, Node `crypto`, no build-time polyfill of a Node built-in | there is no shim in the portal, and a bundled polyfill is bulk for nothing |
| `plugin.js` still ends well under 5 MB — prefer the leaner of two good options | the limit is enforced server-side, on upload |

If nothing well known fits, write the minimum yourself and say so in the report. An unknown package is worse than 200 lines of your own; a popular one is better than 700.

**And nothing at all for what the platform already provides**: `fetch`, `Intl.DateTimeFormat`/`NumberFormat`/`RelativeTimeFormat`, `URL`/`URLSearchParams`, `structuredClone`, `crypto.randomUUID`/`crypto.subtle`, `TextEncoder`/`TextDecoder`, `Blob`/`File`/`FileReader`, `CompressionStream`, `Intl.Collator` for sorting, the `Array`/`Object` methods (no lodash for `groupBy`) — or anything the kit already renders.

The recurring needs, with the package that is the usual answer. Each is browser-first and has no runtime dependencies of its own — and each has a documented edge it does *not* handle, which is the plugin's job to handle instead, because these are the cases that reach a real user's real file:

| Need | Package | Licence | What it leaves to you |
|---|---|---|---|
| Zip read/write, deflate, gzip | `fflate` | MIT | **Encrypted entries** — it ignores the general-purpose bit-0 flag and inflates a password-protected entry as if it were plain, failing with a codec error: read the flag yourself and say the archive is protected. **Non-ASCII names** — without bit 11 they are decoded as latin1, so an older archiver's Cyrillic or CJK name arrives as mojibake |
| Sanitising HTML before it reaches the DOM | `dompurify` | MPL-2.0 or Apache-2.0 | It sanitises HTML, not URLs or CSS you interpolate yourself; and it needs a DOM, so nothing about it works in a class-side callback |
| Markdown to HTML | `marked` | MIT | It does **not** sanitise — the output goes through `dompurify` before it reaches `innerHTML` |
| Date arithmetic beyond `Intl` | `date-fns` | MIT | Time zones are a separate package (`date-fns-tz`); portal timestamps are UTC and the user's zone is theirs |
| Validating a foreign JSON payload at runtime | `zod` | MIT | Nothing, but it is only worth its bytes for input you do not control |

Confirm version and licence with the commands above rather than trusting this table — it ages, and the check costs one call. And whenever a library is recommended here or chosen by you, **say in the report what it does not cover**: a dependency taken on the user's behalf with an unstated blind spot is how a silent bug gets shipped with a clean validator run.

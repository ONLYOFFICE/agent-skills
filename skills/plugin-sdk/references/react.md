# The React runtime

How a plugin component is rendered, what it can reach, and the portal-provided UI it can open. Verified against the DocSpace client this skill targets; where the SDK's types and the host's behaviour differ, both are stated.

Contents: [Where components render](#where-components-render) · [Hooks](#the-hooks) · [What `useCurrentFile` returns where](#what-usecurrentfile-returns-where) · [Actions](#actions) · [API client](#the-api-client) · [Settings client](#the-settings-client) · [Modals](#modals) · [Portal-provided UI](#portal-provided-ui) · [Errors, loading, language, styling](#errors-loading-language-styling) · [Bundling](#bundling)

## Where components render

The portal wraps the component in the runtime provider and an error boundary and mounts it in its own React tree — same React, theme and direction as the page.

| Prop | Surface | What the host provides |
|---|---|---|
| `IArticleNavigationItem.component` | a full page at `/p/<key>` (under the section's path) | the section body — full width, scrolls; no heading, no padding (20px padding, a `Heading`, ~640px max text width read well) |
| `IInfoPanelItem.component` | body of an info panel tab | ~337px wide, already scrolls; the file/room title block unless `isHeaderVisible: false` |
| `IArticleButtonItem.component` | a 32×32 slot in the sidebar, `overflow: hidden` | nothing — a single `IconButton size={32}` is what fits |
| `IModalDialog.dialogBodyComponent` | body of a modal or aside | header from `dialogHeader`, close cross, padding; **no footer slot** |
| `IMediaViewer.component` | the media viewer's content area | the viewer's chrome, full screen |
| `ISettings.component` | the plugin's settings aside | header, the plugin's metadata below your component, a Save/Cancel footer |

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
| `navigate` | `navigatePath` | `navigate(path)` | an absolute portal path — the ones worth knowing are [below](#paths-navigate-takes); actions listed after it run once navigation finishes |
| `openInfoPanel` | `infoPanelTab?` | `openInfoPanel(tab?)` | `"info_details"`, `"info_members"`, `"info_history"`, `"info_share"`, or the `key` of your own info-panel item |
| `sendPostMessage` | `postMessage` | — | the target iframe must be in the DOM |
| `saveSettings` | `settings` | — (use `usePluginSettings().save()`) | |
| `updateProps` / `updateContext` | `newProps` / `contextProps` | — | SDK 2 declarative trees only; ignored or throws elsewhere |
| `updateStatus`, `update*Items` (`updateContextMenuItems`, `updateInfoPanelItems`, `updateMainButtonItems`, `updateProfileMenuItems`, `updateFileItems`, `updateEventListenerItems`, `updateArticleButtonItems`, `updateArticleNavigationItems`) | none | same names | make the portal re-read the plugin's map for that scope |

An event handler (`EventListener`) is further limited: only toasts and item updates are honoured from its message. There is no action for opening or closing the settings aside.

#### Paths `navigate` takes

Every portal section is a route ending in `/filter`, and an entity is that route with its id in the middle. Guessing gets you a redirect to the root, and query strings like `?folder=` are not part of it — an id in the path is what selects the folder.

| Where | Path |
|---|---|
| A room, by id | `/rooms/shared/{id}/filter` — archived: `/rooms/archived/{id}/filter` |
| A folder inside a room | the same shape with the folder's id — `/rooms/shared/{folderId}/filter` |
| The Rooms list / the Archive | `/rooms/shared/filter` / `/rooms/archived/filter` |
| My documents / Recent / Favourites / Trash | `/rooms/personal/filter` / `/recent/filter` / `/files/favorite/filter` / `/files/trash/filter` |
| Your own `ArticleNavigation` page | `/p/{key}` — under `Section.Accounts` `/accounts/p/{key}`, under `Section.Settings` `/portal-settings/p/{key}` |

Which of the two room paths a room takes is something you normally already know — you listed it with `searchArea` (`Active` or `Archive`), so carry that through to the link. `rootFolderType` on the room also distinguishes them, but the SDK types it as a bare `number` and names no constants, so do not branch on a remembered value. Sending someone to the wrong one of the two shows them an empty list rather than an error, which is the harder bug to notice.

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

- **Paths are relative to the API base**, which already includes `/api/2.0`: `"/files/@my"`, never `"/api/2.0/…"` or an absolute URL — those are refused before sending (`PluginApiError`, `code: "INVALID_PATH"`).
- **The `response` envelope is unwrapped.** `api.get("/files/file/1")` resolves to the file; `.response` is `undefined`. A list with a total resolves to `{ total, <rows field> }`.
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

`api` is stable, so pass it into plain functions (`roomsApi(api).list(...)`) and keep React at the boundary. **Do not stash it in a module variable**: the `/react` module is the host's single copy shared by every plugin and every mounted surface, so a module-level slot is neither private nor tied to one mount. The client's type is `PluginAPIClient` from the same subpath. Endpoint details, class-side `fetch` and file bytes are in [rest-api.md](rest-api.md).

## The settings client

`usePluginSettings()` — for `ISettings.component` and any component that wants a stored value.

| Method | Does |
|---|---|
| `load<T>()` | the stored object, or `null` when nothing was saved or the string is not JSON |
| `save(data)` | stores `JSON.stringify(data)`, then calls `setAdminPluginSettingsValue` on the class |
| `setSaveButton(button)` | supplies the aside's Save button — a `ButtonGroup` `{ component: Components.button, props: { label, size, onClick, isDisabled, withLoadingAfterClick, disableWhileRequestRunning } }` |

The portal owns the footer's Save/Cancel look. **Without `setSaveButton` the Save button has no `onClick` and saves nothing.** Call it in an effect that re-runs when the form changes — that is also how `isDisabled` tracks validity. After `onClick` resolves the portal closes the aside. The button state is per plugin and cleared on close.

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FieldContainer isVertical labelVisible labelText={t("webhook")} hasError={invalid} errorMessage={t("httpsOnly")}>
        <TextInput type={InputType.text} value={config.webhook} onChange={(e) => setConfig({ ...config, webhook: e.target.value })} scale hasError={invalid} />
      </FieldContainer>
      <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
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
| `Room` | `TRoomSelector` | `(selectedIds)` — **single selection only**, whatever `isMultiSelect` suggests; for several rooms use a context menu item with `isGroupAction` |
| `People` | `TPeopleSelector` | `{ selectedIds, fileName, isFooterCheckboxChecked }` |
| `Groups` | `TGroupsSelector` | `{ selectedIds }` |
| `Base` | `TBaseSelector` — your own `items: { id, label, icon? }[]` | `{ selectedIds, fileName, isFooterCheckboxChecked }` |

- **It never closes itself** — call `closeSelector()` from `onSubmit` *and* from `headerProps.onCloseClick`.
- Only the props the type declares reach the host; anything cast in is dropped.
- `TFilesSelector.getIsDisabled({ isFirstLoad, isRoot, selectedItemId, … })` is **required**; its boolean disables submit.

```ts
showSelector({
  type: SelectorType.People,
  props: {
    submitButtonLabel: t("notify"),
    onSubmit: ({ selectedIds }) => { setRecipients(selectedIds); closeSelector(); },
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

The component re-renders as the user pages, so `navigation.onFileChange`/`onLoad` are not needed — fetch in an effect keyed on `file?.id`. `playlistFilter` narrows what the viewer pages through (`filesExsts` case-insensitive, dot optional; every `filesSecurity` key must be allowed); without it the folder's full media playlist is used. Bytes come from the file's `viewUrl`, which answers 404 until the file has been written once ([rest-api.md](rest-api.md#a-files-contents-are-not-part-of-the-api)).

### The floating operations button

The portal's progress button (downloads, conversions) accepts plugin entries — the only way to show progress without holding a modal open.

```ts
const op = (percent: number, completed = false) => ({
  id: "my-plugin-export",
  operations: [{ id: "export", label: t("exporting"), operation: FloatingOperationType.Other, alert: false, completed, percent }],
});
addFloatingOperationsButton(op(0));
for (…) { await …; updateFloatingOperationsButton(op(pct)); }
updateFloatingOperationsButton(op(100, true));
```

- **Add before update.** `add` ignores an id already registered, `update` ignores one that is not — an update sent first is a silent no-op. `update` takes the whole props object again.
- `remove` takes the button `id` as a bare string (`floatingOperationsButtonPropsId` class-side).
- Operation ids are prefixed by the host with the plugin name; `onCancelOperationFromList(operationId)` hands back your unprefixed id. `cancelOperation` fires for "cancel all". Dismissing the button drops all your operations.
- `FloatingOperationType`: `Download`, `Convert`, `Copy`, `Upload`, `Backup`, … or `Other`.

## Errors, loading, language, styling

- **Errors are contained and silent.** A throw in render or an effect renders the component as **nothing**, with one console line `[Plugin: <name>] <error>`. A blank tab/page/modal is the symptom of a bug; `catch` and show text instead. Rejections in event handlers are not caught by the boundary.
- **Loading is yours.** No `onLoad`: render a `RectangleSkeleton`/`Loader` while the effect runs. Never fetch in `onLoadCallback` to pre-load — it delays installation and a throw aborts it.
- **Language.** Components call `t()` at render time and follow `setLanguage` on their own; only class-side item labels need rebuilding ([sdk-contract.md](sdk-contract.md#localisation)).
- **Styling.** Inline `style` and the kit's props cover almost everything. A `.css` import becomes `plugin.css`, injected into the portal's **own document, unscoped** — prefix every class with the plugin name. Colors come from the theme variables in [ui-kit.md](ui-kit.md#colors).

## Bundling

The portal provides exactly six specifiers to a module plugin and rewrites the bundle's imports to its own copies:

```
react   react-dom   react/jsx-runtime   react/jsx-dev-runtime   @onlyoffice/docspace-plugin-sdk/react   @docspace/ui-kit
```

Everything else **must be bundled** — a bare import of anything else (`lodash-es`, the SDK root, a `@docspace/ui-kit/…` subpath) makes the loader refuse the plugin with a console error naming it. The reverse is quieter and worse: bundling one of the six installs cleanly and breaks at render — a second React or SDK React entry makes every hook throw (every component blank), a second ui-kit renders light and left-to-right. The SDK **root** is deliberately not external: it is enums and types, and the host does not provide it. The generator's `vite.config.ts` encodes the list; copy its `external` exactly if you write your own.

# The React runtime

How a plugin component is rendered and what it can reach. Verified against the DocSpace client this skill targets; where the SDK's types and the host's behaviour differ, both are stated.

Contents: [Where components render](#where-components-render) · [Hooks](#the-hooks) · [What `useCurrentFile` returns where](#what-usecurrentfile-returns-where) · [Actions](#actions) · [API client](#the-api-client) · [Settings client](#the-settings-client) · [Errors, loading, language, styling](#errors-loading-language-styling) · [Bundling](#bundling)

Four neighbours carry the rest: the surfaces the **host** draws — modals, selectors, the create-file dialog, the media viewer, the progress button, and long-running work reporting through it — are in [components.md](components.md); the kit's own components in [ui-kit.md](ui-kit.md); theme variables, the portal's measurements and how a stylesheet gets scoped in [styles.md](styles.md); what a third-party package costs inside the portal's window in [dependencies.md](dependencies.md).

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
| `showModal` / `closeModal` | `modalDialogProps` (with `dialogBodyComponent`) / — | `showModal(props)` / `closeModal()` | see [Modals](components.md#modals); one dialog at a time |
| `showSelector` / `updateSelector` / `closeSelector` | `selectorProps` | same names | see [Selectors](components.md#selectors) |
| `showCreateDialogModal` / `updateCreateDialogModal` | `createDialogProps` | `showCreateDialog(props)` | see [Create-file dialog](components.md#the-create-file-dialog) |
| `showMediaViewer` / `updateMediaViewer` / `closeMediaViewer` | `mediaViewerProps` (with `component`) | same names | see [Media viewer](components.md#media-viewer) |
| `addFloatingOperationsButton` / `updateFloatingOperationsButton` / `removeFloatingOperationsButton` | `floatingOperationsButtonProps` / same / `floatingOperationsButtonPropsId` (a bare string) | same names | see [Progress button](components.md#the-floating-operations-button) |
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


## Errors, loading, language, styling

- **Errors are contained and silent.** A throw in render or an effect renders the component as **nothing**, with one console line `[Plugin: <name>] <error>`. A blank tab/page/modal is the symptom of a bug; `catch` and show text instead. Rejections in event handlers are not caught by the boundary.
- **Loading is yours.** No `onLoad`: render a `RectangleSkeleton`/`Loader` while the effect runs, and do not try to pre-load in `onLoadCallback` ([portal.md](portal.md#what-actually-breaks-the-portal)).
- **Language.** Components call `t()` at render time. A language change reloads the whole plugin as a fresh module, so no labels need rebuilding — but module-scope timers and listeners survive the reload and pile up ([sdk-contract.md](sdk-contract.md#localisation)).
- **Styling.** Three sources in order — a kit prop, an inline `style`, a stylesheet for what inline `style` cannot express. A `.css` import becomes `plugin.css`, injected into the portal's **own document, unscoped**, so it is a `.module.css` or it is scoped by hand; colors come from the portal's variables, never a literal. All of it, with the conventions and the specificity rules, is in [styles.md](styles.md).

## Bundling

The portal provides exactly six specifiers to a module plugin and rewrites the bundle's imports to its own copies:

```
react   react-dom   react/jsx-runtime   react/jsx-dev-runtime   @onlyoffice/docspace-plugin-sdk/react   @docspace/ui-kit
```

Everything else **must be bundled** — a bare import of anything else (`lodash-es`, the SDK root, a `@docspace/ui-kit/…` subpath) makes the loader refuse the plugin with a console error naming it. The reverse is quieter and worse: bundling one of the six installs cleanly and breaks at render — a second React or SDK React entry makes every hook throw (every component blank), a second ui-kit renders light and left-to-right. The SDK **root** is deliberately not external: it is enums and types, and the host does not provide it. The generator's `vite.config.ts` encodes the list; copy its `external` exactly if you write your own. What it costs to bundle anything else is in [dependencies.md](dependencies.md).

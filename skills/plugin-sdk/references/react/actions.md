# Actions

A class-side callback returns an `IMessage` — `{ actions: [Actions.x, …], <payload field> }` — and the host does nothing for an action whose payload field is missing. A component calls the same actions as functions on `usePluginActions()`, with the payload as the argument.

Contents: [The actions](#the-actions) · [Surfaces the portal draws](#surfaces-the-portal-draws) · [Paths `navigate` takes](#paths-navigate-takes) · [Changing an item from a component](#changing-an-item-from-a-component) · [Which actions work from which callback](#which-actions-work-from-which-callback)

## The actions

| `Actions.` | Payload field (class-side) | Function (component) | Notes |
|---|---|---|---|
| `showToast` | `toastProps: IToast[]` | `showToast({ type, title })` | `type` from `ToastType`; `title` is the toast **body** — the heading is the portal's word for the type. Top-right, 5 s, `withCross`/`timeout` are ignored |
| `showModal` / `closeModal` | `modalDialogProps` (with `dialogBodyComponent`) / — | `showModal(props)` / `closeModal()` | see [modal-dialog.md](../components/modal-dialog.md); one dialog at a time |
| `showSelector` / `updateSelector` / `closeSelector` | `selectorProps` | same names | see [selector.md](../components/selector.md) |
| `showCreateDialogModal` / `updateCreateDialogModal` | `createDialogProps` | `showCreateDialog(props)` | see [create-dialog.md](../components/create-dialog.md) |
| `showMediaViewer` / `updateMediaViewer` / `closeMediaViewer` | `mediaViewerProps` (with `component`) | same names | see [media-viewer.md](../components/media-viewer.md) |
| `addFloatingOperationsButton` / `updateFloatingOperationsButton` / `removeFloatingOperationsButton` | `floatingOperationsButtonProps` / same / `floatingOperationsButtonPropsId` (a bare string) | same names | see [floating-operations-button.md](../components/floating-operations-button.md) |
| `navigate` | `navigatePath` | `navigate(path)` | an absolute portal path — the ones worth knowing are [below](#paths-navigate-takes). The SDK's doc says later actions run once navigation finishes; the host does not sequence anything (the action loop is a synchronous `forEach`), so the next action fires immediately, against the page you are leaving |
| `openInfoPanel` | `infoPanelTab?` | `openInfoPanel(tab?)` | `"info_details"`, `"info_members"`, `"info_history"`, `"info_share"`, or the `key` of your own info-panel item — those four are the only portal tabs it knows; any other string, `"info_ai_chat"` included, is taken for a plugin key and prefixed, and no tab at all stores an invalid view and loses the user's remembered one, so always pass a tab. **It closes your modal, aside, settings aside and selector first** — the panel is not a second surface beside them, so anything the user was filling in is gone. Pass your `key` unprefixed; the host makes `info_plugin-<key>` itself. To send someone from a list into an item with your tab already open, this is the pair to use — `navigate(path)` then `openInfoPanel(key)`, unaffected by the unsequenced navigation because the panel belongs to no page — not a modal reproducing the tab, which would show the row's data in a surface the user cannot act on |
| `sendPostMessage` | `postMessage` | — | the target iframe must be in the DOM ([post-message-plugin.md](../plugins/post-message-plugin.md)) |
| `saveSettings` | `settings` | — (use `usePluginSettings().save()`) | |
| `updateProps` / `updateContext` | `newProps` / `contextProps` | — | SDK 2 declarative trees only; **silently ignored** elsewhere, never an error |
| `updateStatus` | none | — | class-side only: the portal re-reads `getStatus()` and applies it — `active` registers every declared scope's items and loads the CSS, `hide` takes them back ([plugin.md](../plugins/plugin.md#iplugin--always-required)). Set the field first (`this.updateStatus(PluginStatus.hide)`), then return the action; the portal does not watch the field. A component has no counterpart: `usePluginSettings().save()` is the one moment the runtime re-reads the status |
| `update*Items` (`updateContextMenuItems`, `updateInfoPanelItems`, `updateMainButtonItems`, `updateProfileMenuItems`, `updateFileItems`, `updateEventListenerItems`, `updateArticleButtonItems`, `updateArticleNavigationItems`) | none | same names | make the portal re-read the plugin's map for that scope |

`ToastType` — `success`, `error`, `warning`, `info`.

An event handler (`EventListener`) is not limited by the host either — why to keep it to item updates anyway is on [event-listener-item.md](../items/event-listener-item.md#the-event-fires-when-the-dialog-opens). Three actions work only from particular callers — `updateProps` and `updateContext` from an element of an SDK 2 tree, `updateCreateDialogModal` from the create dialog's own callbacks ([create-dialog.md](../components/create-dialog.md)) — and are ignored from anywhere else ([below](#which-actions-work-from-which-callback)). There is no action for opening the settings aside (`openInfoPanel` closes it).

## Surfaces the portal draws

The SDK's `interfaces/components` — the surfaces the **host** renders on the plugin's behalf, as opposed to the mounting points each item scope contributes ([common-fields.md](../items/common-fields.md)) and the components the plugin writes itself ([rendering.md](rendering.md#where-components-render)). A modal, a picker, the create-file prompt, the media viewer, the progress button — [modal-dialog.md](../components/modal-dialog.md), [selector.md](../components/selector.md), [create-dialog.md](../components/create-dialog.md), [media-viewer.md](../components/media-viewer.md), [floating-operations-button.md](../components/floating-operations-button.md): reach for these before building a list, a file-name field or a progress modal of your own, because they carry the portal's search, paging, validation and look.

Every shape there is the same from a component (`usePluginActions()`) and from a class-side `IMessage` — the difference is only whether the payload travels as an argument or as a field ([the table above](#the-actions)). What none of them do is manage each other: the portal renders each surface from its own visibility flag, so **one portal-drawn surface at a time** is the plugin's job to enforce.

The declarative primitives that also live in that folder — `IBox`, `IButton`, `IText`, `IInput` and the rest of the `body: IBox` tree — belong to SDK 2 and are not used by a module plugin ([sdk-2-plugins.md](../sdk-2-plugins.md)).

## Paths `navigate` takes

Every portal section is a route ending in `/filter`, and an entity is that route with its id in the middle. Guessing gets you a redirect to the root.

**The path alone does not open a room — `?folder={id}` is what does.** The Files section tells "the rooms list" from "one room's contents" by the **query string**, not the path, so a path-only link is taken for the list and the address bar is rewritten from that state: a literal `/rooms/shared/undefined/filter?searchArea=…` is the signature. Repeat the id in both places.

| Where | Path |
|---|---|
| A room, by id | `/rooms/shared/{id}/filter?folder={id}` — archived: `/rooms/archived/{id}/filter?folder={id}` |
| A folder inside a room | the same shape with the folder's id — `/rooms/shared/{folderId}/filter?folder={folderId}` |
| The Rooms list / the Archive | `/rooms/shared/filter` / `/rooms/archived/filter` |
| My documents / Recent / Favourites / Trash | `/rooms/personal/filter` / `/recent/filter` / `/files/favorite/filter` / `/files/trash/filter` |
| Your own `ArticleNavigation` page | `/p/{key}` — under `Section.Accounts` `/accounts/p/{key}`, under `Section.Settings` `/portal-settings/p/{key}` |
| A document, in the editor | **not a `navigate` path** — `/doceditor?fileId={id}` opened as a page load, [below](#opening-a-document-is-a-page-load) |

Which of the two room paths a room takes is normally already known — you listed it with `searchArea` (`Active` or `Archive`), so carry that through to the link; sending someone to the wrong one shows an empty list rather than an error. Otherwise the room's own `rootFolderType` decides it, against `FolderType.Archive` = **20**, which is also the test that separates "archive this" from "restore this" ([portal.md](../portal.md#silent-failures-in-the-ui-layer)). The SDK types the field as a bare `number` and exports no constant, so name your own (`const ARCHIVE_ROOT = 20`) rather than leaving a literal in a condition.

### Opening a document is a page load

The editor is a separate application at `/doceditor`, outside the SPA router's routes — `navigate()` there lands on the portal's 404 element. Open it as the portal does: a page load of a URL built from the id.

```ts
const openInEditor = (id: string | number, sameTab = false) =>
  window.open(`/doceditor?fileId=${encodeURIComponent(String(id))}`, sameTab ? "_self" : "_blank");
```

`fileId` with a capital I is what the client's own links carry; `&action=view` opens read-only; the portal uses `_blank` unless the user's *Open documents in the same tab* setting (`openEditorInSameTab` in `GET /files/settings`) is on; a portal under a path prefix needs it in front (`getAPI().proxy`). **`webUrl` and `viewUrl` are not links to reuse**: `webUrl` changes shape with the file type — the editor with the legacy lower-case `fileid=` for editable formats, `action=view` for convert-only ones, the media viewer for images, a download for the rest — and `viewUrl` is always the download. Keep the id, build the path.

## Changing an item from a component

**Changing an item from a component is two steps:** mutate the map through the plugin instance, then ask for a redraw — `setState` cannot reach the class.

```ts
plugin.updateArticleNavigationItem({ ...pageItem, label: `Visits (${++visits})` });
updateArticleNavigationItems();
```

## Which actions work from which callback

| Callback belongs to | `updateProps` / `updateContext` | `updateCreateDialogModal` | `saveSettings` / `updateStatus` | everything else |
|---|---|---|---|---|
| A React component (`usePluginActions()`) | not offered — a component owns its state | not offered | not offered — `usePluginSettings().save()` stores the value and re-reads the status | all work |
| A menu item, file click, `subMenu.onClick`, event handler, selector or PostMessage callback | **silently ignored** — the setter they need belongs to a mounted element | **silently ignored** | works | all work |
| The create dialog's own `onSave`, `onError`, `onChange`, `onSelect` | **silently ignored** | works | works | all work |
| An element of an SDK 2 declarative tree | works | **silently ignored** | works | all work |

**Nothing here throws**, and that is the trap: the dispatcher calls every setter optionally (`setElementProps?.()`, `updatePropsContext?.()`), so an action that has no home is a no-op with no console line — the plugin looks correct and does nothing. Almost nothing in the plugin layer throws at all: the React API client on a rejected path, the runtime hooks outside a component, the import shim on a missing external, and a module bundle with no default export.

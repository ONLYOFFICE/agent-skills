# SDKInstance methods (SDK 2.2.0)

All methods (except `getConfig`, `initFrame`, `destroyFrame`, `setIsLoaded`) are proxied
into the iframe over postMessage and return promises. Call them **after `onAppReady`**;
earlier calls fail with `DISCONNECTED`. Each call is bounded by `config.methodTimeout`
(default 30 s) and rejects with `SDKError(TIMEOUT)` if the frame does not answer.

## Result semantics — read this first

Verified against the ONLYOFFICE Apps client dispatchers (client 4.0.0 sources, `release/v4.0.0`): the portal side
wraps **every** method call in `try/catch` and **always replies with a resolved payload —
it never rejects**. Consequences, in order of importance:

1. **API-level failures resolve.** When the underlying portal API call throws, the caught
   error object is returned as the payload. Axios-style errors serialize with `status` and
   `message`; plain errors may serialize to `{}`. So for **any** method that hits the
   portal API (`login`, `createRoom`, `createFile`, `createFolder`, `createTag`,
   `addTagsToRoom`, `removeTagsFromRoom`, `getRooms`, `getUserInfo`, …) treat a payload
   with `status && status !== 200` — or an unexpectedly empty/error-shaped payload — as
   failure. The notorious cases:
   - `login(...)` → check `response.status !== 200` (invalid credentials etc.)
   - `createRoom(...)` → check `status !== 200`; `status === 402` = pricing plan limit —
     point the user to `{portal}/portal-settings/payments/portal-payments`
2. **Unsupported method for the mode resolves with the string
   `"Wrong method for this mode"`.** Each embedded page implements its own method subset
   (see the support matrix below); anything else falls through to that string. It is a
   resolved value, not an error — check for it explicitly.
3. **Rejections come only from the SDK transport layer**: `DISCONNECTED` (before the
   frame is ready / after destroy), `TIMEOUT` (`methodTimeout`, 30 s), `MODE_MISMATCH`
   (SDK-side guards like `upload`), `UPLOAD_FAILED`.

### Method support by embedded page (client 4.0.0)

| Embedded page | Methods handled |
|---|---|
| Manager (files UI at `{rootPath}`) | `setConfig`, `getFolderInfo`, `getFolders`, `getFiles`, `getList`, `getSelection`, `getUserInfo`, `getRooms`, `openModal`, `createFile`, `createFolder`, `createRoom`, `createTag`, `addTagsToRoom`, `removeTagsFromRoom`, `setListView`, `createHash`, `getHashSettings`, `login`, `logout` |
| System (`/old-sdk/system`) | `setConfig`, `createHash`, `getUserInfo`, `getHashSettings`, `login`, `logout` |
| Editor / Viewer (`/doceditor`) | `setConfig`, `executeInEditor` |
| Forms (`/sdk/forms/*`) | `setConfig`, `navigateSection`, `setCustomActions`, `upload` |
| Personal (`/sdk/personal-files/*`) | `setConfig`, `navigateSection` |
| Room selector, File selector, Uploader, Public room, Chat (`/sdk/*`) | `setConfig` only |

Everything not listed for the current mode's page resolves with
`"Wrong method for this mode"`. **Personal is not the files UI**: it is served by the new SDK
app, so `getFiles`, `getFolderInfo`, `createFile`, `login` and the rest resolve with that
string there — use a Manager or System frame for data calls. The matrix is
portal-version-specific — older portals handle fewer methods.

## Frame lifecycle (host-side, no postMessage)

| Method | Notes |
|---|---|
| `initFrame(config)` | (re)build the iframe; warns to console on empty `frameId`/`src` |
| `destroyFrame()` | replaces container with a div (keeps `frameId`, shows `destroyText`), removes listeners, clears pending calls, deregisters from `DocSpace.SDK.frames` |
| `setConfig(config, reload = false)` | merge + send config to the frame; `reload: true` re-runs `initFrame` |
| `getConfig()` | returns the current merged `TFrameConfig` (synchronous) |
| `setIsLoaded()` | public: removes the loader, reveals the iframe and fires `onContentReady` (every call) — needed for System mode, which never completes on its own |

## Listings and info

| Method | Returns | Notes |
|---|---|---|
| `getFolderInfo()` | `TFolderInfo` | current folder of the open frame |
| `getSelection()` | `TFileInfo[]` | currently selected items |
| `getFiles()` | `TFilesResponse` | files of the current folder |
| `getFolders()` | `TFilesResponse` | subfolders |
| `getList()` | `TFilesResponse` | files + folders |
| `getRooms(filter)` | `TRoomsResponse` | rooms matching a `TFrameFilter` |
| `getUserInfo()` | `TUserInfo` | current user; also the standard "is a session alive?" probe |

`TFilesResponse`/`TRoomsResponse` are `TListResponse<TFolderInfo>` / `TListResponse<TRoomInfo>` =
`{ files, folders, current, pathParts, total, count, … }`. `TFileInfo`, `TFolderInfo` and
`TRoomInfo` extend `TEntityBase` (`id`, `title`, `created`, `updated`, `createdBy`, `updatedBy`,
`access`, `security`, `shared`, `canShare`, `mute`).

## Auth

| Method | Notes |
|---|---|
| `getHashSettings()` | `{ size, iterations, salt }` — PBKDF2 parameters of the portal |
| `createHash(password, hashSettings)` | portal-compatible password hash; run in a hidden System frame |
| `login(email, passwordHash, password?, session?)` | the portal reads only `email` and `passwordHash` (client 4.0.0) — `password` and `session` are sent but ignored, and the session is always persistent; **check `status !== 200`** |
| `logout()` | end the portal session |

## Content

| Method | Notes |
|---|---|
| `createFile(folderId, title, templateId?, formId?)` | folder id usually from `getFolderInfo()` |
| `createFolder(parentFolderId, title)` | returns `TFolderInfo` |
| `createRoom(title, roomType, options?)` | SDK 2.2 signature; `options: TCreateRoomOptions = { quota?, tags?, color?, cover?, indexing?, denyDownload? }`. **Older SDKs (<= 2.1) had positional params** `(title, type, quota?, tags?)` — real integrations hit type mismatches here; match the portal's SDK version. Room types (numeric): `1` form-filling, `2` collaboration, `5` custom, `6` public, `8` virtual data room |
| `setListView(viewType)` | `"row"` / `"table"` / `"tile"` |
| `openModal(type, options)` | open a portal modal dialog |
| `upload(file: File)` | **Forms mode only** — throws `SDKError(MODE_MISMATCH)` elsewhere; 120 s timeout; Uploader mode accepts files only via its UI |

`createFile`/`createFolder` act on the current folder context of an open Manager frame; the
Personal page does not implement them.

## Tags

| Method | Notes |
|---|---|
| `createTag(name)` | create a portal-wide tag |
| `addTagsToRoom(roomId, tags: string[])` | attach existing tags |
| `removeTagsFromRoom(roomId, tags: string[])` | detach |

## Editor / navigation / actions

| Method | Notes |
|---|---|
| `executeInEditor(callback, data?)` | run code inside the editor context. The callback is **serialized** (no closures/imports) and invoked as **`callback(editor, asc, data)`** — three arguments: the DocsAPI editor object (call `editor.createConnector()` yourself), `window.Asc` of the frame, then your `data`. SDK 2.2.0 types it that way; SDKs <= 2.1 declared `(instance, data?)`, which was wrong. See [editor-automation.md](editor-automation.md) before using |
| `navigateSection(section)` | Forms (`my-forms`, `in-progress`, `completed-forms`, `library`, `settings`) and Personal (`my-documents`, `favorites`, `recent`, `trash`, `settings`); resolves `{ section }`. An unknown section is **not answered** by the Forms page (the call ends in `TIMEOUT`); the Personal page answers with `{ error }` |
| `setCustomActions(config: TCustomActionsConfig)` | `{ contextMenu: TCustomContextMenuActions = { file?: [...], folder?: [...] } }`; register custom context-menu actions (Forms); each action = `{ key, label, icon?, section? }`; clicks arrive via the `onCustomAction` event |

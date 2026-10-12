# SDKInstance methods: what the pages do with them (SDK 2.2.0, client 4.0.0)

Signatures, parameters and return types are on
[SDKInstance](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/classes/SDKInstance.md), one section per
method, with the response shapes on their type pages (`TFilesResponse`, `TRoomsResponse`, `TFolderInfo`, `TUserInfo`,
`TLoginResult`, `TCreateRoomOptions`). This file records what the docs cannot: how a result or failure arrives, which
page handles which method, and the traps.

All methods (except `getConfig`, `initFrame`, `destroyFrame`, `setIsLoaded`) are proxied
into the iframe over postMessage and return promises. Call them **after `onAppReady`**: before the
iframe has loaded they fail with `DISCONNECTED`, and between the load and `onAppReady` they reach a page
that may not be listening yet. Each call is bounded by `config.methodTimeout` (default 30 s) and rejects
with `SDKError(TIMEOUT)` if the frame does not answer.

Contents: Result semantics · Method support by embedded page · Frame lifecycle · Listings and info · Auth · Content ·
Editor / navigation / actions

## Result semantics — read this first

Verified against the ONLYOFFICE Apps client dispatchers (client 4.0.0 sources, `release/v4.0.0`) and
SDK 2.2.0's `#handleMethodResponse`. The Manager and System pages wrap every handler in `try/catch` and flag a
failure; the editor page and the `/sdk/*` pages (Forms, Personal, selectors, Uploader, Public room, Chat) answer
with the raw error instead — they only serve `setConfig`, `executeInEditor`, `navigateSection`, `setCustomActions`
and `upload`, so in practice the rule below is about Manager and System. What the host sees depends on the method
and on the portal's build:

1. **API-level failures reject with `API_ERROR`** on client 4.0.0. The Manager and System dispatchers answer a failed
   handler with `{ isError: true, status, message, name, code }` and the SDK rejects the promise with an `SDKError` whose
   `code` is `API_ERROR`, `status` the HTTP status (`401`, `403`, `404`, …) and `data` that payload. So `await`
   in `try`/`catch` and branch on `err.code`. `createRoom(...)` failing with `err.status === 402` is the
   pricing plan limit — point the user to `{portal}/portal-settings/payments/portal-payments`.
2. **`login()` and `createRoom()` keep resolving their failures** as `{ status, message }` (the pre-2.2 contract) —
   check `status && status !== 200` on those two only. `login()` with wrong credentials is `status: 401`.
3. **A method the mode's page lacks rejects with `MODE_MISMATCH`**: the page answers `"Wrong method for this
   mode"` and the SDK converts it (`"createRoom is not available in system mode"`). The same code comes from
   the SDK's own guards (`upload`, `navigateSection`, `setCustomActions` outside their modes) — as a rejected
   promise, never a synchronous throw.
4. **Transport rejections**: `DISCONNECTED` (before the iframe has loaded, or after destroy), `TIMEOUT`
   (`methodTimeout`, 30 s), `UPLOAD_FAILED` (the frame reported `onUploadError`, or the 120 s transfer timeout).
5. **Older portals resolve the error object** (no `isError` flag): every method then resolves an Axios-style
   `{ status, message, name, code }` — the SDK strips `config`, `request` and `stack` first — or `{}` for a plain
   `Error`. Code that must run against portals of unknown build handles both: `catch` for the rejection and
   `status && status !== 200` on the resolved value. `onAppError` never fires for an API failure.

### Method support by embedded page (client 4.0.0)

| Embedded page | Methods handled |
|---|---|
| Manager (files UI at `{rootPath}`) | `setConfig`, `getFolderInfo`, `getFolders`, `getFiles`, `getList`, `getSelection`, `getUserInfo`, `getRooms`, `openModal`, `createFile`, `createFolder`, `createRoom`, `createTag`, `addTagsToRoom`, `removeTagsFromRoom`, `setListView`, `setCustomActions`, `createHash`, `getHashSettings`, `login`, `logout` |
| System (`/old-sdk/system`) | `setConfig`, `createHash`, `getUserInfo`, `getHashSettings`, `login`, `logout` |
| Editor / Viewer (`/doceditor`) | `setConfig`, `executeInEditor` |
| Forms (`/sdk/forms/*`) | `setConfig`, `navigateSection`, `setCustomActions`, `upload` |
| Personal (`/sdk/personal-files/*`) | `setConfig`, `navigateSection`, `setCustomActions`, `upload` |
| Room selector, File selector, Uploader, Public room, Chat (`/sdk/*`) | `setConfig` only |

Everything not listed for the current mode's page rejects with `MODE_MISMATCH` (an older portal resolves the
string `"Wrong method for this mode"` instead). **Personal is not the files UI**: it is served by the new SDK
app, so `getFiles`, `getFolderInfo`, `createFile`, `login` and the rest are unavailable there — use a Manager or
System frame for data calls. The matrix is portal-version-specific — older portals handle fewer methods.

## Frame lifecycle (host-side, no postMessage)

| Method | Notes |
|---|---|
| `initFrame(config)` | (re)build the iframe; warns to console on empty `frameId`/`src` |
| `destroyFrame()` | synchronous; replaces the iframe with a placeholder `<div id="{frameId}">` showing `destroyText`, removes the `message` listener, rejects pending calls, deletes the entry from `DocSpace.SDK.frames`. The container id survives, so `init*` on the same `frameId` may follow immediately — nothing to await |
| `setConfig(config, reload = false)` | merge + send config to the frame; `reload: true` re-runs `initFrame`. On a `waiting` frame the plain call rejects with `DISCONNECTED` (the iframe is not in the DOM) — `setConfig({ waiting: false }, true)` releases it. Manager and System pages fire `onAppReady` again after each one. `theme` is read by Manager and System once, from the frame URL at load — a plain `setConfig({ theme })` changes nothing; `locale` is applied live |
| `getConfig()` | returns the current merged `TFrameConfig` (synchronous) |
| `setIsLoaded()` | public: removes the loader, reveals the iframe and fires `onContentReady` (every call). The embedded pages call it themselves once they are ready (Manager, Chat and the System page on client 4.0.0); on an older portal a System frame may stay on the loader until you call it |

## Listings and info

`getFolderInfo`, `getSelection`, `getFiles`, `getFolders`, `getList`, `getRooms(filter)` and `getUserInfo` are
Manager-page methods (System handles `getUserInfo` too) and act on the folder the frame currently shows; their
return shapes are on the SDKInstance page. `getUserInfo()` doubles as the "is a session alive?" probe: call it and
compare the email before any `login()`.

## Auth

| Method | Notes |
|---|---|
| `getHashSettings()` | `{ size, iterations, salt }` — PBKDF2 parameters of the portal |
| `createHash(password, hashSettings)` | portal-compatible password hash; run in a hidden System frame |
| `login(email, passwordHash, password?, session?, code?)` | resolves with `TLoginResult` (SDK 2.2.0), never rejects. Three shapes on client 4.0.0: `{ url: "/" }` — session created; `{ url: "/confirm/TfaAuth…", user, hash }` — second factor required, no session; an error object with `status` (401 for wrong credentials) and `message` — failed. The REST DTO fields (`token`, `tfa`, `confirmUrl`) never reach the SDK: the dispatcher calls the client's sign-in store, not the API. The store forwards only `email` and `passwordHash` and always asks for a persistent session, so `password` and `session` do nothing from the frame although the REST endpoint itself accepts a plaintext password. The fifth argument `code` is read by the Manager and System pages of client 4.0.0: after a `/confirm/…` answer, `login(email, hash, undefined, undefined, code)` creates the session. An older (3.x) System page forwards `email` and `passwordHash` alone and re-issues the challenge. See [auth-recipes §7](auth-recipes.md#7-two-factor-authentication) |
| `logout()` | end the portal session. The System page awaits the sign-out before answering; the Manager page answers at once, so after a Manager `logout()` the session may still be alive for a moment — run sign-out sequences through a System frame |

## Content

| Method | Notes |
|---|---|
| `createFile(folderId, title, templateId?, formId?)` | `templateId` and `formId` are optional (SDK 2.2.0; omitted ones are left out of the call). The portal runs `POST /files/{folderId}/file` with `{ title, templateId, formId }` (client 4.0.0). **The format comes from the extension in `title`**: `"Contract.pdf"` creates a PDF (form), `"Contract.docx"` a text document — copying a PDF form template under a `.docx` title yields a plain document that is no longer a form; a title without extension gets `.docx`. `templateId`/`formId` only supply the content. `folderId` is a destination folder: `getFolderInfo().id` of an open Manager frame, a file-selector's `folderId`, or your stored mapping — never a section's `rootFolderId` (REST answers 403; the call rejects with `API_ERROR`, `status: 403`) |
| `createRoom(title, roomType, options?)` | SDK 2.2 signature; `options: TCreateRoomOptions = { quota?, tags?, color?, cover?, indexing?, denyDownload? }`. **Older SDKs (<= 2.1) had positional params** `(title, type, quota?, tags?)` — real integrations hit type mismatches here; match the portal's SDK version. Room types are the `RoomType` enum (SDK 2.2.0, a `const enum` — write the numbers under `isolatedModules`): `1` form filling, `2` collaboration, `5` custom, `6` public, `8` virtual data room, `9` AI (the client also knows `13`, a private room, which the enum does not list). The value is posted to `POST /files/rooms` unvalidated. Reviewing and commenting access exist only in a custom room (`5`); creating any room needs the room admin role, otherwise `status: 403` |
| `setListView(viewType)` | `"row"` / `"table"` / `"tile"` — the only way to set the Manager layout on client 4.0.0, since `viewAs` is ignored; call it after `onAppReady` |
| `upload(file: File)` | **Forms and Personal** (the form filling room, or the folder open in the Personal frame) — rejects with `SDKError(MODE_MISMATCH)` elsewhere. Resolves the `onUploadSuccess` payload (`{ fileName, fileSize }`), so the event handler is optional; rejects with `UPLOAD_FAILED` on `onUploadError` or after its own 120 s timeout (`methodTimeout` does not apply); `onUploadProgress` is not emitted for it. Uploader mode accepts files only via its UI |

`createFile`, `createFolder`, `openModal` and the tag methods (`createTag`, `addTagsToRoom`, `removeTagsFromRoom`) are
Manager-page methods acting on the current folder context; the Personal page does not implement them. A tag is
portal-wide — `createTag` before `addTagsToRoom` when the name is new.

## Editor / navigation / actions

| Method | Notes |
|---|---|
| `executeInEditor(callback, data?)` | run code inside the editor context. The callback is **serialized** (no closures/imports) and invoked as **`callback(editor, asc, data)`** — three arguments: the DocsAPI editor object (call `editor.createConnector()` yourself), `window.Asc` of the frame, then your `data`. SDK 2.2.0 types it that way; SDKs <= 2.1 declared `(instance, data?)`, which was wrong. The call resolves as soon as the page has run your callback, with no result (`{}`); a throw inside the callback is caught and logged in the frame's console only. See [editor-automation.md](editor-automation.md) before using |
| `navigateSection(section)` | Forms (`my-forms`, `in-progress`, `completed-forms`, `library`, `settings`) and Personal (`my-documents`, `favorites`, `recent`, `shared-with-me`, `trash`, `settings`); resolves `{ section }`. An unknown section is **not answered** by the Forms page (the call ends in `TIMEOUT`); the Personal page answers with `{ error }`. In any other mode the promise rejects with `MODE_MISMATCH` |
| `setCustomActions(config: TCustomActionsConfig)` | `{ contextMenu: TCustomContextMenuActions = { file?: [...], folder?: [...] } }`; register entries in the context menus (`contextMenu`) and, in Manager and Personal, in the create menu (`createMenu: [...]`); each entry = `{ key, label, icon?, section? }`; clicks arrive via the `onCustomAction` event. The same config passed as `customActions` in `TFrameConfig` is applied when the frame loads (not a script-tag parameter). Outside Manager, Personal and Forms the promise rejects with `MODE_MISMATCH` |

# TFrameEvents: what the pages send (SDK 2.2.0, client 4.0.0)

The handler list with one line each is on
[TFrameEvents](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/type-aliases/TFrameEvents.md); the typed
payloads have their own pages (`TSelectedRoom`, `TSelectedFile`, `TEditorOpenPayload`, `TFileInfo`,
`TGetExternalDataRequest`, `TSetExternalDataPayload`, the `TUpload*` family) — import them from
`@onlyoffice/docspace-sdk-js` instead of declaring your own shapes. This file records which page fires what, the
payloads the pages actually send, and the lifecycle traps.

Contents: Lifecycle · Selectors · Auth · Navigation / access · Manager / editor · Uploads · Custom actions ·
External storage bridge

## Lifecycle

| Event | Fires when | Payload |
|---|---|---|
| `onAppReady` | frame app fully initialized — **methods may be called from here**. Manager and System pages fire it again after every `setConfig` (the reference says "once"), so a handler that calls `setConfig` needs a guard | `{ frameId }` |
| `onContentReady` | frame content is visible — reveal the iframe, drop your spinner. With `noLoader: true` (the default outside Manager and System) the SDK fires it itself on the iframe's `load` event | — |
| `onAppError` | an SDK-side error: CSP failure, unparsable message, a call on a disconnected frame, a method timeout, a token failure — only the message arrives; the `SDKError` with its code goes to the console. An API failure of a method call does not fire it: the method's promise rejects instead ([methods](methods.md#result-semantics--read-this-first)) | `message: string` |

Pattern from production: keep the iframe hidden (CSS) with your own spinner until
`onContentReady`, and gate all instance-method calls on `onAppReady`.

## Selectors (room-selector / file-selector)

| Event | Payload |
|---|---|
| `onSelectCallback` | **room-selector: an array** — `items[0].id`, `.label`, `.icon`, `.requestTokens[0].requestToken` (`requestTokens` only for public rooms and shared custom/form rooms); **file-selector: an object** — `item.id`, `.title`, `.fileExst`, `.documentType` (`"word"`, `"cell"`, `"slide"`, `"pdf"`, …), plus `.requestTokens` when the file lives in a public room; it has no `.icon` (the portal does not send one) |
| `onCloseCallback` | dialog closed/cancelled — no payload |

The `requestTokens[0].requestToken` from a selected room is exactly what `public-room`
mode needs.

## Auth

| Event | Fires when | Payload |
|---|---|---|
| `onAuthSuccess` | successful authorization inside the frame | object |
| `onAuthError` | OAuth mode: `getToken` threw/rejected or is missing (`code: "TOKEN_RESOLVE_FAILED"`, from the SDK), or the portal still answered 401 after a fresh token (`code: "UNAUTHORIZED"`, from the page — expired token or missing scope) | `{ code?, message }` |
| `onSignOut` | user signed out inside the frame — tear down and unlink the account on your side | — |

## Navigation / access

| Event | Fires when | Production reaction |
|---|---|---|
| `onNoAccess` | Manager: navigating to a room/folder the user may not open (403); Public room page: an expired link; Chat page: the frame's user may not use AI (a guest, or nobody signed in) | show a "request access" flow, or sign the user in |
| `onNotFound` | Manager: the room/folder does not exist (404) or was deleted while open; Public room page: an invalid or revoked link. **A Manager opened with `requestToken` reports every access error — 401, 402, 403 and 404 alike — as `onNotFound`** (client 4.0.0) | the entity was deleted on the portal — drop your stored mapping, offer to create a new one; over a `requestToken` treat it as "link no longer works" |
| `onNavigate` | Forms/Personal section change | `{ section }` |
| `onFilterSearch` | Personal and Public room: the file list's search text changed; fires with `""` when the search is reset (client 4.0.0) | `{ search }` |

## Manager / editor

| Event | Fires when | Payload |
|---|---|---|
| `onFileManagerClick` | a **file** row is activated in the manager list; folders never fire it (a folder click navigates into the folder) | the portal's file object, as returned by the files API (client 4.0.0): `id`, `title`, `fileExst` (`".docx"`), `fileType` (numeric), `folderId`, `rootFolderId`, `viewUrl`, `webUrl`, `security` (`{ Read, Edit, Download, … }`), `created`, `updated`, `createdBy`, `updatedBy`, `version`, `shared`, … Read `id`, `title`, `fileExst`; do not write "is it a file" heuristics — it always is. Registering the handler suppresses the portal's own open action, so open the file yourself (own viewer/editor frame) |
| `onEditorOpen` | the manager is about to open the editor (row activation without `onFileManagerClick`, context menu, hotkey, "Create" dialog) | the same file object plus `share` (share key when the room is opened by link, else empty) and `action`: `"view"` \| `"fill"` \| `"edit"`. When the user creates a new document, the payload is the created file (`id`, `title`, `fileExst`, `folderId`, …) with no `action`. Registering the handler suppresses the portal editor — host it in your own frame with `id: payload.id` |
| `onEditorCloseCallback` | editor closed (also when `editorGoBack: "event"`) | — |
| `onDownload` | download requested and `downloadToEvent: true` | `url: string` — bridge the file into the host system |

Both manager events fire only when the handler is present in `config.events`; leaving one
`null` restores the portal's default behaviour for that action. The Forms and Personal pages fire them too.

## Uploads (Uploader, Forms and Personal modes)

Two different sources, two payload shapes (SDK 2.2.0 types them; client 4.0.0 verified):

| Event | Uploader (the drop-zone's own upload) | Forms and Personal (only for `upload()`) |
|---|---|---|
| `onUploadSuccess` | once per batch, an **array** of `TUploaderUploadResult` — the portal's API envelope per file: `{ response: { id, folderId, version, title, uploaded, file: TFileInfo }, count, status, statusCode }` | once per `upload()` call, `TUploadResult` `{ fileName, fileSize }` — the same object the call resolves with |
| `onUploadError` | `TUploaderUploadError` `{ error, rejectedFiles?: [{ fileName, fileSize, fileType, errors: [{ code, message }] }] }` — `rejectedFiles` when the dialog's validation refused files | `TUploadError` `{ fileName, message }` |
| `onUploadProgress` | `TUploadProgress` `{ sessionId, fileName, uploadedChunks, totalChunks, percent }`, after every chunk of every file | never |

So `onUploadSuccess: (files) => files.map((f) => f.response?.title)` on an Uploader frame, and `({ fileName }) => …`
on a Forms or Personal frame; `file[0].response.title` is the Uploader shape. Files added through the Forms or
Personal page's own UI do not fire these events.

## Custom actions (Manager, Personal, Forms)

| Event | Payload |
|---|---|
| `onCustomAction` | `{ action, type, item?, items?, folderId? }` — `action` = the `key` registered via `setCustomActions` or `customActions`; `type` is `file`, `folder` or `room` from a context menu and `create` from the create menu; `items` is the whole selection when the entry was applied to several items of one type, `item` the single one — both absent for `create` |

## External storage bridge

`onGetExternalData` (the frame reads a value: return it, sync or as a Promise, and the SDK posts it back by `callId`)
and `onSetExternalData` (the frame persists a value: fire-and-forget) are fully described on their type pages. The one
trap: a handler that throws or rejects is routed to `onAppError` and **no response is sent**, so the frame waits.

# TFrameEvents reference (SDK 2.2.0)

Pass handlers via `config.events`. All are optional (`null` = disabled). Events flow from
the iframe to the host. Payload shapes below are what real integrations rely on.

## Lifecycle

| Event | Fires when | Payload |
|---|---|---|
| `onAppReady` | frame app fully initialized — **methods may be called from here**. Manager and System pages fire it again after every `setConfig` (the reference says "once"), so a handler that calls `setConfig` needs a guard | `{ frameId }` |
| `onContentReady` | frame content is visible — reveal the iframe, drop your spinner | — |
| `onAppError` | an SDK-side error: CSP failure, unparsable message, a call on a disconnected frame, a method timeout, a token failure — only the message arrives; the `SDKError` with its code goes to the console. An API failure of a method call does not fire it: the method's promise rejects instead ([methods](methods.md#result-semantics--read-this-first)) | `message: string` |

Pattern from production: keep the iframe hidden (CSS) with your own spinner until
`onContentReady`, and gate all instance-method calls on `onAppReady`.

## Selectors (room-selector / file-selector)

| Event | Payload |
|---|---|
| `onSelectCallback` | **room-selector: an array** — `items[0].id`, `.label`, `.icon`, `.requestTokens[0].requestToken`; **file-selector: an object** — `item.id`, `.title`, `.fileExst`, `.documentType`; it has no `.icon` (the portal does not send one) |
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
| `onNoAccess` | navigating to an inaccessible room/folder; the Chat page fires it when the frame's user may not use AI (a guest, or nobody signed in) | show a "request access" flow, or sign the user in |
| `onNotFound` | room/folder does not exist (404) | the entity was deleted on the portal — drop your stored mapping, offer to create a new one |
| `onNavigate` | Forms/Personal section change | `{ section }` |

## Manager / editor

| Event | Fires when | Payload |
|---|---|---|
| `onFileManagerClick` | a **file** row is activated in the manager list; folders never fire it (a folder click navigates into the folder) | the portal's file object, as returned by the files API (client 4.0.0): `id`, `title`, `fileExst` (`".docx"`), `fileType` (numeric), `folderId`, `rootFolderId`, `viewUrl`, `webUrl`, `security` (`{ Read, Edit, Download, … }`), `created`, `updated`, `createdBy`, `updatedBy`, `version`, `shared`, … Read `id`, `title`, `fileExst`; do not write "is it a file" heuristics — it always is. Registering the handler suppresses the portal's own open action, so open the file yourself (own viewer/editor frame) |
| `onEditorOpen` | the manager is about to open the editor (row activation without `onFileManagerClick`, context menu, hotkey, "Create" dialog) | the same file object plus `share` (share key when the room is opened by link, else empty) and `action`: `"view"` \| `"fill"` \| `"edit"`. When the user creates a new document, the payload is the created file (`id`, `title`, `fileExst`, `folderId`, …) with no `action`. Registering the handler suppresses the portal editor — host it in your own frame with `id: payload.id` |
| `onEditorCloseCallback` | editor closed (also when `editorGoBack: "event"`) | — |
| `onDownload` | download requested and `downloadToEvent: true` | `url: string` — bridge the file into the host system |

Both manager events fire only when the handler is present in `config.events`; leaving one
`null` restores the portal's default behaviour for that action.

SDK 2.2.0 types these payloads: `onSelectCallback` receives `TSelectedRoom[] | TSelectedFile`
(with `TRequestTokenInfo[]` under `requestTokens`), `onEditorOpen` a `TEditorOpenPayload`
(`TFileInfo` plus `share` and `action: TEditorAction`), `onFileManagerClick` a `TFileInfo`.
Import them from `@onlyoffice/docspace-sdk-js` instead of declaring your own shapes; the generated reference has
each one: [TFrameEvents](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/type-aliases/TFrameEvents.md), [TSelectedRoom](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/type-aliases/TSelectedRoom.md),
[TSelectedFile](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/type-aliases/TSelectedFile.md), [TEditorOpenPayload](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/type-aliases/TEditorOpenPayload.md).

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

## Custom actions (Forms)

| Event | Payload |
|---|---|
| `onCustomAction` | `{ action, type, item }` — `action` = the `key` registered via `setCustomActions` |

## External storage bridge

| Event | Direction | Semantics |
|---|---|---|
| `onGetExternalData` | frame asks host to **read** a value | receives `{ key, callId }`; return the value (sync or Promise) — the SDK posts it back correlated by `callId`. Throw/reject → routed to `onAppError`, no response sent |
| `onSetExternalData` | frame asks host to **persist** a value | receives `{ key, value }`; fire-and-forget — no response is posted back |

The meaning of `key`/`value` is integrator-defined; the SDK treats them as opaque.

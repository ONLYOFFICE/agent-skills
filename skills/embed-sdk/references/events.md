# TFrameEvents reference (SDK 2.2.0)

Pass handlers via `config.events`. All are optional (`null` = disabled). Events flow from
the iframe to the host. Payload shapes below are what real integrations rely on.

## Lifecycle

| Event | Fires when | Payload |
|---|---|---|
| `onAppReady` | frame app fully initialized — **methods may be called from here** | `{ frameId }` |
| `onContentReady` | frame content is visible — reveal the iframe, drop your spinner | — |
| `onAppError` | init or runtime error (including CSP failure on SDK < 2.2) | `message: string` |

Pattern from production: keep the iframe hidden (CSS) with your own spinner until
`onContentReady`, and gate all instance-method calls on `onAppReady`.

## Selectors (room-selector / file-selector)

| Event | Payload |
|---|---|
| `onSelectCallback` | **room-selector: an array** — `items[0].id`, `.label`, `.icon`, `.requestTokens[0].requestToken`; **file-selector: an object** — `item.id`, `.title`, `.icon`, `.documentType` |
| `onCloseCallback` | dialog closed/cancelled — no payload |

The `requestTokens[0].requestToken` from a selected room is exactly what `public-room`
mode needs.

## Auth

| Event | Fires when | Payload |
|---|---|---|
| `onAuthSuccess` | successful authorization inside the frame | object |
| `onAuthError` | OAuth mode: `getToken` threw/rejected or is missing | `{ code?, message }` |
| `onSignOut` | user signed out inside the frame — tear down and unlink the account on your side | — |

## Navigation / access

| Event | Fires when | Production reaction |
|---|---|---|
| `onNoAccess` | navigating to an inaccessible room/folder | show a "request access" flow |
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
Import them from `@onlyoffice/docspace-sdk-js` instead of declaring your own shapes.

## Uploads (Uploader + Forms modes)

| Event | Payload |
|---|---|
| `onUploadSuccess` | `{ fileName, fileSize, uploadId? }` |
| `onUploadError` | `{ fileName, message, uploadId? }` |
| `onUploadProgress` | progress object (Uploader only) |

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

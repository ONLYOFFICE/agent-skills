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
| `onFileManagerClick` | file row clicked in the manager list | item object (`id`, …) — e.g. open your own editor tab |
| `onEditorOpen` | editor opened from the manager (context menu, hotkey, modal) | object — e.g. intercept and host the editor in your own modal |
| `onEditorCloseCallback` | editor closed (also when `editorGoBack: "event"`) | — |
| `onDownload` | download requested and `downloadToEvent: true` | `url: string` — bridge the file into the host system |

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

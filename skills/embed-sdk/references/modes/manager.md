# Manager mode

Full file/room browser with CRUD; the default mode. The init call, the required pair (`frameId`, `src`) and the
common use cases — open a room by `id`, `onFileManagerClick`, `onEditorOpen`, `createRoom` after `onAppReady`,
`downloadToEvent` — are on the guide page `embedding-modes/manager-mode.md`; the fields with their defaults are in
`type-aliases/TFrameConfig.md`. This file keeps what the portal does with them (client 4.0.0).

- `id` = start folder; the SDK moves it into `filter.folder`. `rootPath` defaults to `/rooms/shared/`; the iframe
  URL is `{src}{rootPath}filter?{filter…}`, or `{src}{rootPath}{id}/filter?…` with an `id`.
- The loader is **forced on** (`noLoader` is ignored) — the SDK does that, not the page.
- `filter.sortBy` takes **API values** (`"AZ"`, `"DateAndTime"`, …), never enum key names; `sortBy: "Name"` yields
  an unsorted list without an error ([config-reference](../config-reference.md#manager-and-filter)).
- `viewAs` is deprecated in 2.2.0 and ignored by client 4.0.0 — the layout is the one the user last chose; call
  `setListView("table")` after `onAppReady`. `viewTableColumns` (default `"Index,Name,Size,Type,Tags"`, embeds often
  trim to `"Name,Size,Type"`) applies in the table layout until the user changes the columns; `showSettings` adds
  the column picker.
- `theme` is read once from the frame URL at load; an unknown value becomes `Base`, and a later `setConfig({ theme })`
  does nothing — pass `reload: true` to re-create the frame with the new theme.
- `onAppReady` fires again after every `setConfig` — guard a handler that itself calls `setConfig`.
- Over a `requestToken` (`rootPath: "/rooms/share"`) the page reports **every** access error as `onNotFound` — 401,
  402, 403 and 404 alike; `onNoAccess` (403) is only distinguished on a signed-in Manager.
- `logout()` resolves before the sign-out request completes; when the next step depends on the session being gone,
  run sign-out through a System frame, which awaits it.
- Instance methods handled here: the listings (`getFiles`, `getFolders`, `getList`, `getRooms`), `getSelection`,
  `getFolderInfo`, `createFile`/`createFolder` (act on the current folder), `createRoom`, tags, `setListView`, and the
  auth methods — the full matrix is in [methods](../methods.md#method-support-by-embedded-page-client-400).
- Typical embed: catch `onFileManagerClick` or `onEditorOpen` and host the editor yourself (own tab or modal with a
  second frame in editor mode, unique `frameId`); registering either handler suppresses the portal's own open action.
- A "read-only-ish" embed combines `editorGoBack: false`, `editorType: "embedded"`, `theme: "Base"` and a trimmed
  column set.

# Manager mode

Full file/room browser with CRUD. The default mode.

```js
const instance = sdk.initManager({
  frameId: "ds-frame",
  src: "https://portal.example.com",
  showMenu: true, showFilter: true, showTitle: true,
  theme: "Base",                   // read once, at load — see below
  filter: { sortBy: "AZ", sortOrder: "ascending", count: "50" },
  events: {
    onAppReady: () => {},
    onFileManagerClick: (item) => openMyEditorTab(item),
    onEditorOpen: (data) => {},
    onSignOut: () => unlinkAccount(),
  },
});
```

Key points:

- `id` (optional) = start folder; the SDK moves it into `filter.folder` automatically.
- `rootPath` default `/rooms/shared/`; the iframe URL is `{src}{rootPath}filter?{filter…}`
  (`{src}{rootPath}{id}/filter?…` with an `id`).
- The loader is **forced on** in this mode (`noLoader` is ignored).
- `filter.sortBy` takes **API values** (`"AZ"`, `"DateAndTime"`, …) — use `FilterSortBy`
  enum constants, never enum key names.
- `viewAs` is deprecated in 2.2.0 and ignored by client 4.0.0 — the layout is the one the user last chose;
  `setListView("table")` after `onAppReady` switches it. `viewTableColumns` (default
  `"Index,Name,Size,Type,Tags"`; embeds often trim to `"Name,Size,Type"`) applies in the table layout until
  the user changes the columns; `showSettings` adds the column picker.
- Instance methods available here: all listings (`getFiles`, `getFolders`, `getList`,
  `getRooms`), `getSelection`, `getFolderInfo`, `createFile`/`createFolder` (act on the
  current folder), `createRoom`, tags, `setListView`.
- `theme` is read once from the frame URL when the page loads; an unknown value becomes `Base`, and a later
  `setConfig({ theme })` does nothing — pass `reload: true` to re-create the frame with the new theme (client 4.0.0).
- Over a `requestToken` (`rootPath: "/rooms/share"`) the page reports **every** access error as `onNotFound` —
  401, 402, 403 and 404 alike; `onNoAccess` (403) is only distinguished on a signed-in Manager.
- `logout()` from a Manager frame resolves before the sign-out request completes; when the next step depends on the
  session being gone, run sign-out through a System frame, which awaits it.
- Typical embed pattern: catch `onFileManagerClick` or `onEditorOpen` and host the editor
  yourself (own tab/modal with a second frame in editor mode, unique `frameId`).
- Front-end "read-only-ish" embeds combine `editorGoBack: false`, `editorType: "embedded"`,
  `theme: "Base"` and a trimmed column set.

Config field reference: [config-reference.md](../config-reference.md#manager-and-filter).

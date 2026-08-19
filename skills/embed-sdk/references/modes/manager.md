# Manager mode

Full file/room browser with CRUD. The default mode.

```js
const instance = sdk.initManager({
  frameId: "ds-frame",
  src: "https://portal.example.com",
  showMenu: true, showFilter: true, showTitle: true,
  viewAs: "table",
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
- `rootPath` default `/rooms/shared/`; the iframe URL is `{src}{rootPath}?{filter…}`.
- The loader is **forced on** in this mode (`noLoader` is ignored).
- `filter.sortBy` takes **API values** (`"AZ"`, `"DateAndTime"`, …) — use `FilterSortBy`
  enum constants, never enum key names.
- `viewAs: "table"` pairs with `viewTableColumns` (default `"Index,Name,Size,Type,Tags"`;
  embeds often trim to `"Name,Size,Type"`) and `showSettings` for the column picker.
- Instance methods available here: all listings (`getFiles`, `getFolders`, `getList`,
  `getRooms`), `getSelection`, `getFolderInfo`, `createFile`/`createFolder` (act on the
  current folder), `createRoom`, tags, `setListView`.
- Typical embed pattern: catch `onFileManagerClick` or `onEditorOpen` and host the editor
  yourself (own tab/modal with a second frame in editor mode, unique `frameId`).
- Front-end "read-only-ish" embeds combine `editorGoBack: false`, `editorType: "embedded"`,
  `theme: "Base"` and a trimmed column set.

Config field reference: [config-reference.md](../config-reference.md#manager-mode).

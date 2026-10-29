# File

To own a file extension — icon, open action.

| | |
|---|---|
| Types | [`IFileItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IFileItem.md), [`IFilePlugin`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/plugins/IFilePlugin.md) |
| The loader reads | `getFileItems()`, keyed by `extension` |
| Role filter | `usersType` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | none — a click may open a modal or the media viewer |
| Redraw after a change | `updateFileItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line — the `File` the click receives included — is on [`IFileItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IFileItem.md); what the portal does beyond it:

- `extension` is also the map key and **must equal the file's extension with the dot** (`".md"`).
- `fileRowIcon` is the icon everywhere **except the tiles view** — rows, table, upload panel, version history. The portal's icon lookup takes a size argument and ignores it for a plugin extension, so this one SVG is drawn at every size in those views.
- **The tiles view reads `fileTileIcon`, and falls back to `fileRowIcon` without it.** Ship it when the tile wants a drawing of its own size; a row icon stretched to a tile is what appears otherwise.
- `fileSecurity` / `security` / `devices` are evaluated at click time, not at registration.

**A failed `fileSecurity` / `security` / `devices` check means `onClick` never runs at all.** The portal wraps your handler and returns early when a key is not allowed — and only the *click* is filtered: the row keeps your `fileTypeName` and your icons, so the user clicks a file the plugin visibly owns and nothing happens, with no toast and no console line. So these fields say "this action does not exist here", nothing softer. When a denial has to be *explained*, leave them unset and check the permission inside `onClick` — the portal hands the handler its whole file row, whose `security` map the SDK's `File` does not declare (read it through a cast, or re-fetch the file's metadata). A filtered handler has no message to show because it never ran.

Clicks in the file list, upload panel and version history route to `onClick`; Ctrl/middle-click opens `viewUrl` directly. Opening "in ONLYOFFICE Apps" = `showModal` with a `dialogBodyComponent` (an aside for document-like content) or `showMediaViewer` with a `component` ([modal-dialog.md](../components/modal-dialog.md), [media-viewer.md](../components/media-viewer.md)). A modal opened from this click gets no current file, so hand it the `File` you were given ([hooks.md](../react/hooks.md#what-usecurrentfile-returns-where)); the media viewer opens on the file whose id you pass as `fileId`, and its component reads that file with `useCurrentFile()`. Creating such files needs `enableExternalExt` ([rest-api.md](../rest-api.md#creating-a-file-whose-extension-the-portal-does-not-own)).

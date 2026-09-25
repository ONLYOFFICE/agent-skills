# ContextMenu

An action on a selected file, folder or room.

| | |
|---|---|
| Types | `IContextMenuItem`, `IContextMenuPlugin` |
| The loader reads | `getContextMenuItems()`, keyed by `key` |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | none — a click may open a modal ([modal-dialog.md](../components/modal-dialog.md)) |
| Redraw after a change | `updateContextMenuItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | prefix with the manifest's `name`, verbatim — the maps are [portal-wide](common-fields.md#item-keys-are-portal-wide) |
| `label`, `icon` | ✔ | icon: file name only, 16×16 |
| `onItemClick` | | `(id) => IMessage` — the clicked file/folder/room id. Supersedes the deprecated `onClick` |
| `onGroupClick` | | `(items: { id, itemType: "file" \| "folder" \| "room" }[]) => IMessage` |
| `isGroupAction` | | `true` → shows only in the **multi-selection** menu, and only when every selected entity passes the filters; `onItemClick` is then never called. Supporting both modes = **two items**, one plain and one group. This is the portal's surface for bulk actions |
| `withActiveItem` | | selected rows show the "operation in progress" state while the handler runs |
| `items` | | submenu, max depth 2. A parent with `items` is never clickable; if every child is filtered out the parent disappears |
| `fileType` | | `FilesType[]` — `room`, `file`, `folder`, `image`, `video`. **Here `file` means "a file the media viewer does not claim"**: an image or a video is tested as `image`/`video` and fails a `[file]` filter, so "any file" is `[FilesType.file, FilesType.image, FilesType.video]`. (The InfoPanel scope reads the same values the other way round — see [info-panel-item.md](info-panel-item.md)) |
| `fileExt` | | matched only when the clicked thing has an extension; include the dot. Applies to `image`/`video` too |
| `itemId` | | restrict to specific entity ids |
| `usersTypes` | | |
| `devices` | | |
| `security` / `itemSecurity` | | the parent's map and the item's own; see the mixed-selection note below |
| `placement` | | `"top"` → first entry; `"topLast"` → before the first separator; not on nested items, **and dropped for `isGroupAction`** — the bulk-selection menu rebuilds the entry from `key`/`label`/`icon`/`onClick` only, so a group item always lands in the default group |

Without `placement`, plugin items land in the menu's **"More options"** group behind a separator, in registration order. Filters are evaluated when the menu opens. Items never show in Trash or on an **archived** room; for `image`/`video` they also appear in the media viewer's menu. A click that needs UI returns `showModal` with a `dialogBodyComponent` — which gets **no current file**; pass the id yourself ([hooks.md](../react/hooks.md#what-usecurrentfile-returns-where)).

**A bulk action is flat, not a submenu.** `isGroupAction` is dispatched through `onGroupClick` and nothing else, while a parent carrying `items` has no click of its own — so the two do not combine: give the user two group items ("Archive here", "Archive to…") rather than one parent with children. The validator refuses `isGroupAction` without `onGroupClick`, which is what a submenu parent looks like.

**A mixed selection is one `itemSecurity` list against three different maps.** The group menu offers your item only when *every* selected row already passed the filters, and each row was filtered against its own security map — a file's has `Edit`, `Convert`, `Lock`, `FillForms`; a folder's and a room's have `Create`, `EditRoom`, `Pin`, `MoveTo`. A key that only one kind of entity carries is therefore missing on the others, they fail, and the item vanishes from any selection that mixes them — with nothing to see, since the filter's job is to hide. The keys present in all three maps: `Read`, `Rename`, `Move`, `Copy`, `Duplicate`, `Delete`, `Download`, `CopyLink`, `Embed`, `CreateRoomFrom`. Anything outside that set only makes sense for an item already narrowed to one kind with `fileType`.

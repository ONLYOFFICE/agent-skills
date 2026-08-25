# Item shapes per scope

What goes into each scope's map, and what the portal actually does with it — where the item renders, what the callback receives, which fields are read when. Verified against the client this skill targets.

The user-type filter field differs per scope and is the single most common mistake — it is repeated in every table below rather than stated once, because that is where it gets missed.

## ContextMenu

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | prefix with the manifest's `name`, spelled exactly as it appears there — the map is portal-wide |
| `label` | ✔ | |
| `icon` | ✔ | file name only, 16×16; recolored only where shapes carry explicit `fill` attributes (see [ui-components.md](ui-components.md#the-portals-visual-language)) |
| `onItemClick` | | `(id: string \| number) => IMessage` — the id of the clicked file/folder/room. Prefer this over the deprecated `onClick` |
| `onGroupClick` | | `(items: GroupItem[]) => IMessage`, where `GroupItem` is `{ id, itemType: "file" \| "folder" \| "room" }` |
| `isGroupAction` | | `true` → the item shows only in the **multi-selection** menu, and only when *every* selected entity passes the item's filters; it is hidden for single selection, and `onItemClick`/`onClick` are then never called, so supporting both modes means registering **two items**, one plain and one group. This is the portal's surface for bulk actions — with `fileType: [FilesType.room]` the ticked rooms arrive in `onGroupClick` |
| `withActiveItem` | | `true` → the selected rows show the portal's "operation in progress" state while your handler runs |
| `items` | | submenu, max depth 2. **A parent with `items` is never clickable** — its own handlers are ignored. If every child is filtered out, the parent disappears |
| `fileType` | | `FilesType[]` — `room`, `file`, `folder`, `image`, `video` |
| `fileExt` | | matched only when the clicked thing has an extension (`file`/`image`/`video`); include the dot |
| `itemId` | | `(number \| string)[]` — restrict to specific entities by id |
| `usersTypes` | | **plural** for this scope |
| `devices` | | |
| `security` | | every listed `Security` key must be allowed on the **parent folder/room** |
| `itemSecurity` | | every listed key must be allowed on the **clicked item itself** |
| `placement` | | `"top"` → first entry; `"topLast"` → just before the first separator; not allowed on nested items |

Where it lands: without `placement`, plugin items go into the menu's **"More options" group** behind a separator, in registration order (there is no sorting). Filters are evaluated when the menu opens, not at registration, so role and security changes apply live. Items never show in Trash. Files whose type is `image`/`video` also surface the item in the **media viewer's** context menu.

## MainButton

| Field | Required | Notes |
|---|---|---|
| `key`, `label`, `icon` | ✔ | icon 16×16 |
| `onItemClick` | | `(id: number \| string) => IMessage` — the id of the **current folder** |
| `items` | | one level of sub-items; defining it disables the parent's own click |
| `usersType` | | **singular** for this scope |
| `devices` | | |

Where it lands: plugin entries are **not top-level**. The portal groups them all under a single **"More"** sub-entry of the main button (and of the section "+" menu), at a fixed position after the standard create actions. The click handler does nothing when there is no current folder id — on views without a folder context the item is effectively inert.

## ProfileMenu

| Field | Required | Notes |
|---|---|---|
| `key`, `label`, `icon` | ✔ | icon 16×16 |
| `onClick` | ✔ | takes **no arguments**; there is no `onItemClick` here |
| `usersType` | | **singular** |
| `devices` | | |

Portal quirk: the host also reads a `position` field this scope's SDK type does not declare — it is used verbatim as an index into the profile menu's action array (separators included), appending when out of range. Without it the item lands at the end. Use it only via a cast and only if placement genuinely matters.

## InfoPanel

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | the tab's id becomes `info_plugin-<key>` — which is also what `Actions.openInfoPanel` takes as `infoPanelTab` to open **your own tab** programmatically |
| `subMenu` | ✔ | `{ name: string; onClick?: (id: number) => IMessage }` — `name` is the tab label; `onClick` fires with the selected entity's id **every time the selection changes**, not on tab click only |
| `body` | ✔ | `IBox` — the tab content |
| `onLoad` | | `() => Promise<{ body: IBox }>` — only `body` is read from the result |
| `isHeaderVisible` | | default `true`; `false` removes the file/room title block above your body |
| `filesType` | | omit → tab shows for everything; `room` → rooms, `folder` → folders, `file` → files (then `filesExsts` can narrow the extensions) |
| `filesExsts` | | only honoured when `filesType` includes `file` |
| `usersTypes` | | **plural** |
| `devices` | | |

Where it lands: after the portal's own tabs (Members/Share, History, Details). The panel body is ~337px of usable width on desktop (360px minus its own padding) and **already scrolls** — do not add `overflowProp` to the tab body, size content naturally. The tab is suppressed for Trash, multi-selection and the root folder.

## EventListener

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | |
| `eventType` | ✔ | `Events`: `CREATE`, `RENAME`, `ROOM_CREATE`, `ROOM_EDIT`, `CHANGE_COLUMN`, `CHANGE_USER_TYPE`, `CREATE_PLUGIN_FILE` |
| `eventHandler` | ✔ | takes **no arguments** |
| `usersTypes` | | **plural** |
| `devices` | | |

Handlers are subscribed as plain `window` listeners on the event name, for as long as the portal shell is mounted.

**`eventHandler` receives nothing.** The portal does pass the DOM event to its wrapper, but the wrapper calls your handler with no arguments, so the handler learns only *that* something happened. Fetch the details yourself.

This scope also has no `updateEventListenerItem` method — re-add to replace.

## File

| Field | Required | Notes |
|---|---|---|
| `extension` | ✔ | also the map key. **Must equal the file's extension including the dot** (`".md"`), because the click dispatch matches the map key against the file's `fileExst`. If two plugins claim it, the last loaded wins |
| `onClick` | ✔ | `(file: File) => IMessage`, where `File` carries `id`, `title`, `fileExst`, `folderId`, `rootFolderId`, `rootFolderType`, `viewUrl`, `webUrl` |
| `fileTypeName` | | shown as the Type column value in table view (only where the portal itself has no name for the type) |
| `fileRowIcon` | | file name in `assets/`. The host uses this **one icon at every size** — rows, table and tiles alike — so ship an SVG that reads at both 32px and 96px |
| `fileTileIcon` | | accepted and carried all the way onto the file object, **and then never rendered** — dead data |
| `fileSecurity` | | every listed key must be allowed on the clicked file — checked at click time, inside the host's wrapper |
| `security` | | same, but against the current folder |
| `usersType` | | **singular** |
| `devices` | | checked at click time rather than at registration |

Where it fires: clicking the file in the file list, the upload panel and version history all route to your `onClick` instead of the portal's own open action. Ctrl/middle-click opens the file's `viewUrl` directly, bypassing the plugin.

## ArticleButton

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | |
| `body` | ✔ | `IBox`, rendered into a **hard 32×32 slot with `overflow: hidden`** — anything larger is clipped, text does not fit. In practice the body is a single `iconButton` (size 32) or a 32×32 `img` |
| `onLoad` | | `() => Promise<{ body: IBox }>` |
| `usersTypes` | | **plural** |
| `devices` | | |

The slot itself has no click handler — interactivity comes from what you put inside, so the body's component must carry its own `onClick`. There is no refresh action for this scope in the SDK ([host-behavior.md](host-behavior.md) has the fall-through workaround).

The portal renders these items in **two** sidebars — the article sidebar and the apps sidebar — from the same map, so one registered item appears in both. Each surface shows at most **five** buttons across all installed plugins combined, in registration order; the sixth is dropped silently.

## Enum values worth having at hand

`UsersType` — keys are camelCase, values PascalCase: `owner: "Owner"`, `docSpaceAdmin: "DocSpaceAdmin"`, `roomAdmin: "RoomAdmin"`, `collaborator: "Collaborator"`, `user: "User"`.

`Devices` — `mobile`, `tablet`, `desktop`.

`FilesType` — `room`, `file`, `folder`, `image`, `video`.

`ToastType` — `success`, `error`, `warning`, `info`.

`PluginLocale` — 33 locales, values like `EN_US = "en-US"`, `RU = "ru"`, `PT_BR = "pt-BR"`, `ZH_CN = "zh-CN"`.

`FilesExst` covers the document, spreadsheet, presentation, media and archive extensions DocSpace knows; a plain string works too when the extension is your own.

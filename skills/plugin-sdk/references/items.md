# Item shapes per scope

What goes into each scope's map and what the portal does with it — where the item renders, what the callback receives, which fields are read when. Field types are in the SDK's `.d.ts`; this records the host's behaviour. The user-type filter is spelled `usersTypes` in some scopes and `usersType` in others: each table below carries the spelling the host reads **for that scope**, and the wrong one is skipped in silence ([the trap](portal.md#the-filter-field-trap)).

Where an item has a visible surface it is a React component passed as `component` ([react.md](react.md)); the SDK 2 `body`/`onLoad` pairs still render, marked deprecated.

## ContextMenu

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | prefix with the manifest's `name`, verbatim — the maps are [portal-wide](portal.md#item-keys-are-portal-wide) |
| `label`, `icon` | ✔ | icon: file name only, 16×16 |
| `onItemClick` | | `(id) => IMessage` — the clicked file/folder/room id. Supersedes the deprecated `onClick` |
| `onGroupClick` | | `(items: { id, itemType: "file" \| "folder" \| "room" }[]) => IMessage` |
| `isGroupAction` | | `true` → shows only in the **multi-selection** menu, and only when every selected entity passes the filters; `onItemClick` is then never called. Supporting both modes = **two items**, one plain and one group. This is the portal's surface for bulk actions |
| `withActiveItem` | | selected rows show the "operation in progress" state while the handler runs |
| `items` | | submenu, max depth 2. A parent with `items` is never clickable; if every child is filtered out the parent disappears |
| `fileType` | | `FilesType[]` — `room`, `file`, `folder`, `image`, `video`. **Here `file` means "a file the media viewer does not claim"**: an image or a video is tested as `image`/`video` and fails a `[file]` filter, so "any file" is `[FilesType.file, FilesType.image, FilesType.video]`. (The InfoPanel scope reads the same values the other way round — see below) |
| `fileExt` | | matched only when the clicked thing has an extension; include the dot. Applies to `image`/`video` too |
| `itemId` | | restrict to specific entity ids |
| `usersTypes` | | |
| `devices` | | |
| `security` / `itemSecurity` | | the parent's map and the item's own; see the mixed-selection note below |
| `placement` | | `"top"` → first entry; `"topLast"` → before the first separator; not on nested items, **and dropped for `isGroupAction`** — the bulk-selection menu rebuilds the entry from `key`/`label`/`icon`/`onClick` only, so a group item always lands in the default group |

Without `placement`, plugin items land in the menu's **"More options"** group behind a separator, in registration order. Filters are evaluated when the menu opens. Items never show in Trash or on an **archived** room; for `image`/`video` they also appear in the media viewer's menu. A click that needs UI returns `showModal` with a `dialogBodyComponent` — which gets **no current file**; pass the id yourself ([react.md](react.md#what-usecurrentfile-returns-where)).

**A bulk action is flat, not a submenu.** `isGroupAction` is dispatched through `onGroupClick` and nothing else, while a parent carrying `items` has no click of its own — so the two do not combine: give the user two group items ("Archive here", "Archive to…") rather than one parent with children. The validator refuses `isGroupAction` without `onGroupClick`, which is what a submenu parent looks like.

**A mixed selection is one `itemSecurity` list against three different maps.** The group menu offers your item only when *every* selected row already passed the filters, and each row was filtered against its own security map — a file's has `Edit`, `Convert`, `Lock`, `FillForms`; a folder's and a room's have `Create`, `EditRoom`, `Pin`, `MoveTo`. A key that only one kind of entity carries is therefore missing on the others, they fail, and the item vanishes from any selection that mixes them — with nothing to see, since the filter's job is to hide. The keys present in all three maps: `Read`, `Rename`, `Move`, `Copy`, `Duplicate`, `Delete`, `Download`, `CopyLink`, `Embed`, `CreateRoomFrom`. Anything outside that set only makes sense for an item already narrowed to one kind with `fileType`.

## MainButton

| Field | Required | Notes |
|---|---|---|
| `key`, `label`, `icon` | ✔ | icon 16×16 |
| `onItemClick` | | `(id) => IMessage` — the **current folder** id |
| `items` | | one level of sub-items; disables the parent's own click. The filters below are read on the **parent only** — children are copied in unfiltered, so a sub-item cannot narrow its own audience |
| `usersType` | | |
| `devices` | | |

Plugin entries are grouped under a single **"More"** sub-entry of the main button and the section "+" menu, after the standard create actions. The gate is not "a view without a folder context": the button builds its own menu per section and **returns before reaching plugin items** in the Rooms list, AI agents and portal settings, and skips them on the accounts page — so a plugin entry appears where the portal itself offers file creation, and nowhere else. This is the surface for "create a new …"; an action on existing things belongs in `ContextMenu`.

## ProfileMenu

| Field | Required | Notes |
|---|---|---|
| `key`, `label`, `icon` | ✔ | icon 16×16 |
| `onClick` | ✔ | takes **no arguments**; there is no `onItemClick` here |
| `usersType` | | |
| `devices` | | |

The menu renders the item and nothing else — there is no canvas here, so whatever the feature shows comes from what `onClick` returns: `showModal` for a form, an aside for a list, or `navigate` to an `ArticleNavigation` page of your own for a whole screen. Nothing about the scope restricts it to the viewer's own data; it is simply the entry point that lives in the profile menu, and it is a normal pairing with a page.

Quirk: the host reads an undeclared `position` field as an index into the profile menu's action array (separators included). Cast if placement genuinely matters.

## InfoPanel

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | the tab id becomes `info_plugin-<key>`; also what `openInfoPanel(key)` takes to open your own tab |
| `subMenu` | ✔ | `{ name, onClick?: (id) => IMessage }` — `name` is the tab label; `onClick` fires on **every selection change**. A React tab rarely needs it |
| `component` | ✔* | the tab body; `useCurrentFile()` is the selection, live — fetch in an effect keyed on `file?.id` |
| `isHeaderVisible` | | **defaults to `true`** — the file/room title block is above your component unless you pass `false`. Only an explicit `false` removes it |
| `filesType` | | omit → everything. Five values: `room` / `folder` / `file` / `image` / `video`. **Here `file` also matches images and videos** — the opposite of the ContextMenu scope, where they are separate — so `[file]` is already "any file". `folder` matches **rooms** too (a room has no extension either), so a folder-only tab shows on rooms as well; narrow it in the component if that is wrong |
| `filesExsts` | | honoured only when `filesType` includes `file` |
| `usersTypes` | | |
| `devices` | | |
| `body`, `onLoad` | deprecated | ignored when `component` is present |

\* one of `component` or `body`. Renders after the portal's own tabs; ~337px wide and already scrolls — do not add a scroll container. Suppressed for Trash, multi-selection and the root folder.

## EventListener

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | |
| `eventType` | ✔ | `Events`: `CREATE`, `RENAME`, `ROOM_CREATE`, `ROOM_EDIT`, `CHANGE_COLUMN`, `CHANGE_USER_TYPE`, `CREATE_PLUGIN_FILE` |
| `eventHandler` | ✔ | the SDK declares **no parameters** and nothing about a payload is contracted: treat it as "the user started doing something" and read the details yourself |
| `usersTypes` | | |
| `devices` | | |

Subscribed as plain `window` listeners. No `updateEventListenerItem`: re-add to replace. The returned message is not restricted to toasts — see [the note below](#the-event-fires-when-the-dialog-opens).

### The event fires when the dialog opens

**These are not completion events.** `CREATE`, `ROOM_CREATE`, `RENAME`, `ROOM_EDIT` and `CHANGE_USER_TYPE` are dispatched when the portal *opens the dialog* for that operation — before the user has typed a name, and whether or not they go on to confirm it. `CHANGE_COLUMN` fires from the table header the same way, and `CREATE_PLUGIN_FILE` when any plugin's `showCreateDialog` opens the portal's create dialog. There is **no event for the operation finishing**, and no id of a created entity to receive, because nothing has been created yet.

So an event handler that reports (`"Room created"`) is wrong at least as often as it is right: the user pressing Esc gets the toast anyway. What the scope is actually for is reacting to the *intent* — refreshing your own item labels, arming state a later click will read, recording that a flow was entered. When the plugin genuinely needs to know a room now exists, poll or re-read the listing from the surface that cares, rather than trusting the event.

```ts
// The user opened the create-room dialog. Nothing exists yet, so nothing is announced.
eventHandler: async () => ({ actions: [Actions.updateArticleNavigationItems] })
```

**The returned message is not restricted.** The SDK's own doc says only toasts and item updates are honoured; the host does not check — the message goes through the same dispatcher as any class-side callback, and `showModal` really opens (the panels are mounted globally, not per surface). Keep to item updates by choice: the event fires on the portal's schedule, over a dialog the portal has just opened, so a modal or a `navigate` from here lands on top of what the user was in the middle of.

## File

| Field | Required | Notes |
|---|---|---|
| `extension` | ✔ | also the map key; **must equal the file's extension with the dot** (`".md"`). Two plugins claiming it → the last loaded wins |
| `onClick` | ✔ | `(file: File) => IMessage` — `File` carries `id`, `title`, `fileExst`, `folderId`, `rootFolderId`, `rootFolderType`, `viewUrl`, `webUrl` |
| `fileTypeName` | | the Type column value, where the portal has no name of its own |
| `fileRowIcon` | | file name in `assets/`; the icon everywhere **except the tiles view** — rows, table, upload panel, version history. The portal's icon lookup takes a size argument and ignores it for a plugin extension, so this one SVG is drawn at every size in those views |
| `fileTileIcon` | | file name in `assets/`; **the tiles view reads this one and only this one** (96×96). Ship it — recent portals fall back to `fileRowIcon` when it is missing, but older ones request `assets/undefined`, get a 404 and draw an empty tile |
| `fileSecurity` / `security` | | evaluated at click time, not at registration; see the note below |
| `usersType` | | |
| `devices` | | checked at click time |

**A failed `fileSecurity` / `security` / `devices` check means `onClick` never runs at all.** The portal wraps your handler and returns early when a key is not allowed — and only the *click* is filtered: the row keeps your `fileTypeName` and your icons, so the user clicks a file the plugin visibly owns and nothing happens, with no toast and no console line. So these fields say "this action does not exist here", nothing softer. When a denial has to be *explained*, leave them unset and check the permission inside `onClick` — the portal hands the handler its whole file row, whose `security` map the SDK's `File` does not declare (read it through a cast, or re-fetch the file's metadata). A filtered handler has no message to show because it never ran.

Clicks in the file list, upload panel and version history route to `onClick`; Ctrl/middle-click opens `viewUrl` directly. Opening "in ONLYOFFICE Apps" = `showModal` with a `dialogBodyComponent` (an aside for document-like content) or `showMediaViewer` with a `component` ([components.md](components.md)), passing the `File` you were given — neither gets a current file from a class-side click ([react.md](react.md#what-usecurrentfile-returns-where)). Creating such files needs `enableExternalExt` ([rest-api.md](rest-api.md#creating-a-file-whose-extension-the-portal-does-not-own)).

## ArticleButton

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | |
| `component` | ✔* | a **32×32 slot with `overflow: hidden`** — text does not fit; in practice one kit `IconButton size={32}` with its own `onClick` |
| `usersTypes` | | |
| `devices` | | |
| `body`, `onLoad` | deprecated | |

The slot has no click handler of its own. Rendered in **two** sidebars (article and apps) from the same map; each shows at most **five** buttons across all plugins, in registration order — the sixth is dropped silently. A natural way to *open* something (`navigate("/p/<key>")`, an aside, a selector), a poor place for the thing itself.

```tsx
const SidebarButton = () => {
  const { navigate } = usePluginActions();
  return <IconButton size={32} title={t("openReports")} onClick={() => navigate("/p/my-plugin-reports")}
                     iconNode={<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="…" /></svg>} />;
};
```

## ArticleNavigation

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | the last URL segment — `/p/<key>`, `/accounts/p/<key>` or `/portal-settings/p/<key>` — so unique across **every installed plugin** |
| `label` | ✔ | sidebar text; a rename needs `updateArticleNavigationItem` + `updateArticleNavigationItems()` |
| `icon` | ✔ | file name in `assets/`, 20×20 |
| `component` | ✔ | the whole page. `useCurrentFile()` is `null`; work from `useCurrentUser()` and `usePluginAPI()` |
| `appears` | | `Section[]` — `Files`, `Accounts`, `Settings`; the entry shows only in those sidebars and the page is reachable only under their paths. Omit → every section |
| `usersTypes` | | |
| `devices` | | |

A first-class entry beside Rooms and Documents; the page is a full section — own route, deep-linkable, the portal's header and sidebar around it, no folder context. An unknown key or a section not in `appears` redirects to the root. The scope for anything that is a **screen**: dashboards, lists, a plugin's own workspace.

```ts
export const roomsPageItem = (): IArticleNavigationItem => ({
  key: "my-plugin-rooms", label: t("rooms.navLabel"), icon: "icon-20.svg", component: RoomsPage, appears: [Section.Files],
});
// in onLoadCallback: this.addArticleNavigationItem(roomsPageItem());
```

## Enum values worth having at hand

`Devices` — `mobile`, `tablet`, `desktop`. `Section` — `Files`, `Accounts`, `Settings`. `ToastType` — `success`, `error`, `warning`, `info`. `PluginLocale` — 33 locales, values like `"en-US"`, `"ru"`, `"pt-BR"`. `FilesExst` covers the extensions ONLYOFFICE Apps knows; a plain string works for your own.

### `UsersType` does not name the roles the portal shows

Keys are camelCase, values PascalCase — `owner: "Owner"`, `docSpaceAdmin: "DocSpaceAdmin"`, `roomAdmin: "RoomAdmin"`, `collaborator: "Collaborator"`, `user: "User"` — and **two of them mean the opposite of what they read like**, because the product renamed the roles and the enum did not:

| `UsersType` member | The role as the portal labels it today |
|---|---|
| `owner` | Owner |
| `docSpaceAdmin` | ONLYOFFICE Apps admin |
| `roomAdmin` | Room admin — also everyone the other four do not match |
| `collaborator` | **User** |
| `user` | **Guest** |

So `usersTypes: [UsersType.user]` is "guests only", not "signed-in users", and the internal-staff filter most features want is `[UsersType.owner, UsersType.docSpaceAdmin, UsersType.roomAdmin, UsersType.collaborator]`. Getting this backwards shows a feature to exactly the audience it was meant to be hidden from, and nothing reports it.

# Item shapes per scope

What goes into each scope's map and what the portal does with it — where the item renders, what the callback receives, which fields are read when. Field types are in the SDK's `.d.ts`; this records the host's behaviour. The user-type filter field differs per scope and is repeated in every table on purpose.

Where an item has a visible surface it is a React component passed as `component` ([react.md](react.md)); the SDK 2 `body`/`onLoad` pairs still render, marked deprecated.

## ContextMenu

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | prefix with the manifest's `name`, verbatim — the map is portal-wide |
| `label`, `icon` | ✔ | icon: file name only, 16×16 |
| `onItemClick` | | `(id) => IMessage` — the clicked file/folder/room id. Supersedes the deprecated `onClick` |
| `onGroupClick` | | `(items: { id, itemType: "file" \| "folder" \| "room" }[]) => IMessage` |
| `isGroupAction` | | `true` → shows only in the **multi-selection** menu, and only when every selected entity passes the filters; `onItemClick` is then never called. Supporting both modes = **two items**, one plain and one group. This is the portal's surface for bulk actions |
| `withActiveItem` | | selected rows show the "operation in progress" state while the handler runs |
| `items` | | submenu, max depth 2. A parent with `items` is never clickable; if every child is filtered out the parent disappears |
| `fileType` | | `FilesType[]` — `room`, `file`, `folder`, `image`, `video` |
| `fileExt` | | matched only when the clicked thing has an extension; include the dot |
| `itemId` | | restrict to specific entity ids |
| `usersTypes` | | **plural** |
| `devices` | | |
| `security` / `itemSecurity` | | every listed `Security` key must be allowed on the **parent folder/room** / on the **clicked item** |
| `placement` | | `"top"` → first entry; `"topLast"` → before the first separator; not on nested items |

Without `placement`, plugin items land in the menu's **"More options"** group behind a separator, in registration order. Filters are evaluated when the menu opens. Items never show in Trash; for `image`/`video` they also appear in the media viewer's menu. A click that needs UI returns `showModal` with a `dialogBodyComponent` — which gets **no current file**; pass the id yourself.

## MainButton

| Field | Required | Notes |
|---|---|---|
| `key`, `label`, `icon` | ✔ | icon 16×16 |
| `onItemClick` | | `(id) => IMessage` — the **current folder** id |
| `items` | | one level of sub-items; disables the parent's own click |
| `usersType` | | **singular** |
| `devices` | | |

Plugin entries are grouped under a single **"More"** sub-entry of the main button and the section "+" menu, after the standard create actions. Inert on views without a folder context. This is the surface for "create a new …"; an action on existing things belongs in `ContextMenu`.

## ProfileMenu

| Field | Required | Notes |
|---|---|---|
| `key`, `label`, `icon` | ✔ | icon 16×16 |
| `onClick` | ✔ | takes **no arguments**; there is no `onItemClick` here |
| `usersType` | | **singular** |
| `devices` | | |

The menu renders the item and nothing else — there is no canvas here, so whatever the feature shows comes from what `onClick` returns: `showModal` for a form, an aside for a list, or `navigate` to an `ArticleNavigation` page of your own for a whole screen. Nothing about the scope restricts it to the viewer's own data; it is simply the entry point that lives in the profile menu, and it is a normal pairing with a page.

Quirk: the host reads an undeclared `position` field as an index into the profile menu's action array (separators included). Cast if placement genuinely matters.

## InfoPanel

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | the tab id becomes `info_plugin-<key>`; also what `openInfoPanel(key)` takes to open your own tab |
| `subMenu` | ✔ | `{ name, onClick?: (id) => IMessage }` — `name` is the tab label; `onClick` fires on **every selection change**. A React tab rarely needs it |
| `component` | ✔* | the tab body; `useCurrentFile()` is the selection, live — fetch in an effect keyed on `file?.id` |
| `isHeaderVisible` | | default `true`; `false` removes the title block above the component |
| `filesType` | | omit → everything; `room` / `folder` / `file` (then `filesExsts` narrows) |
| `filesExsts` | | honoured only when `filesType` includes `file` |
| `usersTypes` | | **plural** |
| `devices` | | |
| `body`, `onLoad` | deprecated | ignored when `component` is present |

\* one of `component` or `body`. Renders after the portal's own tabs; ~337px wide and already scrolls — do not add a scroll container. Suppressed for Trash, multi-selection and the root folder.

## EventListener

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | |
| `eventType` | ✔ | `Events`: `CREATE`, `RENAME`, `ROOM_CREATE`, `ROOM_EDIT`, `CHANGE_COLUMN`, `CHANGE_USER_TYPE`, `CREATE_PLUGIN_FILE` |
| `eventHandler` | ✔ | takes **no arguments** — the handler learns only *that* something happened; fetch the details |
| `usersTypes` | | **plural** |
| `devices` | | |

Subscribed as plain `window` listeners. From the returned message only toasts and item updates are honoured — a modal is ignored. No `updateEventListenerItem`: re-add to replace.

```ts
eventHandler: async () => ({ actions: [Actions.showToast, Actions.updateArticleNavigationItems], toastProps: [{ type: ToastType.info, title: t("roomCreated") }] })
```

## File

| Field | Required | Notes |
|---|---|---|
| `extension` | ✔ | also the map key; **must equal the file's extension with the dot** (`".md"`). Two plugins claiming it → the last loaded wins |
| `onClick` | ✔ | `(file: File) => IMessage` — `File` carries `id`, `title`, `fileExst`, `folderId`, `rootFolderId`, `rootFolderType`, `viewUrl`, `webUrl` |
| `fileTypeName` | | the Type column value, where the portal has no name of its own |
| `fileRowIcon` | | file name in `assets/`; used **at every size** (rows, table, tiles) — ship an SVG |
| `fileTileIcon` | | carried onto the file object and **never rendered** |
| `fileSecurity` / `security` | | every listed key must be allowed on the clicked file / the current folder, checked at click time |
| `usersType` | | **singular** |
| `devices` | | checked at click time |

Clicks in the file list, upload panel and version history route to `onClick`; Ctrl/middle-click opens `viewUrl` directly. Opening "in DocSpace" = `showModal` with a `dialogBodyComponent` (an aside for document-like content) or `showMediaViewer` with a `component`, passing the `File` you were given — neither gets a current file from a class-side click. Creating such files needs `enableExternalExt` ([rest-api.md](rest-api.md#creating-a-file-whose-extension-the-portal-does-not-own)).

## ArticleButton

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | |
| `component` | ✔* | a **32×32 slot with `overflow: hidden`** — text does not fit; in practice one kit `IconButton size={32}` with its own `onClick` |
| `usersTypes` | | **plural** |
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
| `usersTypes` | | **plural** |
| `devices` | | |

A first-class entry beside Rooms and Documents; the page is a full section — own route, deep-linkable, the portal's header and sidebar around it, no folder context. An unknown key or a section not in `appears` redirects to the root. The scope for anything that is a **screen**: dashboards, lists, a plugin's own workspace.

```ts
export const roomsPageItem = (): IArticleNavigationItem => ({
  key: "my-plugin-rooms", label: t("rooms.navLabel"), icon: "icon-20.svg", component: RoomsPage, appears: [Section.Files],
});
// onLoadCallback: this.addArticleNavigationItem(roomsPageItem());  setLanguage: this.updateArticleNavigationItem(roomsPageItem());
```

## Enum values worth having at hand

`UsersType` — keys camelCase, values PascalCase: `owner: "Owner"`, `docSpaceAdmin: "DocSpaceAdmin"`, `roomAdmin: "RoomAdmin"`, `collaborator: "Collaborator"`, `user: "User"`. `Devices` — `mobile`, `tablet`, `desktop`. `Section` — `Files`, `Accounts`, `Settings`. `ToastType` — `success`, `error`, `warning`, `info`. `PluginLocale` — 33 locales, values like `"en-US"`, `"ru"`, `"pt-BR"`. `FilesExst` covers the extensions DocSpace knows; a plain string works for your own.

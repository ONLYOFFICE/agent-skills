# Fields every item shares

Each item scope has a page of its own — [ContextMenu](context-menu-item.md), [MainButton](main-button-item.md), [ProfileMenu](profile-menu-item.md), [InfoPanel](info-panel-item.md), [EventListener](event-listener-item.md), [File](file-item.md), [ArticleButton](article-button-item.md), [ArticleNavigation](article-navigation-item.md) — recording what the portal does with that scope's items: where they render, what the callback receives, which fields are read when. The fields themselves, with types and a line each, are documented per interface under [Plugin items](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items.md); each page here links its interface and records only what that page does not say. This one holds what they share: the key, the role and device filters, and what the role values mean.

Where an item has a visible surface it is a React component passed as `component` ([rendering.md](../react/rendering.md)); the SDK 2 `body`/`onLoad` pairs still render, marked deprecated. Icons are asset file names; the size each one wants is on its interface's page and in [portal.md → Limits](../portal.md#limits).

## The filter field trap

The host reads a **different field name per scope**; the wrong one is silently skipped and the item shows for everybody. Each scope's page carries the spelling the host reads **for that scope**.

| Field | Scopes |
|---|---|
| `usersTypes` | ContextMenu, InfoPanel, EventListener, ArticleButton, ArticleNavigation |
| `usersType` | MainButton, ProfileMenu, File |

`devices` is read for every scope except `File`, where the check happens inside `onClick`.

## Item keys are portal-wide

The maps are flat and shared across every installed plugin: two plugins using key `settings` evict one another. Prefix keys with the manifest's `name` **verbatim, hyphens included** (`room-activity-…`, not `roomactivity-…`; `pluginName` is the wrong field). For `File` the key is the `extension`, so two plugins claiming `.md` collide — the last loaded wins. For `ArticleNavigation` the key is also a URL segment.

## Enums

Every enum, with its members and values, is under [Enums](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/enums.md). Two things worth knowing beyond the values: `FilesExst` covers the extensions ONLYOFFICE Apps knows, and a plain string works for your own; and every enum-valued string comes from the enum, because a near-miss compiles and is never matched ([plugin.md → Localisation](../plugins/plugin.md#localisation)).

### `UsersType` does not name the roles the portal shows

The product renamed the roles and the enum did not, so **two members mean the opposite of what they read like**: [`UsersType`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/enums/UsersType.md) states beside each member how the portal labels it today — `collaborator` is shown as **User**, `user` as **Guest**, `docSpaceAdmin` as **Full admin**. Every user is exactly **one** of the five, and the filter lists each one that may see the item — no member implies another: `[UsersType.roomAdmin]` hides the item from the owner and from full admins, "admins of any kind" is `[UsersType.owner, UsersType.docSpaceAdmin, UsersType.roomAdmin]`. So `usersTypes: [UsersType.user]` is "guests only", not "signed-in users", and the internal-staff filter most features want is `[UsersType.owner, UsersType.docSpaceAdmin, UsersType.roomAdmin, UsersType.collaborator]`. Getting this backwards shows a feature to exactly the audience it was meant to be hidden from, and nothing reports it. (An SDK that has the newer `UserRole` enum writes `FullAdmin`, `PortalUser` and `Guest` for three of them; the portal matches both spellings.)

# Fields every item shares

Each item scope has a page of its own — [ContextMenu](context-menu-item.md), [MainButton](main-button-item.md), [ProfileMenu](profile-menu-item.md), [InfoPanel](info-panel-item.md), [EventListener](event-listener-item.md), [File](file-item.md), [ArticleButton](article-button-item.md), [ArticleNavigation](article-navigation-item.md) — recording what goes into that scope's map and what the portal does with it: where the item renders, what the callback receives, which fields are read when. Field types are in the SDK's `.d.ts`; those pages record the host's behaviour. This one holds what they share: the key, the role and device filters, and what the role values mean.

Where an item has a visible surface it is a React component passed as `component` ([rendering.md](../react/rendering.md)); the SDK 2 `body`/`onLoad` pairs still render, marked deprecated.

## The filter field trap

The host reads a **different field name per scope**; the wrong one is silently skipped and the item shows for everybody. Each scope's page carries the spelling the host reads **for that scope**.

| Field | Scopes |
|---|---|
| `usersTypes` | ContextMenu, InfoPanel, EventListener, ArticleButton, ArticleNavigation |
| `usersType` | MainButton, ProfileMenu, File |

`devices` is read for every scope except `File`, where the check happens inside `onClick`.

## Item keys are portal-wide

The maps are flat and shared across every installed plugin: two plugins using key `settings` evict one another. Prefix keys with the manifest's `name` **verbatim, hyphens included** (`room-activity-…`, not `roomactivity-…`; `pluginName` is the wrong field). For `File` the key is the `extension`, so two plugins claiming `.md` collide — the last loaded wins. For `ArticleNavigation` the key is also a URL segment.

## Enum values worth having at hand

`Devices` — `mobile`, `tablet`, `desktop`. `FilesExst` covers the extensions ONLYOFFICE Apps knows; a plain string works for your own.

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

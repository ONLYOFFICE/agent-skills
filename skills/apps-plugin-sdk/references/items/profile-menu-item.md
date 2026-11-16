# ProfileMenu

An entry point in the user's own profile menu.

| | |
|---|---|
| Types | [`IProfileMenuItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IProfileMenuItem.md), [`IProfileMenuPlugin`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/plugins/IProfileMenuPlugin.md) |
| The loader reads | `getProfileMenuItems()`, keyed by `key` |
| Role filter | `usersType` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | none — one item; what its click opens is up to you |
| Redraw after a change | `updateProfileMenuItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line, is on [`IProfileMenuItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IProfileMenuItem.md). The click is `onClick`, which takes **no arguments** — there is no `onItemClick` in this scope.

The menu renders the item and nothing else — there is no canvas here, so whatever the feature shows comes from what `onClick` returns: `showModal` for a form, an aside for a list, or `navigate` to an `ArticleNavigation` page of your own for a whole screen. Nothing about the scope restricts it to the viewer's own data; it is simply the entry point that lives in the profile menu, and it is a normal pairing with a page.

Plugin items sit in one block of their own, set off by separators, after *Help Center* and *Hotkeys* and before the support entries (*Live chat*, *Feedback & Support* down to *About*), or right above *Sign out* when none of those is shown, in the order they were registered. Three or more items, from one plugin or from several, collapse into a single *More options* submenu, so each one is then a click further away; a plugin that keeps to one entry stays in the menu itself unless two other plugins add theirs. A portal before 4.1 puts them at the top of the menu, above its own entries.

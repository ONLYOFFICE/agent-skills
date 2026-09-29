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

Plugin items open the menu, above the portal's own entries. With several items, do not rely on their order: the portal inserts each one at the top, so two items can come out in reverse registration order, and the undeclared `position` field it may read as an index into the action array (separators included) is not part of the SDK contract.

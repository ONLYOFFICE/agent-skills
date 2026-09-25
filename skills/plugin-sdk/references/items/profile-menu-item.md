# ProfileMenu

An entry point in the user's own profile menu.

| | |
|---|---|
| Types | `IProfileMenuItem`, `IProfileMenuPlugin` |
| The loader reads | `getProfileMenuItems()`, keyed by `key` |
| Role filter | `usersType` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | none — one item; what its click opens is up to you |
| Redraw after a change | `updateProfileMenuItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

| Field | Required | Notes |
|---|---|---|
| `key`, `label`, `icon` | ✔ | icon 16×16 |
| `onClick` | ✔ | takes **no arguments**; there is no `onItemClick` here |
| `usersType` | | |
| `devices` | | |

The menu renders the item and nothing else — there is no canvas here, so whatever the feature shows comes from what `onClick` returns: `showModal` for a form, an aside for a list, or `navigate` to an `ArticleNavigation` page of your own for a whole screen. Nothing about the scope restricts it to the viewer's own data; it is simply the entry point that lives in the profile menu, and it is a normal pairing with a page.

Quirk: the host reads an undeclared `position` field as an index into the profile menu's action array (separators included). Cast if placement genuinely matters.

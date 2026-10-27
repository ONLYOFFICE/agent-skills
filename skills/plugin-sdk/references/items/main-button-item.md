# MainButton

A "create new…" entry.

| | |
|---|---|
| Types | [`IMainButtonItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IMainButtonItem.md), [`IMainButtonPlugin`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/plugins/IMainButtonPlugin.md) |
| The loader reads | `getMainButtonItems()`, keyed by `key` |
| Role filter | `usersType` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | none — a click may open a dialog |
| Redraw after a change | `updateMainButtonItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line, is on [`IMainButtonItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IMainButtonItem.md). `onItemClick` receives the **current folder** id. A submenu is one level deep — a child's own `items` are dropped — and the role and device filters are read on the parent only: a child's `usersType` and `devices` are copied in unread, so a child meant for fewer people than its parent has to be a top-level item of its own.

Plugin entries are grouped under a single **"More"** entry of the "New" menu — the main button, the section "+" menu and the mobile create button share it — placed after the document, form and folder entries and before the template gallery and upload. It exists only inside a folder or room **the user may create in** (`security.Create`), and never on a settings page, in a public room, in a form-filling room or a folder inside one, in an AI room or the AI agents section, on the Rooms list, in Forms or in Privacy — so a plugin entry appears where the portal itself offers file creation, and nowhere else. This is the surface for "create a new …"; an action on existing things belongs in [`ContextMenu`](context-menu-item.md).

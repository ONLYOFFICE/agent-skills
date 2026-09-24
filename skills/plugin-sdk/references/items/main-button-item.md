# MainButton

A "create new…" entry.

| | |
|---|---|
| Types | `IMainButtonItem`, `IMainButtonPlugin` |
| The loader reads | `getMainButtonItems()`, keyed by `key` |
| Role filter | `usersType` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | none — a click may open a dialog |
| Redraw after a change | `updateMainButtonItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

| Field | Required | Notes |
|---|---|---|
| `key`, `label`, `icon` | ✔ | icon 16×16 |
| `onItemClick` | | `(id) => IMessage` — the **current folder** id |
| `items` | | one level of sub-items; disables the parent's own click. The filters below are read on the **parent only** — children are copied in unfiltered, so a sub-item cannot narrow its own audience |
| `usersType` | | |
| `devices` | | |

Plugin entries are grouped under a single **"More"** sub-entry of the main button and the section "+" menu, after the standard create actions. The gate is not "a view without a folder context": the button builds its own menu per section and **returns before reaching plugin items** in the Rooms list, AI agents and portal settings, and skips them on the accounts page — so a plugin entry appears where the portal itself offers file creation, and nowhere else. This is the surface for "create a new …"; an action on existing things belongs in [`ContextMenu`](context-menu-item.md).

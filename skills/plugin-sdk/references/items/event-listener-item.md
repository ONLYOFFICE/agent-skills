# EventListener

To react to something happening.

| | |
|---|---|
| Types | [`IEventListenerItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IEventListenerItem.md), [`IEventListenerPlugin`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/plugins/IEventListenerPlugin.md) |
| The loader reads | `getEventListenerItems()`, keyed by `key` |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | none |
| Redraw after a change | `updateEventListenerItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line, is on [`IEventListenerItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IEventListenerItem.md), the event names on [`Events`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/enums/Events.md).

Subscribed as plain `window` listeners. `eventHandler` is declared with **no parameters** and nothing about a payload is contracted: treat it as "the user started doing something" and read the details yourself. No `updateEventListenerItem`: re-add to replace.

## The event fires when the dialog opens

**These are not completion events.** `CREATE`, `ROOM_CREATE`, `RENAME`, `ROOM_EDIT` and `CHANGE_USER_TYPE` are dispatched when the portal *opens the dialog* for that operation — before the user has typed a name, and whether or not they go on to confirm it. `CHANGE_COLUMN` fires from the table header the same way, and `CREATE_PLUGIN_FILE` when any plugin's `showCreateDialog` opens the portal's create dialog. There is **no event for the operation finishing**, and no id of a created entity to receive, because nothing has been created yet.

So an event handler that reports (`"Room created"`) is wrong at least as often as it is right: the user pressing Esc gets the toast anyway. What the scope is actually for is reacting to the *intent* — refreshing your own item labels, arming state a later click will read, recording that a flow was entered. When the plugin genuinely needs to know a room now exists, poll or re-read the listing from the surface that cares, rather than trusting the event.

```ts
// The user opened the create-room dialog. Nothing exists yet, so nothing is announced.
eventHandler: async () => ({ actions: [Actions.updateArticleNavigationItems] })
```

**The returned message is not restricted.** It goes through the same dispatcher as any class-side callback, and `showModal` really opens (the panels are mounted globally, not per surface). Keep to item updates by choice: the event fires on the portal's schedule, over a dialog the portal has just opened, so a modal or a `navigate` from here lands on top of what the user was in the middle of.

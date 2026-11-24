# ProfileField

A row of the plugin's own in the profile card — a value the plugin keeps about the user, a link, a button such as "Connect".

| | |
|---|---|
| Types | `IProfileFieldItem`, `IProfileFieldPlugin` — in the installed SDK (`dist/interfaces/items/IProfileFieldItem.d.ts`, `dist/interfaces/plugins/IProfileFieldPlugin.d.ts`); the docs have no page for them yet |
| The loader reads | `getProfileFieldItems()`, keyed by `key` |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Device filter | `devices` |
| People and groups filter | `users`, `groups` — as on [ArticleNavigation](article-navigation-item.md#showing-the-entry-to-some-people-only) |
| Surface | the value column of a profile card row, `component` |
| `useCurrentFile()` | `null`; `useCurrentUser()` is the profile owner — the card only ever shows the signed-in user |
| Redraw after a change | `updateProfileFieldItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line, is in the installed SDK's `IProfileFieldItem`; what the portal does beyond it:

- `label` goes in the card's label column, in the portal's label style; without it the row has no label. The plugin translates it itself. Past 160px it is cut with an ellipsis, the full text on hover, so keep it to a word or two.
- The filters are applied when the row is registered, like every item's — a changed list takes `updateProfileFieldItems` (or the settings save that re-registers the plugin) to take effect.

A portal before 4.1 has no plugin rows: it skips the scope without a word, and the plugin's other scopes work as before.

## Where it renders

After the portal's own rows (name, email, password, language, type), ordered by plugin name. On a wide profile the label shares the column of the portal's labels and the component sits in the value column — about 350px beside the avatar in the 660px card, down to about 260px when a long label takes the column's full 160px — vertically centered on the label, at least 20px high; text in it wraps, unlike the portal's own values. On a narrow profile (the card 600px wide or less, as on a phone) the row becomes a card of its own below the portal's, the label above the component in the portal's small label style.

The component is mounted once whatever the width, so its effects run once. It is wrapped like any other ([rendering.md](../react/rendering.md#where-components-render)): a throw blanks this row only. Keep it one line high on a wide profile — a value, a link, a small button (`ButtonSize.extraSmall`) — anything bigger belongs on a [ProfileTab](profile-tab-item.md).

## Example

```ts
export const telegramField = (): IProfileFieldItem => ({
  key: "my-plugin-telegram", label: t("telegram.label"), component: ConnectTelegram,
});
// in onLoadCallback: this.addProfileFieldItem(telegramField());
```

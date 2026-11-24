# ProfileTab

A tab of the plugin's own on the user's profile page — the user's own settings for the plugin, a connected account. A screen of the plugin's content, a list of the user's own items included, is still an [ArticleNavigation](article-navigation-item.md) page ([build.md](../build.md)): the profile is where people change how things work for them, not where they look things up.

| | |
|---|---|
| Types | `IProfileTabItem`, `IProfileTabPlugin` — in the installed SDK (`dist/interfaces/items/IProfileTabItem.d.ts`, `dist/interfaces/plugins/IProfileTabPlugin.d.ts`); the docs have no page for them yet |
| The loader reads | `getProfileTabItems()`, keyed by `key` |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Device filter | `devices` |
| People and groups filter | `users`, `groups` — as on [ArticleNavigation](article-navigation-item.md#showing-the-entry-to-some-people-only) |
| Surface | the profile page under its tab bar, `component` |
| `useCurrentFile()` | `null`; `useCurrentUser()` is the profile owner — the profile page only ever shows the signed-in user |
| Redraw after a change | `updateProfileTabItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line, is in the installed SDK's `IProfileTabItem`; what the portal does beyond it:

- `key` is the tab's address: `/profile/p/<key>`. The portal encodes it there, so any key opens its tab, but keep to letters, digits and hyphens: the address stays readable, and `navigate("/profile/p/<key>")` of the plugin's own needs no `encodeURIComponent`. The `p/` keeps plugin tabs apart from the portal's own, so no key clashes with them; keys still clash with other plugins' ([common-fields.md](common-fields.md#item-keys-are-portal-wide)).
- `label` is the tab name, shown as is: the plugin translates it itself.
- The filters are applied when the tab is registered, like every item's — a changed list takes `updateProfileTabItems` (or the settings save that re-registers the plugin) to take effect.

A portal before 4.1 has no plugin tabs: it skips the scope without a word, and the plugin's other scopes work as before.

## Where it renders

After the portal's own tabs, ordered by plugin name. The component fills the page's content column under the tab bar (988px at a 1280px viewport) and the page scrolls as a whole, so the tab sets no height of its own; the tab bar sticks to the top as the page scrolls. The portal draws nothing around the component; it starts about 20px under the bar, as the portal's own tabs do, so the tab adds no top margin of its own.

A link straight to the tab works: while the plugins are still loading the profile shows its skeleton, then opens the tab. A `/profile/p/` address no tab owns — the plugin disabled, a filter that leaves the user out — sends the user to the Login tab. `navigate("/profile/p/<key>")` from anywhere opens the tab.

The component is wrapped like any other ([rendering.md](../react/rendering.md#where-components-render)): a throw blanks this tab only, and a request is the component's own, in an effect, with a skeleton while it runs.

## Example

```ts
export const calendarTab = (): IProfileTabItem => ({
  key: "my-plugin-calendar", label: t("calendar.tab"), component: CalendarTab,
});
// in onLoadCallback: this.addProfileTabItem(calendarTab());
```

A single value or button about the user belongs in the profile card instead: [ProfileField](profile-field-item.md).

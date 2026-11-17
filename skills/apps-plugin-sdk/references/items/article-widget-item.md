# ArticleWidget

Something always in reach at the top of the sidebar — a search box, a quick filter, a status line.

| | |
|---|---|
| Types | `IArticleWidgetItem`, `IArticleWidgetPlugin` — in the installed SDK (`dist/interfaces/items/IArticleWidgetItem.d.ts`, `dist/interfaces/plugins/IArticleWidgetPlugin.d.ts`); the docs have no page for them yet |
| The loader reads | `getArticleWidgetItem()` — one item per plugin, not a map |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Device filter | `devices` |
| People and groups filter | `users`, `groups` — as on [ArticleNavigation](article-navigation-item.md#showing-the-entry-to-some-people-only) |
| Sections | `appears` — `Section.Files`, `Accounts`, `Settings`; left out, all three |
| Surface | the slot under the logo, above the navigation, 211px wide, `component`; in a collapsed sidebar, `icon` and a dropdown of the same width |
| `useCurrentFile()` | `null` |
| Redraw after a change | `updateArticleWidgetItem` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## One slot

The sidebar of each section has **one** widget slot. Every plugin may set a widget, and in each section the portal shows the widget of the first plugin, in the order of the plugins' names (numeric parts compare as numbers), whose `appears` lists that section or is left out — the order the Home page widgets and the sidebar entries follow. So the interface holds one item, like `Settings`: `articleWidgetItem`, `setArticleWidgetItem(item | null)`, `getArticleWidgetItem()`. A plugin that clears its widget with `setArticleWidgetItem(null)` and `updateArticleWidgetItem` hands the slot to the next plugin.

Besides `component` and an optional `icon` for the collapsed sidebar ([below](#where-it-renders)), the item takes the filters of an `ArticleNavigation` entry — `usersTypes`, `devices`, `users`, `groups`, `appears` — but no `key`. A widget whose filters leave the current user out does not hold the slot, which goes to the next plugin's widget; a component that renders `null` does hold it, so leave people out with the filters rather than an empty render. The filters are applied when the widget is registered, like every item's: a changed list takes `updateArticleWidgetItem` (or the settings save that re-registers the plugin) to take effect.

A portal before 4.1 has no slot: it skips the scope without a word, and the plugin's other scopes work as before.

## Where it renders

In the sidebars of the sections `appears` lists — Files (Home and the apps: Files, Rooms, Forms, the AI sections), Accounts, Settings — right under the logo, or under the Back arrow in the Accounts and Settings sidebars. The developer tools and payments sidebars have no slot. The slot sticks to the top of the menu: the entries, and the Back arrow with them, scroll under it, so the widget stays in reach. On a phone it heads the opened drawer, which `navigate` closes. The slot takes the menu's side padding (20px on a desktop, 8px on a tablet and a phone), so a kit `SearchInput` with `scale` spans exactly the highlight of the entries; **the portal draws no frame**, and the widget sets no height of its own.

A collapsed sidebar is icon-wide. There the slot shows the item's `icon` — the name of an SVG asset, drawn at 16×16 and recolored like the entries under it, so one color and filled shapes, with a `viewBox` (without one it is cropped, not scaled; a `.png` or `.jpg` is not drawn at all) — and a click opens the same `component` in a dropdown beside the sidebar, 211px wide as in the expanded slot, as tall as the component and never taller than the window (it scrolls inside). The dropdown closes on a click outside, on a second click on the icon, and when the portal moves to another page; the component is mounted only while it is open, so a request it makes in an effect runs on each opening. **Without an `icon` a collapsed sidebar shows no widget.**

The sidebar is mounted anew when the user moves to another section, so the component's state is lost there. Keep what must survive — a typed query — at module scope, and share it with the plugin's page the same way: the widget and the page are separate React trees.

## Example

```tsx
let query = "";
const listeners = new Set<() => void>();
const setQuery = (value: string) => { query = value; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getQuery = () => query;
export const useQuery = () => useSyncExternalStore(subscribe, getQuery, getQuery);

const SearchBox = () => {
  const { navigate } = usePluginActions();
  return (
    <SearchInput size={InputSize.base} scale value={useQuery()} placeholder={t("search.placeholder")}
      onChange={(value) => { setQuery(value); if (value.trim()) navigate("/p/my-plugin-results"); }}
      onClearSearch={() => setQuery("")} />
  );
};
// in onLoadCallback: this.setArticleWidgetItem({ component: SearchBox, icon: "search.svg" });
```

`getServerSnapshot` (the third argument) matters only to the validator's render pass, which renders on the server; the portal does not. A widget may navigate on every query: a path that is already open adds no history entry, and on a phone the call closes the drawer, so the results are in view.

# ArticleNavigation

A whole screen of the plugin's own — a dashboard, a list, a workspace.

| | |
|---|---|
| Types | `IArticleNavigationItem`, `IArticleNavigationPlugin` |
| The loader reads | `getArticleNavigationItems()`, keyed by `key`, which is also the URL segment |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | a full page at `/p/<key>` (under the section's path), `component` |
| `useCurrentFile()` | `null` |
| Redraw after a change | `updateArticleNavigationItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

| Field | Required | Notes |
|---|---|---|
| `key` | ✔ | the last URL segment — `/p/<key>`, `/accounts/p/<key>` or `/portal-settings/p/<key>` — so unique across **every installed plugin** |
| `label` | ✔ | sidebar text; a rename needs `updateArticleNavigationItem` + `updateArticleNavigationItems()` |
| `icon` | ✔ | file name in `assets/`, 20×20 |
| `component` | ✔ | the whole page. `useCurrentFile()` is `null`; work from `useCurrentUser()` and `usePluginAPI()` |
| `appears` | | `Section[]` — `Files`, `Accounts`, `Settings`; the entry shows only in those sidebars and the page is reachable only under their paths. Omit → every section |
| `usersTypes` | | |
| `devices` | | |

A first-class entry beside Rooms and Documents; the page is a full section — own route, deep-linkable, the portal's header and sidebar around it, no folder context. An unknown key or a section not in `appears` redirects to the root. The scope for anything that is a **screen**: dashboards, lists, a plugin's own workspace.

## Where it renders

The page is the section body — full width, scrolls, and **already padded on every side** ([styles.md](../styles.md#conventions)), with its inline-end left bare for the scrollbar, so an outer padding of your own doubles the gutter against a bare right edge; no heading, so a `Heading` and a ~640px cap on text read well.

**On a page, holding the width is your job.** The portal mounts the component with no markup of its own — an error boundary and the runtime provider, nothing else — directly inside the section body, whose only width guard is `max-width: 100vw`. That cap is measured against the viewport, so it does not subtract the sidebar the page sits beside: content wider than the space actually available is stopped by nothing and drags a horizontal scrollbar across the whole portal. Give the root `width: 100%; max-width: 100%; box-sizing: border-box` and `min-width: 0`, and keep every pixel `min-width` inside its own `overflow-x: auto` box. A single control that refuses to shrink does this as thoroughly as a wide table — and it is the harder one to see, because the page looks right until the window narrows.

## Example

```ts
export const roomsPageItem = (): IArticleNavigationItem => ({
  key: "my-plugin-rooms", label: t("rooms.navLabel"), icon: "icon-20.svg", component: RoomsPage, appears: [Section.Files],
});
// in onLoadCallback: this.addArticleNavigationItem(roomsPageItem());
```

# ArticleNavigation

A whole screen of the plugin's own — a dashboard, a list, a workspace.

| | |
|---|---|
| Types | [`IArticleNavigationItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IArticleNavigationItem.md), [`IArticleNavigationPlugin`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/plugins/IArticleNavigationPlugin.md) |
| The loader reads | `getArticleNavigationItems()`, keyed by `key`, which is also the URL segment |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| People and groups filter | `users`, `groups` — [below](#showing-the-entry-to-some-people-only) |
| Surface | a full page at `/p/<key>` (under the section's path), `component` |
| `useCurrentFile()` | `null` |
| Redraw after a change | `updateArticleNavigationItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line, is on [`IArticleNavigationItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IArticleNavigationItem.md), the sections on [`Section`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/enums/Section.md); what the portal does beyond it:

- `key` is the last URL segment — `/p/<key>`, `/accounts/p/<key>` or `/portal-settings/p/<key>`.
- A rename needs `updateArticleNavigationItem` + `updateArticleNavigationItems()`.
- `component` is the whole page. `useCurrentFile()` is `null`; work from `useCurrentUser()` and `usePluginAPI()`.
- `appears` restricts the entry to those sidebars **and** the page to their paths.
- `icon` must be an **SVG** asset: the sidebar inlines it as SVG markup, so a `.png` or `.jpg` draws an empty slot.

A first-class entry beside Rooms and Documents; the page is a full section — own route, deep-linkable, the portal's header and sidebar around it, no folder context. An unknown key or a section not in `appears` redirects to the root. The scope for anything that is a **screen**: dashboards, lists, a plugin's own workspace.

## Showing the entry to some people only

`usersTypes` narrows the entry by role. For named people and groups (a CRM for the Sales group and the director) set `users` and `groups`, user and group ids, on the item. The portal shows it to the listed users and to the members of the listed groups. An empty array lists no one, leaving both out means everyone, and every other filter must still match.

Keep the lists in the plugin's settings so an admin changes them without re-uploading the plugin:

- the settings page picks ids with `showSelector({ type: SelectorType.People, props: { isMultiSelect: true } })`, adding `withGroups: true, isGroupsOnly: true` for groups (`isGroupsOnly` alone is ignored, and `SelectorType.Groups` picks a single group), and stores them with `usePluginSettings().save()`;
- `setAdminPluginSettingsValue`, which the portal calls for every user with the stored string once the plugin declares the `Settings` scope, registers the item with those lists. Register it there and not in `onLoadCallback`, so the entry never shows before its access is known. Spread the lists onto the item only while access is restricted (`restricted ? { users, groups } : {}`): stored empty lists would hide the entry from everyone.

Settings are one string of 4096 characters (255 before 4.1), so about 100 ids. Portals before 4.1 ignore both fields and show the entry to everyone. The filter hides the entry and its page, but the plugin's code still loads for every user. Data behind the page is protected only by the service that serves it. Working plugin: [`samples/workspace-app`](https://github.com/ONLYOFFICE/docspace-plugin-sdk/tree/master/samples/workspace-app).

## Where it renders

The page is the section body — full width, scrolls, and **already padded** above, below and at the inline start ([styles.md](../styles.md#conventions)), with only 3px at the inline end, left for the scrollbar, so an outer padding of your own doubles the gutter against a bare right edge; no heading, so a `Heading` and a ~640px cap on text read well.

**On a page, holding the width is your job.** The portal mounts the component with no markup of its own — an error boundary and the runtime provider, nothing else — directly inside the section body, whose only width guard is `max-width: 100vw`. That cap is measured against the viewport, so it does not subtract the sidebar the page sits beside: content wider than the space actually available is stopped by nothing and drags a horizontal scrollbar across the whole portal. Give the root `width: 100%; max-width: 100%; box-sizing: border-box` and `min-width: 0`, and keep every pixel `min-width` inside its own `overflow-x: auto` box. A single control that refuses to shrink does this as thoroughly as a wide table — and it is the harder one to see, because the page looks right until the window narrows.

## Example

```ts
export const roomsPageItem = (): IArticleNavigationItem => ({
  key: "my-plugin-rooms", label: t("rooms.navLabel"), icon: "icon-20.svg", component: RoomsPage, appears: [Section.Files],
});
// in onLoadCallback: this.addArticleNavigationItem(roomsPageItem());
```

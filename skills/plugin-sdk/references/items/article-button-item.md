# ArticleButton

A small persistent control in the sidebar.

| | |
|---|---|
| Types | [`IArticleButtonItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IArticleButtonItem.md), [`IArticleButtonPlugin`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/plugins/IArticleButtonPlugin.md) |
| The loader reads | `getArticleButtonItems()`, keyed by `key` |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| Surface | a 32×32 slot in the sidebar, `overflow: hidden`, `component` |
| `useCurrentFile()` | `null` |
| Redraw after a change | `updateArticleButtonItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line, is on [`IArticleButtonItem`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/items/IArticleButtonItem.md).

`component` gets a **32×32 slot with `overflow: hidden`** — text does not fit; in practice one kit `IconButton size={32}` with its own `onClick`. Rendered in **two** sidebars (article and apps) from the same map; each shows at most **five** buttons across all plugins, in registration order — the sixth is dropped silently. A natural way to *open* something (`navigate("/p/<key>")`, an aside, a selector), a poor place for the thing itself.

## Example

```tsx
const SidebarButton = () => {
  const { navigate } = usePluginActions();
  return <IconButton size={32} title={t("openReports")} onClick={() => navigate("/p/my-plugin-reports")}
                     iconNode={<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="…" /></svg>} />;
};
```

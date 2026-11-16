# DashboardWidget

A block of the plugin's own on the Home page — a summary, a short list, a chart.

| | |
|---|---|
| Types | `IDashboardWidgetItem`, `IDashboardWidgetPlugin` — in the installed SDK (`dist/interfaces/items/IDashboardWidgetItem.d.ts`, `dist/interfaces/plugins/IDashboardWidgetPlugin.d.ts`); the docs have no page for them yet |
| The loader reads | `getDashboardWidgetItems()`, keyed by `key` |
| Role filter | `usersTypes` — [the filter field trap](common-fields.md#the-filter-field-trap) |
| People and groups filter | `users`, `groups` — as on [ArticleNavigation](article-navigation-item.md#showing-the-entry-to-some-people-only) |
| Surface | a full-width block on the Home page, under its title and description, `component` |
| `useCurrentFile()` | `null` |
| Redraw after a change | `updateDashboardWidgetItems` ([actions.md](../react/actions.md#changing-an-item-from-a-component)) |

## Fields

Each field, with its type and a line, is in the installed SDK's `IDashboardWidgetItem`; what the portal does beyond it:

- `title` heads the block; without it the block is headed by the plugin's name as the plugin list shows it. `description` is the line under the title; without it there is none.
- `devices` is not a field here, and the portal reads none: a widget shows on every device to the people the three filters let through.
- The filters are applied when the widget is registered, like every item's — a changed list takes `updateDashboardWidgetItems` (or the settings save that re-registers the plugin) to take effect.

A portal before 4.1 has no widgets: it skips the scope without a word, and the plugin's other scopes work as before.

## Where it renders

On the Home page right under the apps block, above the integrations and developer tools cards, one under another, ordered by plugin name. Each block spans the page's content column (the area beside the sidebar, padded 20px on each side, at most 1440px), with the title and description drawn by the portal the way it heads its own blocks. **The portal draws no frame around the component**: the widget owns its look, and a bare list reads as part of the page. The page scrolls as a whole, so a widget sets no height of its own; a long list is cut down in the widget, with a link to the page that has the rest.

The component is wrapped like any other ([rendering.md](../react/rendering.md#where-components-render)): a throw blanks this block only, and a request is the component's own, in an effect, with a skeleton while it runs.

## Example

```ts
export const pipelineWidget = (): IDashboardWidgetItem => ({
  key: "my-plugin-pipeline", title: t("pipeline.title"), description: t("pipeline.subtitle"), component: PipelineWidget,
});
// in onLoadCallback: this.addDashboardWidgetItem(pipelineWidget());
```

A link to an existing page is not a widget: give the page's `ArticleNavigation` item a [`dashboardCard`](article-navigation-item.md#a-card-on-the-home-page) instead, and the Home page shows it among the apps.

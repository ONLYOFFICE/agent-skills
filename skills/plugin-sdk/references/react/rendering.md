# How the portal renders a plugin component

How a plugin component is rendered and what it can reach. Verified against the ONLYOFFICE Apps client this skill targets; where the SDK's types and the host's behaviour differ, both are stated.

What a component can reach is on the pages beside this one — [hooks.md](hooks.md), [actions.md](actions.md), [api.md](api.md) — and the settings client is on [settings-plugin.md](../plugins/settings-plugin.md#the-settings-client). Four neighbours carry the rest: the surfaces the **host** draws each have a page — [modal-dialog.md](../components/modal-dialog.md), [selector.md](../components/selector.md), [create-dialog.md](../components/create-dialog.md), [media-viewer.md](../components/media-viewer.md), [floating-operations-button.md](../components/floating-operations-button.md); the kit's own components are in [ui-kit.md](../ui-kit.md); theme variables, the portal's measurements and how a stylesheet gets scoped in [styles.md](../styles.md); what a third-party package costs inside the portal's window in [dependencies.md](../dependencies.md).

## Where components render

The portal wraps the component in the runtime provider and an error boundary and mounts it in its own React tree — same React, theme and direction as the page. What each surface gives the component is on its page:

| Prop | Surface | Its page |
|---|---|---|
| `IArticleNavigationItem.component` | a full page at `/p/<key>` (under the section's path) | [article-navigation-item.md](../items/article-navigation-item.md#where-it-renders) |
| `IInfoPanelItem.component` | body of an info panel tab | [info-panel-item.md](../items/info-panel-item.md) |
| `IArticleButtonItem.component` | a 32×32 slot in the sidebar, `overflow: hidden` | [article-button-item.md](../items/article-button-item.md) |
| `IModalDialog.dialogBodyComponent` | body of a modal or aside | [modal-dialog.md](../components/modal-dialog.md) |
| `IMediaViewer.component` | the whole viewport, behind the viewer's chrome | [media-viewer.md](../components/media-viewer.md) |
| `ISettings.component` | the plugin's settings aside | [settings-plugin.md](../plugins/settings-plugin.md#registering-the-page) |

`component` is the component itself, never an element (`component: Panel`, not `<Panel />`). Components receive **no props** — everything comes from hooks, module scope or closures.

## Errors, loading, language, styling

- **Errors are contained and silent.** A throw in render or an effect renders the component as **nothing**, with one console line `[Plugin: <name>] <error>`. A blank tab/page/modal is the symptom of a bug; `catch` and show text instead. Rejections in event handlers are not caught by the boundary.
- **Loading is yours.** No `onLoad`: render a `RectangleSkeleton`/`Loader` while the effect runs, and do not try to pre-load in `onLoadCallback` ([portal.md](../portal.md#what-actually-breaks-the-portal)).
- **Language.** Components call `t()` at render time. A language change reloads the whole plugin as a fresh module, so no labels need rebuilding — but module-scope timers and listeners survive the reload and pile up ([plugin.md](../plugins/plugin.md#localisation)).
- **Styling.** Three sources in order — a kit prop, an inline `style`, a stylesheet for what inline `style` cannot express. A `.css` import becomes `plugin.css`, injected into the portal's **own document, unscoped**, so it is a `.module.css` or it is scoped by hand; colors come from the portal's variables, never a literal. All of it, with the conventions and the specificity rules, is in [styles.md](../styles.md).

# Context menu and toolbar

The pages are [Context menu](https://api.onlyoffice.com/docs/plugins/customization/context-menu.md) and [Toolbar](https://api.onlyoffice.com/docs/plugins/customization/toolbar.md). The methods behind them (`AddContextMenuItem`, `UpdateContextMenuItem`, `AddToolbarMenuItem`, `UpdateToolbarMenuItem`) are marked undocumented in sdkjs's own JSDoc, so their argument shapes below come from the implementation - where the JSDoc or an example disagrees, the implementation is what runs.

## Context menu

The editor asks before it opens the menu: it sends `onContextMenuShow` to every plugin that listens and waits for each one's `AddContextMenuItem` before showing anything.

```js
window.Asc.plugin.attachEvent("onContextMenuShow", function (options) {
  const items = [];
  if (options.type === "Selection") {
    items.push({ id: "makeUppercase", text: { en: "Make uppercase", de: "In Großbuchstaben" } });
  }
  // Every time, even with nothing to add - the menu waits for this answer.
  window.Asc.plugin.executeMethod("AddContextMenuItem", [{ guid: window.Asc.plugin.info.guid, items: items }]);
});

window.Asc.plugin.attachContextMenuClickEvent("makeUppercase", function () {
  window.Asc.plugin.executeMethod("GetSelectedText", [], function (text) {
    if (text) window.Asc.plugin.executeMethod("PasteText", [text.toUpperCase()]);
  });
});
```

with, in the variation of `config.json`:

```json
"events": ["onContextMenuShow", "onContextMenuClick"]
```

- **The argument is one object `{ guid, items }`.** sdkjs reads `items.guid` to find the plugin; the JSDoc's `ContextMenuItem[]` is wrong. `Asc.plugin.info.guid` is set once the plugin has started; `Asc.plugin.guid` may still be empty in a window opened by the plugin.
- **`options.type`** says what the menu opened on: `"Target"` (cursor, nothing selected), `"Selection"`, `"Image"`, `"Shape"`, `"OleObject"` (then `options.guid` is the plugin the object belongs to), `"None"`. In the document editor, `header`/`footer`/`headerArea`/`footerArea` flags may be set too.
- **An item** has `id` and `text`; `text` may be a map of languages (`{ en, de, ... }`), read in the interface language with `en` as fallback. Optional: `disabled`, `separator` (a divider above it), `icons` (a path template as in `config.json`), `items` (a submenu - leave it out for a plain item), `data` (sent with the click).
- **Clicks.** `attachContextMenuClickEvent(id, fn)` stores `fn` under the item id; the runtime's own `event_onContextMenuClick` looks the id up and calls it. The editor sends `onContextMenuClick` only to a plugin registered for it - list it in `"events"`. Do **not** register it with `attachEditorEvent("onContextMenuClick", ...)`: that replaces the runtime's router, and no per-item handler runs again.
- **Show.** `attachEvent("onContextMenuShow", ...)` with the event in `"events"`, or `attachEditorEvent("onContextMenuShow", ...)` which registers it by itself. Either way the handler must answer.

A background plugin is the usual host for context-menu items: it runs without a window, so its items exist without the user opening anything.

## Toolbar

```js
window.Asc.plugin.executeMethod("AddToolbarMenuItem", [{
  guid: window.Asc.plugin.info.guid,
  tabs: [{
    id: "ourTab",
    text: "Our tools",
    items: [
      { id: "insertFooter", type: "button", text: "Footer", hint: "Insert our footer", icons: "resources/buttons/footer.png", lockInViewMode: true }
    ]
  }]
}]);

window.Asc.plugin.attachToolbarMenuClickEvent("insertFooter", function () { /* ... */ });
```

- **One object `{ guid, tabs }` inside the argument array** - not `[[{ guid, tabs }]]`. sdkjs reads `items.guid` and `items.tabs` directly; the extra array makes `guid` undefined and the call throws inside the editor. Some published examples wrap it twice; the plugins.js button helper (`Asc.Buttons`) sends it once, as above.
- `UpdateToolbarMenuItem` takes the same shape and replaces items by `id` - use it for a changed caption or state rather than adding again.
- Toolbar clicks need `onToolbarMenuClick` the same way context-menu clicks need `onContextMenuClick`: list it in `"events"`.
- Available from 8.1.0; the context menu from 7.4.0.

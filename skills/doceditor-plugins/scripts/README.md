# scripts/

What each script checks, and how it is kept in step with the editors. The command an agent runs
is in the skill's [README](../README.md); this page is for whoever maintains them.

**`validate-plugin.mjs`** checks a plugin folder offline:

- `config.json`: valid JSON, `name`/`guid`/`variations`, each variation's `description`, `url` and
  `EditorsSupport` (only `word`, `cell`, `slide`, `pdf`), the kind (`"type"` value, a variation
  that would start invisible, `panelRight`/`background` below 8.1.0, `"type"` without the flags
  older editors read), the guid and version formats, and the marketplace fields as
  `marketplace` findings.
- The files the config names: the page, every icon in `icons`/`icons2` - path templates
  (`%theme-type%(light|dark)` ...) expanded the way web-apps' `iconsStr2IconsObj` does - and the
  store icons and screenshots. A missing icon is an `error` for the first variation (its button) and
  a `warning` for the others, which are usually windows the plugin opens itself.
- Each variation's page: that it loads `plugins.js`, and from the absolute address.
- The plugin's own scripts (the local `<script src>` of its pages, libraries skipped): click
  handlers whose event is not in `"events"`, `attachEditorEvent` on the two click routers,
  `Asc.plugin.attachEvent` for an editor event that is neither declared nor registered (main
  pages only, and only for the names in `EDITOR_EVENTS` - anything else is the plugin's own
  message from a window), and the context-menu and toolbar methods called with an array of
  objects.

Exit code 1 when there is an `error`. `--json` prints the findings with a stable `code` each.

**`test-validator.mjs`** writes a known-good plugin and one broken variant per rule into a
temporary directory and asserts the exit code and the finding codes; it also checks the template
expansion. Run it after any change to the validator.

## Keeping it in step

The rules come from the plugin runtime and the editors, not from a published spec, so each one
names where it was read: the event routing from `sdkjs-plugins/v1/plugins.js`
(`attachEditorEvent`, `attachEvent`, `event_onContextMenuClick`) and sdkjs `common/plugins.js`
(the `eventsMap` check), the kind fallback from sdkjs `common/apiCommon.js` (`PluginType.getType`
and the flag branch), the menu argument shapes from sdkjs `common/apiBase_plugins.js`
(`pluginMethod_AddContextMenuItem`, `correctToolbarItems`), the icon templates from web-apps
`Common.UI.iconsStr2IconsObj`. On an editor release, re-read those five places; `EDITOR_EVENTS`
follows the plugin-window events and the per-editor events of
`@onlyoffice/doceditor-plugin-types` (its `PluginEventMap` and `<editor>/events.json`).

Last checked against the marketplace's own plugins: no false positive on the event and menu rules;
the remaining errors there are real (missing icon files, one relative `plugins.js`).

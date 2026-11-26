# scripts/

What each script checks, and how it is kept in step with the editors. The command an agent runs
is in the skill's [README](../README.md); this page is for whoever maintains them.

**`validate-plugin.mjs`** checks a plugin folder offline:

- `config.json`: valid JSON, `name`/`guid`/`variations`, each variation's `description`, `url` and
  `EditorsSupport` (only `word`, `cell`, `slide`, `pdf`), the kind (`"type"` value, a variation
  that would start invisible, `panelRight`/`background` below 8.1.0, `"type"` without the flags
  older editors read), the guid and version formats, fields nothing reads (`KNOWN_ROOT`,
  `KNOWN_VARIATION`: the schema of `@onlyoffice/doceditor-plugin-types` plus what sdkjs
  `apiCommon.js` and web-apps' Plugins controller read, so a real field the schema lacks - such as
  `groupName` - is not reported), and the marketplace fields as `marketplace` findings.
- What the plugin manager shows (`marketplace`): `translations/langs.json` present and an array -
  not that it lists `en-EN`, since the store's plugin card adds English itself
  (`store/scripts/card/plugin-card.js`, `_loadAndShowLanguages`) and almost no published plugin
  lists it; `README.md` and `CHANGELOG.md`; toolbar icons of the first variation for both themes at
  all five scales (an SVG counts for every scale); every scale in the store icon folders.
- The files the config names: the page, every icon in `icons`/`icons2` - path templates
  (`%theme-type%(light|dark)` ...) expanded the way web-apps' `iconsStr2IconsObj` does - and the
  store icons and screenshots. A missing icon is an `error` for the first variation (its button) and
  a `warning` for the others, which are usually windows the plugin opens itself.
- Each variation's page: that it loads `plugins.js`, and from the absolute address.
- The plugin's own scripts (the local `<script src>` of its pages, libraries skipped): click
  handlers whose event is not in `"events"`, `attachEditorEvent` on the two click routers,
  `Asc.plugin.attachEvent` for an editor event that is neither declared nor registered (main
  pages only, and only for the names in `EDITOR_EVENTS` - anything else is the plugin's own
  message from a window), the context-menu and toolbar methods called with an array of
  objects, and code that leaves the plugin API (`outside-api`, a `warning`): `window.parent`/
  `top`/`opener`/`frameElement`, a bundler's alias of them (`r.parent.Asc`), `Asc.editor` and
  `asc_*` members. `postMessage` to the parent is not reported - it works across origins, and a
  page nested in the plugin's own iframe uses it. Built bundles are skipped like libraries, so a
  review still sweeps them by hand ([audit.md](../references/audit.md#review-discipline)).

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
the remaining errors there are real (missing icon files, one relative `plugins.js`). The
`unknown-field` warnings there are real too (`isNeedNumbering`, root-level `description`/`type`/
`icons`, `author`, `category`, `manifestVersion`); `icon-coverage` flags plugins with only the
legacy `icons` array or only 100% icons, among the most common review findings. `outside-api`
there: `Api.asc_*Track*Revisions` inside a command (`ai`) and a walk of `window.parent`/`top`
for the Desktop bridge (`pdf-bookmarks`) - both real.

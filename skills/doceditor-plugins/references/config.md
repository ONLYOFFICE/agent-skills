# config.json

Every field is described on [Configuration](https://api.onlyoffice.com/docs/plugins/configuration.md) and typed by the schema [`config.schema.json`](https://raw.githubusercontent.com/ONLYOFFICE/doceditor-plugin-types/master/schemas/config.schema.json). This page is what those leave implicit: which fields decide where the plugin appears, from which editor version, and what the marketplace adds on top.

Point the file at the schema so the editor completes and checks it while it is written:

```json
{
  "$schema": "https://raw.githubusercontent.com/ONLYOFFICE/doceditor-plugin-types/master/schemas/config.schema.json",
  "name": "Signature block"
}
```

The editor reads `config.json` field by field and ignores `$schema`.

## Where the plugin appears: the kind

A variation's kind is `"type"` ([Types](https://api.onlyoffice.com/docs/plugins/configuration/types.md)) on 8.1.0 and later. Older editors ignore `"type"` and derive the kind from three flags, so write both:

| Kind | `"type"` | `isVisual` | `isInsideMode` | `isModal` | Lowest editor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Left side panel | `"panel"` | `true` | `true` | `false` | any |
| Modal window with buttons | `"window"` | `true` | `false` | `true` | any |
| Right side panel | `"panelRight"` | `true` | `true` | `false` | **8.1.0** |
| No UI, runs alongside the editor | `"background"` | `false` | `false` | `false` | **8.1.0** |

Without `"type"`, an editor reads `isSystem: true` as a system plugin, `isVisual: true` as a panel or window (by `isInsideMode`), and anything else as an invisible plugin - so a background plugin on 8.0 silently becomes "invisible", and a right panel becomes a left one. Set `minVersion` to `"8.1.0"` or later for the two kinds that need it.

A variation with neither `"type"` nor `isVisual` is started as an invisible plugin with no window: that is the usual reason a plugin "installs but shows nothing".

## Fields that change behaviour quietly

- **`EditorsSupport`** decides in which editors the button exists at all; `"pdf"` is its own value, separate from `"word"`.
- **`initDataType`** (`"text"`, `"html"`, `"ole"`, `"none"`, ...) decides what `init` receives. With `initOnSelectionChanged: true`, `init` runs again whenever the user finishes a selection - not when the selection is cleared.
- **`events`** lists the events the editor sends to a plugin that registers its handlers with `attachEvent`, `event_<name>` or `attachContextMenuClickEvent`. See [menus.md](menus.md) and [runtime.md](runtime.md).
- **`buttons`** of a `"window"` variation are numbered by position: `Asc.plugin.button(id)` receives `0`, `1`, ... A panel has no buttons; closing it calls `button(-1, windowId)`. Closing the window itself calls nothing from 9.5.0 - see [runtime.md](runtime.md#windows-panels-and-buttons).
- **`isViewer: true`** offers the variation in read-only documents; it is opt-in. The same name on a button (`buttons[].isViewer`) is opt-out.
- **`size`** is the window's initial size; there are no minimum or maximum fields - those go through `ResizeWindow`.

## Icons

`icons` and `icons2` name files relative to the plugin folder; every file they name must exist, in every scale and for both themes listed. `icons2` entries are per theme (`"style": "light"` / `"dark"`), per scale (`"100%"` ... `"200%"`, files usually `icon.png`, `icon@1.25x.png` ... `icon@2x.png`). A single string such as `resources/%theme-type%(light|dark)/icon%scale%(default).%extension%(png)` is a template the editor expands into that set - the expanded files must exist too. Requirements: [Icons](https://api.onlyoffice.com/docs/plugins/configuration/icons-and-branding.md).

## The page

`url` is the plugin's page, relative to the folder. It must load the plugin runtime from its absolute address:

```html
<script type="text/javascript" src="https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js"></script>
<script type="text/javascript" src="https://onlyoffice.github.io/sdkjs-plugins/v1/plugins-ui.js"></script>
<link rel="stylesheet" href="https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.css">
```

Plugins inside the marketplace repository often use `../v1/plugins.js`; that path exists only next to the marketplace's own `v1/` folder and breaks the moment the plugin is installed from anywhere else.

## What the marketplace adds

What the editor runs without but a marketplace listing needs - see [Submit to marketplace](https://api.onlyoffice.com/docs/plugins/development-workflow/publishing/submit-to-marketplace.md).

In `config.json`:

- `version` (`x.y.z`), `minVersion`, `offered` (the author or organization - the plugin manager shows it as the publisher);
- exactly one variation carries `store` with `background` (`light`/`dark`), `icons` (`light`/`dark` folders) and `screenshots`;
- `guid` in the form `asc.{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`, new for every plugin - a copied guid makes two plugins one in the editor;
- no field the editor does not read - an invented or misspelled one (`isviewer`, a root-level `description`) is silently ignored.

Next to it, files the plugin manager shows:

- **`translations/langs.json`** - the languages the plugin is translated into, for example `["de-DE", "fr-FR"]`, and `[]` for English only. The plugin manager always lists English itself and adds these, so `"en-EN"` need not be in the list; a missing or malformed file leaves the card at English.
- **`README.md`** - written for someone deciding whether to install: what it does, what it needs set up.
- **`CHANGELOG.md`** - what changed in each version, shown before an update.
- **Icons for both themes at every scale** - toolbar icons (`icons2`, light and dark, `100%` to `200%`, or one SVG per theme) and the store icons in the `store.icons` folders (`icon.png` ... `icon@2x.png`). Missing dark-theme icons are among the most common review findings; check the plugin in both editor themes, text and borders as well as icons.
- **Third-party code** - for every bundled library, its license text (`licenses/<Package>.license`) and a `3rd-Party.txt` listing name, purpose, homepage and license; a plugin's own license must not conflict with the repository's AGPLv3.

The editor also runs in the desktop app: a browser-only API (a service worker, some storage and clipboard paths) can work on the web and fail in desktop.

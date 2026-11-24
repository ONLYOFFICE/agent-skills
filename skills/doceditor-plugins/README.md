# ONLYOFFICE Docs Editor Plugins Skill

A skill that teaches an AI coding agent to build, fix and review **plugins that run inside the ONLYOFFICE Docs editors** - the HTML/JS add-ons with a `config.json`, an `index.html` and `window.Asc.plugin` that add a toolbar button, a side panel, a modal window, a context-menu item or a background helper to the document, spreadsheet, presentation and PDF editors. DocSpace portal plugins are the sibling **[`apps-plugin-sdk`](../apps-plugin-sdk/README.md)** skill; embedding the editor in a web page is **[`doceditor`](../doceditor/README.md)**.

Editor plugins fail without an error. A context-menu item appears and its click never arrives, because the click event is not declared in `config.json`. A command reads a variable from the plugin's scope and gets `undefined`, because the command is source text run inside the editor. A plugin that works inside the marketplace repository is blank once installed, because its page loads `plugins.js` by a relative path. A right panel opens on the left on an older editor, because `"type"` is read only from 8.1.0. This skill encodes those rules and checks them. The body is [`SKILL.md`](SKILL.md).

## What to ask for

- "a button in the editor that inserts our signature block"
- "a right-click action that turns the selection into a link to our tracker"
- "my context menu item shows up but clicking it does nothing"
- "the plugin works from the marketplace repo but is blank once installed"
- "check our plugin before we submit it to the marketplace"

## What it carries

- [`references/`](references/) - `config.md` (kinds and their flags by editor version, icons, what the marketplace adds), `runtime.md` (commands, methods, events, windows), `menus.md` (context menu and toolbar contracts), `types.md` (type checking a JavaScript plugin with `@onlyoffice/doceditor-plugin-types`), `audit.md` (symptom -> cause catalogue and review discipline).
- [`scripts/validate-plugin.mjs`](scripts/validate-plugin.mjs) - checks a plugin folder offline: `config.json`, the files it names, how the pages load the runtime, and whether the events the scripts listen for can reach them.

```sh
node scripts/validate-plugin.mjs path/to/plugin
```

## Installing it

As part of the `onlyoffice-devtools` plugin - see [Install](../../README.md#install) in the root README. On its own: copy this directory to where your agent scans for skills, or hand it `SKILL.md`.

## What it targets

The plugin API of ONLYOFFICE Docs **10.0.0**, as typed by [`@onlyoffice/doceditor-plugin-types`](https://github.com/ONLYOFFICE/doceditor-plugin-types); rules that start in an older version name it (8.1.0 for `"type"`, the right panel, background plugins and the toolbar; 7.4.0 for the context menu). Built from the [plugin documentation](https://api.onlyoffice.com/docs/plugins/get-started/overview.md) and the editors' sources.

## Maintaining it

`SKILL.md` and the references link to the live docs; links and the pinned version are declared in [`sources.json`](sources.json). The validator's rules and where each was read are in [`scripts/README.md`](scripts/README.md). On an editor release, re-read those places, update the references where a consequence changed, and bump the version with `node tools/sync-sources.mjs --skill doceditor-plugins --set-version <x.y.z>`.

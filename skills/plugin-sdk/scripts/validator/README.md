# validator/

The passes behind [`../validate-plugin.mjs`](../validate-plugin.mjs). Nothing here is run directly. In the order they run:

| File | What it checks |
|---|---|
| [`plugin-project.mjs`](plugin-project.mjs) | nothing — reads the project and reports facts: manifest, assets, source text (comments stripped), build config, whether a build exists, which SDK is installed (from the audited project, not this repository) |
| [`project-checks.mjs`](project-checks.mjs) | the project as written: manifest, assets, sources (default export, deprecated SDK 2 forms), the `external` list in `vite.config` |
| [`archive-checks.mjs`](archive-checks.mjs) | `dist/plugin.js` imports and bundled-React markers, the packed archive and its `config.json`, drift from the installed SDK |
| [`runtime-checks.mjs`](runtime-checks.mjs) | the bundle imported as the portal imports it: `onLoadCallback`, the maps, the settings page, and with `--invoke` the class-side callbacks |
| [`shapes.mjs`](shapes.mjs) | the values that came out: items, components, returned messages, modals, the media viewer |

[`sandbox.mjs`](sandbox.mjs) rewrites the bundle's host-provided imports — as the portal does — to the react and SDK the *project* installed and the UI kit to the Proxy stand-in in [`stubs/`](stubs/) (every export a component, every enum member its own name), then imports it under a fake browser. Without `node_modules` the runtime pass is skipped with a warning. [`findings.mjs`](findings.mjs) defines a finding: `ERROR` — the portal will not do what the plugin intends, fails the run; `WARN` — probably works, or the gap is this tool's (an unstubbed browser API, a newer SDK, a deprecated form that still renders); `INFO` — context.

Finding codes and the key phrases of their messages are what [`../test-validator.mjs`](../test-validator.mjs) asserts on; renaming a code or rewording a message can break it.

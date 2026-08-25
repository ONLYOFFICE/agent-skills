# Target surface: SDK ↔ portal

Everything this plugin generates aims at one coherent pair of versions. Both halves matter: the SDK decides what **compiles**, the portal decides what **runs**. A scope that exists in the SDK but not in the portal produces a plugin that installs cleanly and then does nothing — the worst failure mode there is, because nothing reports it.

| | Version |
|---|---|
| SDK | `@onlyoffice/docspace-plugin-sdk` **`^2.1.0`** (npm `latest`) |
| Portal | DocSpace **4.0** |

These two agree exactly: the 4.0 client is built against SDK 2.1.0, and its loader handles precisely the ten scopes the SDK offers. There is no gap to work around.

**This skill tracks a portal branch, not a range.** Everything in these references is written in the present tense against the one portal above, verified against its client and the ui-kit revision it ships. It deliberately carries no history: no "this was broken on an older release", no per-feature version floors. A plugin cannot express a minimum portal version anyway — `minDocSpaceVersion` in `config.json` is written by the packer from the installed SDK, not by the author — so a floor stated here would be advice nobody can act on.

The consequence is that this skill and the portal move together: when the portal branch releases, this skill releases against it, and someone working against an older portal uses the matching older skill. That is the whole versioning story, and it lives here rather than being restated in every reference.

## The ten scopes

`IPlugin` is not a scope — it is the mandatory base contract every plugin implements, whatever else it does. The ten below are the choices layered on top; declare a scope in `package.json:scopes` **and** implement its interface, or nothing happens.

| Scope | Interface | Getter the loader calls | Items keyed by |
|---|---|---|---|
| `API` | `IApiPlugin` | `getAPI` (loader calls `setAPI` first) | — |
| `Settings` | `ISettingsPlugin` | `getAdminPluginSettings` | — |
| `ContextMenu` | `IContextMenuPlugin` | `getContextMenuItems` | `key` |
| `InfoPanel` | `IInfoPanelPlugin` | `getInfoPanelItems` | `key` |
| `MainButton` | `IMainButtonPlugin` | `getMainButtonItems` | `key` |
| `ProfileMenu` | `IProfileMenuPlugin` | `getProfileMenuItems` | `key` |
| `EventListener` | `IEventListenerPlugin` | `getEventListenerItems` | `key` |
| `File` | `IFilePlugin` | `getFileItems` | `extension` |
| `ArticleButton` | `IArticleButtonPlugin` | `getArticleButtonItems` | `key` |
| `PostMessage` | `IPostMessagePlugin` | `setPostMessageCallback` | — |

## Anything not in that table

The table is the whole list, and it is the answer to "does the SDK have a scope for this?". Nothing outside it may be generated or described as available — not a scope, not an interface, not an enum member — however plausible it sounds and however often it appears in material about the SDK.

Two different failures hide behind an invented name. One the SDK does not export is a build error, which is loud and cheap. One a newer SDK does export but no shipped portal handles is the expensive kind: the plugin compiles, packs, uploads, enables, and then silently shows nothing.

So when a request has no scope here, say plainly that the target pair does not support it and offer the closest supported entry point instead — for a sidebar presence, that is `ArticleButton`. `scripts/contract.mjs` enforces the same rule: a scope outside the table is an error in both the scaffolder and the validator.

## What comes from the SDK, and what does not

The SDK ships tooling of its own. We use the part that matters and replace two others — worth knowing why, because "just call the official command" is the obvious first instinct.

**Packaging comes from the SDK, untouched.** Generated projects run `webpack && npx build-docspace-plugin`, so the fiddly half — assembling `config.json` with its renamed fields, zipping, base64-encoding assets — stays the SDK's job and stays correct as the SDK evolves. None of it is reimplemented here.

**Scaffolding is ours,** because `create-docspace-plugin` cannot be driven programmatically and would not produce a working plugin anyway:

- it reads nothing from `process.argv` or the environment — its only input is `inquirer.prompt`, and the scopes question is a checkbox needing arrow keys, so calling it from a tool blocks forever;
- it emits an empty `onLoadCallback` and registers no items, so the result installs cleanly and then shows nothing;
- it derives `pluginName` itself (`my-plugin` → `Myplugin`, not `MyPlugin`) with no way to override.

**Build configs are ours,** because the SDK's `template/` has drifted from what ONLYOFFICE's own plugins use: it pins TypeScript `^4.7.4` where the shipped plugins use `^6.0.3`, and it requires three CSS packages that not one of the ten official plugins depends on — none of them ship a `plugin.css` at all. Copying the template would mean inheriting a stale toolchain to no benefit.

They live under inert filenames (`templates/tsconfig`, `templates/webpack.config`) so editors do not try to load this repository's copies as real project config.

### TypeScript 7 will need a change here

The generated `tsconfig.json` uses `target: "es5"` and `moduleResolution: "node"`, matching the official plugins. **Both options were removed in TypeScript 7**, which rejects them outright with TS5108. Nothing breaks today because the generated `package.json` pins `typescript: ^6.0.3`, so 7 is never installed — and that pin is doing real work, not just tidiness.

When ONLYOFFICE moves its plugins to TypeScript 7, `target` has to become `es2015` or later and `moduleResolution` `node16`/`bundler`. The pin lives in `scripts/generator/project-files.mjs`, the two options in `templates/tsconfig`; change them together, because changing only the pin produces a build that fails on both lines at once.

**Verify that change by building, not by reading.** Whether these versions compile the generated config together is not expressed anywhere in this repository — `test-validator.mjs` writes bundles by hand and never invokes npm, and building the SDK itself uses the root `tsconfig.json`, which is a different file with different options. So after touching the pin or anything in `templates/`, generate a project and build it:

```sh
node skills/plugin-sdk/scripts/generate-plugin.mjs --name smoke --plugin-name Smoke \
  --scopes ContextMenu,API --dir ../smoke
cd ../smoke && npm install && npm run build
```

A missing `dist/plugin.zip` means the toolchain no longer agrees with itself. Worth doing once with every scope declared too (`--scopes` with the full list), since a renamed SDK export only surfaces when every scope's imports are emitted at once.

Consequence worth remembering: the scope table above is maintained by hand, so when a new SDK lands, compare it against `npx/dialog.js` inside the installed package.

## Keeping this current

When a new SDK reaches npm **and** a portal release handles the new scopes, update in exactly two places:

1. this file — the version pair and the scope table;
2. `scripts/contract.mjs` — the scope, enum, action and component tables.

Everything else reads from those: the validator and the scaffolder both import `contract.mjs`, so a scope described once is checked and generated consistently.

You should not have to notice the new SDK yourself. `checkSdkDrift()` compares those tables against the SDK the audited project actually installed and warns when they part company — a new action, a new user type, a major version this tool was not written against. The warning is the prompt to come back here and decide whether a portal can host the new thing yet.

The tables are deliberately not *generated* from the SDK. The SDK says what compiles; this file says what runs. Those are different questions, and every SDK release that lands ahead of a portal release pulls the answers apart again.

### Vendoring the SDK — deliberately not done

It is tempting to ship an SDK tarball inside this plugin and install it via `file:`, sidestepping npm. Resist it until both halves move together.

The SDK contains no logic at all — its compiled output is 19 enums, and all 53 interface modules compile to empty files. So a newer SDK grants exactly one thing: the ability to *compile* against newer types. It cannot teach an older portal to render anything. Vendoring ahead of the portal therefore just converts a clear build error into a silent runtime no-op.

When the time comes, the mechanism is: place the tarball in `vendor/`, and have `scripts/generator/project-files.mjs` emit `"@onlyoffice/docspace-plugin-sdk": "file:<path>"` instead of the semver range it pins now.

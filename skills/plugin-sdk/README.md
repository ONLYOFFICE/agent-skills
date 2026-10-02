# ONLYOFFICE Apps plugin skill

A skill that teaches an AI coding agent to build, audit and explain ONLYOFFICE Apps plugins — React components built from the portal's own UI kit, registered through the Plugins SDK. Describe the feature ("a screen in ONLYOFFICE Apps listing our rooms", "a context menu action that pushes the selected file to our archive") and the agent produces a built, validated project with an uploadable `dist/plugin.zip`; point it at a plugin that misbehaves and it finds the reason.

ONLYOFFICE Apps reports very little about a plugin once it has loaded. A bundle with no default export or an import the portal does not provide is at least flagged on the plugin's card in the administrator's Plugins tab; a scope declared but not filled, a filter field spelled `usersType` where the portal reads `usersTypes`, an action returned without its payload — each installs cleanly and does nothing. This skill encodes those rules and checks them offline, the load failures included, before an archive reaches a portal. The body is [`SKILL.md`](SKILL.md); every supported agent is pointed at that one file.

## Installing it

As part of the `onlyoffice` plugin — see [Install](../../README.md#install) in the root README. On its own: copy or symlink this directory to where your agent scans for skills (for example `~/.claude/skills/plugin-sdk/`), or hand it `SKILL.md`. Its notes on the UI kit lean on the `ui-kit` skill for the kit's rules; installed without it, the skill reads the kit's own READMEs from the project's `node_modules` instead. `$SKILL` in the skill body means this directory, resolved to an absolute path.

## Tools

```sh
node skills/plugin-sdk/scripts/generate-plugin.mjs --name my-plugin --plugin-name MyPlugin --scopes ArticleNavigation,Settings --dir ./my-plugin
node skills/plugin-sdk/scripts/validate-plugin.mjs ./my-plugin --invoke
node skills/plugin-sdk/scripts/preview-plugin.mjs ./my-plugin
node skills/plugin-sdk/scripts/test-validator.mjs
```

The **generator** writes the plugin class with every member the loader calls, a Vite + React build that keeps the host-provided packages external, a typed localisation module for the languages given as `--locales` (validated against `PluginLocale`, since a table filed under `ja` instead of `ja-JP` is never read), the CSS-module declaration and a `typecheck` script, and copies in the packed `@onlyoffice/apps-ui-kit` and SDK from `vendor/`. It registers no items by design — a placeholder that survives into an upload is a plugin that looks alive and does the wrong thing.

The **validator** runs static checks over the manifest, build config, sources and packed archive — including whether that archive is newer than the sources, since uploading one packed before the last edit ships the previous build — then imports the built bundle the way the portal does — as an ES module, against the React and SDK the project installed, with a stand-in for the UI kit — executes `onLoadCallback` and verifies each declared scope registered items with the fields, components and filter values the portal reads. `--invoke` also calls the class-side callbacks and checks every returned action carries its payload.

Finally it **renders every component once** with the project's own React and the SDK's own runtime provider, each surface getting the runtime it really receives (a page and a click-opened dialog get no current file; an info panel tab and the media viewer get one), because a component that throws on first paint is a blank page on the portal with one line in the console. Effects do not run, and nothing reads the CSS: what a stylesheet does to the portal is decided by how it is imported, which is checked, and by rules only a reader can judge.

The sandbox has no network, so a callback that fetches before it returns anything takes its own failure path and hands over no surface to render. That is a **hole in the coverage and the run says so** — a `runtime` warning naming the callback, and a count beside the render tally — rather than reporting a clean pass over a click it never followed to the end.

The **browser pass** covers what a string render cannot. `preview-plugin.mjs` writes a throwaway harness into the project, serves it with the project's own Vite — the five host-provided specifiers bundled instead of external, since there is no portal to supply them — and mounts the built bundle in Chromium against the real UI kit and the real theme variables, at the width each surface gets, in both themes. Importing a kit component injects that component's real stylesheet, so the surface is laid out by the CSS that will lay it out on the portal. It then measures: a rule of the plugin's that matches portal-shaped markup planted beside it, a control that collapsed, content wider than its surface, boxes drawn over each other, a surface still blank after its effects ran, text the colour of its background. Screenshots of every surface in both themes go to `<project>/.plugin-preview/shots/`. Playwright is not a dependency of anything here: when it or its browser is missing the pass is skipped with the command to fix it, the way the runtime pass is skipped without `node_modules`.

What it cannot do is the reverse direction: the kit's stylesheets are in the page and the ONLYOFFICE Apps client's own are not, so a portal rule beating one of the plugin's is still only settled by an upload.

The **self-test** runs the validator against deliberately broken projects with hand-written bundles and asserts which findings it must and must not produce. It never invokes npm, so it is blind to the toolchain — see *Verifying the toolchain*.

## What it targets

SDK `@onlyoffice/docspace-plugin-sdk` **`^3.0.0`** and ONLYOFFICE Apps **4.0**; generated plugins are TypeScript + React 19, built with Vite and packed by the SDK's own `build-docspace-plugin`, matching the SDK's template. SDK 2 plugins (webpack, `window.Plugins`, declarative `IBox` trees) still run on the portal but are outside what the validator checks. See [references/plugins/scopes.md](references/plugins/scopes.md).

## Layout

```
SKILL.md      the skill: the router, the scope table, the Explain job and the checklist of rules
references/   the knowledge base
  plugins/      the scope catalogue and the SDK target, the plugin class, and a page each for API, Settings and PostMessage
  items/        a page per item type, and the fields every item shares
  components/   a page per surface the portal draws: modal, selector, create-file dialog, media viewer, progress button
  react/        how a component renders, the hooks, the actions, the API client
  *.md          the Build and Audit workflows, bundling, host behaviour, styling, the UI kit, the REST API, dependencies, reading SDK 2 plugins
scripts/      generate, validate, preview in a browser, self-test, and contract.mjs (the portal contract as data)
  generator/  validator/  validator-tests/  preview/
templates/    build config for generated projects (inert filenames so editors ignore them)
vendor/       the packed @onlyoffice/apps-ui-kit and the packed SDK
evals/        graded scenarios, the fixture plugin one of them starts from, and the trigger tests for the description — a maintenance tool, not read by agents
```

## Maintaining it

**Where a fact is written.** Once, on the page of the SDK type it belongs to — under `plugins/`, `items/`, `components/` or `react/`, each page named after its type without the `I`, in kebab-case (`IInfoPanelItem` → `references/items/info-panel-item.md`). The topical files at the root hold what belongs to no single type — loading, styling, the REST API, the workflows — and link to those pages rather than restating them; a symptom row in `portal.md` or a rule in `SKILL.md` is one line and a link. `SKILL.md` links every page directly, so none is reachable only through another page.

**Why the scaffolder is ours.** `npx create-docspace-plugin` is built on an interactive prompt (`inquirer`), so it blocks a tool call; it emits an empty `onLoadCallback`; it derives `pluginName` itself (`my-plugin` → `Myplugin`); and it knows nothing of the UI kit. Packaging, by contrast, comes from the SDK untouched: generated projects run `vite build && npx build-docspace-plugin`, and the build configs mirror the SDK's `template/`.

**Why the UI kit and the SDK travel as tarballs.** `@onlyoffice/apps-ui-kit` lives in its own repository, `docspace-ui-kit-react`; the bundle keeps it external, so it is a build-time (types) need only, and the revision a plugin compiles against must be the portal's, not whatever the registry serves as latest. `vendor/` holds `onlyoffice-apps-ui-kit-<version>.tgz`, packed with `pnpm build && pnpm verify:package && pnpm pack` in a checkout of that repository at the portal's revision — **with pnpm**, because `publishConfig` field overrides are a pnpm feature and an npm-packed tarball has no `exports` and no `main` at all. Since 4.0.0 the kit names no `file:` dependencies of its own (what used to be bundled is now optional peer dependencies), so no neighbouring tarballs travel with it and everything else it needs resolves from the registry. `node tools/sync-ui-kit.mjs --from <the unpacked tarball> --check` says whether the `ui-kit` skill's manifest describes the same kit. When the kit changes, rebuild that manifest, repack from the portal's revision, replace the tarball, and update [references/ui-kit.md](references/ui-kit.md) where behaviour moved — `docspace-ui-kit-react` has a `sync-ui-kit-reference` skill that reports exactly what drifted. SDK 3.0.0 is released but not yet on npm, so `vendor/` also holds `onlyoffice-docspace-plugin-sdk-3.0.0.tgz` and the generator installs from it whenever such a tarball is present. When it lands on npm, delete the tarball — the generator falls back to `SDK_RANGE` in `scripts/generator/project-files.mjs`. Until then pack it from the SDK repository's `develop` branch (`npm ci && npm run build && npm pack`) and repack whenever `develop` moves: the packer copies that package's `minDocSpaceVersion` into every generated plugin's `config.json`, and agents read the SDK's JSDoc out of this tarball.

**Verifying the toolchain.** Whether the pinned versions still compile the generated config is not expressed anywhere else, so after touching `scripts/generator/project-files.mjs`, `templates/` or `vendor/`:

```sh
node skills/plugin-sdk/scripts/generate-plugin.mjs --name smoke --plugin-name Smoke --scopes <all eleven> --locales ru,pt-BR --dir ../smoke
cd ../smoke && npm install && npm run build && npm run typecheck && node ../agent-skills/skills/plugin-sdk/scripts/validate-plugin.mjs . --invoke
```

A missing `dist/plugin.zip` means the toolchain disagrees with itself, and `typecheck` is the only thing that reads the generated types at all — `vite build` strips them, so a broken `locales.ts` or `css-modules.d.ts` builds cleanly. Pass `--locales`, or the extra-language tables are never generated in a smoke run. Use all eleven scopes — a renamed SDK export only surfaces when every scope's imports are emitted. If you swap the vendored SDK for a checkout, `npm pack` it rather than linking the directory, or the SDK's `react` peer resolves outside the project and the validator cannot import the bundle.

### Where the documentation links point

The references do not restate the SDK's documentation — signatures, props, enum values and method lists are linked, one docs page per interface, hook and enum, and the references keep only what the portal does with them. Every such link is built on a source in [`sources.json`](sources.json): `docs` for the Plugins SDK pages (indexed in [`llms.txt`](https://api.onlyoffice.com/docspace/plugins-sdk/llms.txt)) and `restDocs` for the REST API reference ([`llms.txt`](https://api.onlyoffice.com/docspace/api-backend/llms.txt)), both on the `apiSite` host declared once in the repository's root `sources.json`. Pages are linked in their `.md` form, which the docs site serves as plain Markdown — the `llms.txt` states the rule: replace the trailing slash of any page URL with `.md`.

The committed text always carries the production URLs. To work against a staging site or a local build of the docs, move the whole plugin there and back again before committing:

```sh
node tools/sync-sources.mjs --host apiSite=<origin of the staging site or local build>   # every link of every skill moves there
node tools/sync-sources.mjs --skill plugin-sdk --verify                                  # one request per link
node tools/sync-sources.mjs --host apiSite=<production origin>                           # back, so git status shows no change to sources.json
```

`localhost` is a placeholder host for the checker — links to it are neither checked nor verified — so a local build is addressed as `127.0.0.1` with its port. A new link enters a reference only if it is built on one of those two sources (or the SDK repository); `node tools/sync-sources.mjs --check` fails otherwise. Until the SDK 3.0 pages are published, `--verify` against production reports the pages the site does not have yet as `DEAD`; `--verify --fallback` requests the same links from the docs stand (`apiSiteFallback` in the root `sources.json`) without touching the text.

### Keeping it current

Everything describing what a portal accepts — scopes, item shapes, filter values, actions and payloads, host-provided packages — is in [`scripts/contract.mjs`](scripts/contract.mjs), imported by both the generator and the validator. What a scope *emits* is `SCOPE_SPECS` in [`scripts/generator/scopes.mjs`](scripts/generator/scopes.mjs); interfaces, member names and required fields come from the contract, because a name in two places will disagree with itself.

When a new SDK reaches npm **and** a portal release handles what it adds, update `contract.mjs` and the version pair in [references/plugins/scopes.md](references/plugins/scopes.md). You should not have to notice it yourself: the validator's `checkSdkDrift()` compares the contract against the SDK the audited project installed and warns when they diverge. The tables are deliberately not generated from the SDK — the SDK says what compiles, the references say what runs.

Run [the evals](evals/README.md) after a change to `SKILL.md` or a reference, before shipping.

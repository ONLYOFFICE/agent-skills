# DocSpace plugin skill

A skill that teaches an AI coding agent to build, audit and explain ONLYOFFICE DocSpace plugins — React components built from the portal's own UI kit, registered through the Plugins SDK. Describe the feature ("a screen in DocSpace listing our rooms", "a context menu action that pushes the selected file to our archive") and the agent produces a built, validated project with an uploadable `dist/plugin.zip`; point it at a plugin that misbehaves and it finds the reason.

DocSpace loads plugins with very little error reporting: a bundle with no default export, an import the portal does not provide, a scope declared but not filled, a filter field spelled `usersType` where the portal reads `usersTypes` — each installs cleanly and does nothing. This skill encodes those rules and checks them offline. The body is [`SKILL.md`](SKILL.md); every supported agent is pointed at that one file.

## Installing it

As part of the `onlyoffice` plugin — see [Install](../../README.md#install) in the root README. On its own: copy or symlink this directory to where your agent scans for skills (for example `~/.claude/skills/plugin-sdk/`), or hand it `SKILL.md`. `$SKILL` in the skill body means this directory, resolved to an absolute path.

## Tools

```sh
node skills/plugin-sdk/scripts/generate-plugin.mjs --name my-plugin --plugin-name MyPlugin --scopes ArticleNavigation,Settings --dir ./my-plugin
node skills/plugin-sdk/scripts/validate-plugin.mjs ./my-plugin --invoke
node skills/plugin-sdk/scripts/test-validator.mjs
```

The **generator** writes the plugin class with every member the loader calls, a Vite + React build that keeps the host-provided packages external, a typed localisation module for the languages given as `--locales` (validated against `PluginLocale`, since a table filed under `ja` instead of `ja-JP` is never read), the CSS-module declaration and a `typecheck` script, and copies in the packed `@docspace/ui-kit` and SDK from `vendor/`. It registers no items by design — a placeholder that survives into an upload is a plugin that looks alive and does the wrong thing.

The **validator** runs static checks over the manifest, build config, sources and packed archive, then imports the built bundle the way the portal does — as an ES module, against the React and SDK the project installed, with a stand-in for the UI kit — executes `onLoadCallback` and verifies each declared scope registered items with the fields, components and filter values the portal reads. `--invoke` also calls the class-side callbacks and checks every returned action carries its payload.

Finally it **renders every component once** with the project's own React and the SDK's own runtime provider, each surface getting the runtime it really receives (a page and a click-opened dialog get no current file; an info panel tab and the media viewer get one), because a component that throws on first paint is a blank page on the portal with one line in the console. Effects do not run, and nothing reads the CSS: what a stylesheet does to the portal is decided by how it is imported, which is checked, and by rules only a reader can judge.

The sandbox has no network, so a callback that fetches before it returns anything takes its own failure path and hands over no surface to render. That is a **hole in the coverage and the run says so** — a `runtime` warning naming the callback, and a count beside the render tally — rather than reporting a clean pass over a click it never followed to the end.

The **self-test** runs the validator against deliberately broken projects with hand-written bundles and asserts which findings it must and must not produce. It never invokes npm, so it is blind to the toolchain — see *Verifying the toolchain*.

## What it targets

SDK `@onlyoffice/docspace-plugin-sdk` **`^3.0.0`** and DocSpace **4.0**; generated plugins are TypeScript + React 19, built with Vite and packed by the SDK's own `build-docspace-plugin`, matching the SDK's template. SDK 2 plugins (webpack, `window.Plugins`, declarative `IBox` trees) still run on the portal but are outside what the validator checks. See [references/scopes.md](references/scopes.md).

## Layout

```
SKILL.md      the skill
references/   SDK target, class contract, item shapes, React runtime, host-drawn components, UI kit, styling, host behaviour, REST API, dependencies, reading SDK 2 plugins
scripts/      generate, validate, self-test, and contract.mjs (the portal contract as data)
  generator/  validator/  validator-tests/
templates/    build config for generated projects (inert filenames so editors ignore them)
vendor/       the packed @docspace/ui-kit and SDK, with the tarballs they depend on
evals/        three graded scenarios and the fixture plugin one of them starts from — a maintenance tool, not read by agents
```

## Maintaining it

**Why the scaffolder is ours.** `npx create-docspace-plugin` is built on an interactive prompt (`inquirer`), so it blocks a tool call; it emits an empty `onLoadCallback`; it derives `pluginName` itself (`my-plugin` → `Myplugin`); and it knows nothing of the UI kit. Packaging, by contrast, comes from the SDK untouched: generated projects run `vite build && npx build-docspace-plugin`, and the build configs mirror the SDK's `template/`.

**Why the UI kit and the SDK travel as tarballs.** `@docspace/ui-kit` is a workspace package of the DocSpace client (`libs/ui-kit`), published nowhere; the bundle keeps it external, so it is a build-time (types) need only. `vendor/` holds `docspace-ui-kit-<version>.tgz` (`cd libs/ui-kit && pnpm build && pnpm pack`) plus the tarballs its `package.json` names as `file:` dependencies — they must sit in the project root too, because npm resolves nested `file:` specs against the project. The kit revision must match the portal's; when `libs/ui-kit` changes, repack, replace the tarball, and update [references/ui-kit.md](references/ui-kit.md) where behaviour moved. SDK 3.0.0 is released but not yet on npm, so `vendor/` also holds `onlyoffice-docspace-plugin-sdk-3.0.0.tgz` and the generator installs from it whenever such a tarball is present. When it lands on npm, delete the tarball — the generator falls back to `SDK_RANGE` in `scripts/generator/project-files.mjs`.

**Verifying the toolchain.** Whether the pinned versions still compile the generated config is not expressed anywhere else, so after touching `scripts/generator/project-files.mjs`, `templates/` or `vendor/`:

```sh
node skills/plugin-sdk/scripts/generate-plugin.mjs --name smoke --plugin-name Smoke --scopes <all eleven> --locales ru,pt-BR --dir ../smoke
cd ../smoke && npm install && npm run build && npm run typecheck && node ../agent-skills/skills/plugin-sdk/scripts/validate-plugin.mjs . --invoke
```

A missing `dist/plugin.zip` means the toolchain disagrees with itself, and `typecheck` is the only thing that reads the generated types at all — `vite build` strips them, so a broken `locales.ts` or `css-modules.d.ts` builds cleanly. Pass `--locales`, or the extra-language tables are never generated in a smoke run. Use all eleven scopes — a renamed SDK export only surfaces when every scope's imports are emitted. If you swap the vendored SDK for a checkout, `npm pack` it rather than linking the directory, or the SDK's `react` peer resolves outside the project and the validator cannot import the bundle.

### Keeping it current

Everything describing what a portal accepts — scopes, item shapes, filter values, actions and payloads, host-provided packages — is in [`scripts/contract.mjs`](scripts/contract.mjs), imported by both the generator and the validator. What a scope *emits* is `SCOPE_SPECS` in [`scripts/generator/scopes.mjs`](scripts/generator/scopes.mjs); interfaces, member names and required fields come from the contract, because a name in two places will disagree with itself.

When a new SDK reaches npm **and** a portal release handles what it adds, update `contract.mjs` and the version pair in [references/scopes.md](references/scopes.md). You should not have to notice it yourself: the validator's `checkSdkDrift()` compares the contract against the SDK the audited project installed and warns when they diverge. The tables are deliberately not generated from the SDK — the SDK says what compiles, the references say what runs.

Run [the evals](evals/README.md) after a change to `SKILL.md` or a reference, before shipping.

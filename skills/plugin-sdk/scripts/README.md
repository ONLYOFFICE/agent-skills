# scripts/

What the three tools do, what they cannot, and how they are kept in step with the SDK and the
portal. The commands an agent runs are in the skill's [README](../README.md); the layers behind
each tool have a page of their own: [`generator/`](generator/README.md),
[`validator/`](validator/README.md), [`preview/`](preview/README.md),
[`validator-tests/`](validator-tests/README.md).

## What each pass does

The **generator** writes the plugin class with every member the loader calls, a Vite + React
build that keeps the host-provided packages external, a typed localisation module for the
languages given as `--locales` (validated against `PluginLocale`, since a table filed under `ja`
instead of `ja-JP` is never read), the CSS-module declaration and a `typecheck` script, and
depends on the SDK and `@onlyoffice/apps-ui-kit` from npm. It registers no items by design — a
placeholder that survives into an upload is a plugin that looks alive and does the wrong thing.

The **validator** runs static checks over the manifest, build config, sources and packed archive
— including whether that archive is newer than the sources, since uploading one packed before
the last edit ships the previous build — then imports the built bundle the way the portal does —
as an ES module, against the React and SDK the project installed, with a stand-in for the UI kit
— executes `onLoadCallback` and verifies each declared scope registered items with the fields,
components and filter values the portal reads. `--invoke` also calls the class-side callbacks
and checks every returned action carries its payload.

It then **renders every component once** with the project's own React and the SDK's own runtime
provider, each surface getting the runtime it really receives (a page and a click-opened dialog
get no current file; an info panel tab and the media viewer get one), because a component that
throws on first paint is a blank page on the portal with one line in the console. Effects do not
run, and nothing reads the CSS: what a stylesheet does to the portal is decided by how it is
imported, which is checked, and by rules only a reader can judge.

The sandbox has no network, so a callback that fetches before it returns anything takes its own
failure path and hands over no surface to render. That is a hole in the coverage and the run says
so — a `runtime` warning naming the callback, and a count beside the render tally — rather than
reporting a clean pass over a click it never followed to the end.

The **browser pass** covers what a string render cannot. `preview-plugin.mjs` writes a throwaway
harness into the project, serves it with the project's own Vite — the five host-provided
specifiers bundled instead of external, since there is no portal to supply them — and mounts the
built bundle in Chromium against the real UI kit and the real theme variables, at the width each
surface gets, in both themes. Importing a kit component injects that component's real stylesheet,
so the surface is laid out by the CSS that will lay it out on the portal. It then measures: a rule
of the plugin's that matches portal-shaped markup planted beside it, a control that collapsed,
content wider than its surface, boxes drawn over each other, a surface still blank after its
effects ran, text the colour of its background. Screenshots of every surface in both themes go to
`<project>/.plugin-preview/shots/`. Playwright is not a dependency of anything here: when it or
its browser is missing the pass is skipped with the command to fix it, the way the runtime pass
is skipped without `node_modules`.

What it cannot do is the reverse direction: the kit's stylesheets are in the page and the
ONLYOFFICE Apps client's own are not, so a portal rule beating one of the plugin's is still only
settled by an upload.

The **self-test** (`test-validator.mjs`) runs the validator against deliberately broken projects
with hand-written bundles and asserts which findings it must and must not produce. It never
invokes npm, so it is blind to the toolchain — see below.

## Why the scaffolder is ours

`npx create-docspace-plugin` is built on an interactive prompt (`inquirer`), so it blocks a tool
call; it emits an empty `onLoadCallback`; it derives `pluginName` itself (`my-plugin` →
`Myplugin`); and it knows nothing of the UI kit. Packaging, by contrast, comes from the SDK
untouched: generated projects run `vite build && npx build-docspace-plugin`, and the build
configs mirror the SDK's `template/`.

## Where the SDK and the UI kit come from

`@onlyoffice/apps-ui-kit` is installed from npm at `UI_KIT_RANGE` in
[`generator/project-files.mjs`](generator/project-files.mjs) — the range the portal itself
installs, so a plugin compiles against the kit it is handed. The bundle keeps the kit external, so
it is a build-time (types) need only. When the kit changes, move that range with the portal and
update [references/ui-kit.md](../references/ui-kit.md) where behaviour moved —
`docspace-ui-kit-react` has a `sync-ui-kit-reference` skill that reports exactly what drifted.
The SDK comes from npm at `SDK_RANGE` in the same file; its packer copies the installed package's
`minDocSpaceVersion` into every generated plugin's `config.json`, and agents read the SDK's JSDoc
out of `node_modules`.

## Keeping the contract current

Everything describing what a portal accepts — scopes, item shapes, filter values, actions and
payloads, host-provided packages — is in [`contract.mjs`](contract.mjs), imported by both the
generator and the validator. What a scope *emits* is `SCOPE_SPECS` in
[`generator/scopes.mjs`](generator/scopes.mjs); interfaces, member names and required fields come
from the contract, because a name in two places will disagree with itself.

When a new SDK reaches npm **and** a portal release handles what it adds, update `contract.mjs`
and the version pair in [references/plugins/scopes.md](../references/plugins/scopes.md). You
should not have to notice it yourself: the validator's `checkSdkDrift()` compares the contract
against the SDK the audited project installed and warns when they diverge. The tables are
deliberately not generated from the SDK — the SDK says what compiles, the references say what
runs.

## Verifying the toolchain

Whether the pinned versions still compile the generated config is not expressed anywhere else,
so after touching `generator/project-files.mjs` or `../templates/`, and after an SDK or kit
release:

```sh
node skills/plugin-sdk/scripts/generate-plugin.mjs --name smoke --plugin-name Smoke --scopes <all eleven> --locales ru,pt-BR --dir ../smoke
cd ../smoke && npm install && npm run build && npm run typecheck && node ../agent-skills/skills/plugin-sdk/scripts/validate-plugin.mjs . --invoke
```

A missing `dist/plugin.zip` means the toolchain disagrees with itself, and `typecheck` is the
only thing that reads the generated types at all — `vite build` strips them, so a broken
`locales.ts` or `css-modules.d.ts` builds cleanly. Pass `--locales`, or the extra-language tables
are never generated in a smoke run. Use all eleven scopes — a renamed SDK export only surfaces
when every scope's imports are emitted. If you swap the npm SDK for a checkout, `npm pack` it
rather than linking the directory, or the SDK's `react` peer resolves outside the project and the
validator cannot import the bundle.

Run the [evals](../evals/README.md) after a change to `SKILL.md` or a reference, before shipping.

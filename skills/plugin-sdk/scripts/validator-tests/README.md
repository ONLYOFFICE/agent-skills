# validator-tests/

The self-test behind [`../test-validator.mjs`](../test-validator.mjs): builds throwaway plugin projects in the OS temp dir, runs the validator over them, and asserts which finding codes (and message phrases) it must and must not produce.

| File | What it holds |
|---|---|
| [`harness.mjs`](harness.mjs) | a temp workspace, a validator run, a scoreboard — knows nothing about ONLYOFFICE Apps |
| [`fixtures.mjs`](fixtures.mjs) | the material to vary: manifests, hand-written ES module bundles, source files, a Vite config |
| [`suites/`](suites/) | the claims, one file per area: `manifest` (manifest, assets, registration, how a stylesheet is imported), `items`, `ui` (modals), `runtime` (load, imports, build config, settings), `render` (each surface rendered with its own runtime), `locales` (tables keyed by a tag `PluginLocale` does not have), `sdk-drift` |

Bundles are hand-written rather than compiled, which keeps this fast and offline — and blind to whether a real project builds; that is checked by generating and building one (skill [README](../../README.md#maintaining-it)). Run it after touching anything in `scripts/`.

React is never installed in a fixture, so `harness.installRenderer(dir)` writes a small stand-in — a `react-dom/server` that walks an element tree calling each function component, and an SDK React entry whose hooks answer from the runtime `withPluginRuntime` was handed. Only the `render` suite asks for it; everywhere else the hooks throw, which is what the other suites assert on, and the render pass skips itself for want of a renderer.

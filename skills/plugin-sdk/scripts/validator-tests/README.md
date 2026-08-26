# validator-tests/

The self-test behind [`../test-validator.mjs`](../test-validator.mjs): builds throwaway plugin projects in the OS temp dir, runs the validator over them, and asserts which finding codes (and message phrases) it must and must not produce.

| File | What it holds |
|---|---|
| [`harness.mjs`](harness.mjs) | a temp workspace, a validator run, a scoreboard — knows nothing about DocSpace |
| [`fixtures.mjs`](fixtures.mjs) | the material to vary: manifests, hand-written ES module bundles, source files, a Vite config |
| [`suites/`](suites/) | the claims, one file per area: `manifest`, `items`, `ui` (modals), `runtime` (load, imports, build config, settings), `sdk-drift` |

Bundles are hand-written rather than compiled, which keeps this fast and offline — and blind to whether a real project builds; that is checked by generating and building one (skill [README](../../README.md#maintaining-it)). Run it after touching anything in `scripts/`.

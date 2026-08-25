# validator-tests/

The self-test for the validator, behind [`../test-validator.mjs`](../test-validator.mjs). It builds throwaway plugin projects in the OS temp dir, runs the validator over them, and asserts which finding codes it must and must not produce.

```sh
node scripts/test-validator.mjs
```

| File | What it holds |
|---|---|
| [`harness.mjs`](harness.mjs) | the machinery: a temp workspace, a validator run, a scoreboard. Knows nothing about DocSpace |
| [`fixtures.mjs`](fixtures.mjs) | the material to vary: manifests, hand-written bundles, source files |
| [`suites/`](suites/) | the claims themselves — one file per area: `manifest`, `items`, `runtime`, `ui`, `sdk-drift` |

A suite reads as a list of *"this input produces that finding"*, with no temp-directory or JSON noise in between.

**Two things to know.** Bundles are hand-written rather than compiled, which keeps this fast and offline — and blind to the toolchain, so it says nothing about whether a real project builds (that is checked by hand; see [`../../references/sdk-target.md`](../../references/sdk-target.md)). Run it after touching anything in `scripts/`.

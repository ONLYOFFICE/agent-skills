# generator/

The layers behind [`../generate-plugin.mjs`](../generate-plugin.mjs), which scaffolds a plugin project. Nothing here is run directly.

In the order a run passes through them:

| File | What it does |
|---|---|
| [`options.mjs`](options.mjs) | argv in, validated options out — every bad request is rejected before a file is written |
| [`scopes.mjs`](scopes.mjs) | what each declared scope adds to the generated code, and the questions the rest of the generator asks about the set |
| [`sources.mjs`](sources.mjs) | renders `src/index.ts` and `src/locales.ts` |
| [`project-files.mjs`](project-files.mjs) | everything that is not TypeScript: manifest, pinned versions, placeholder icons, markdown |
| [`plugin-generator.mjs`](plugin-generator.mjs) | what a scaffold consists of, and the only code that writes to disk |

Everything above the last line returns strings, so the generator can be tested without a temp directory: build a source, read it, assert. Adding a file to a scaffold is one line in `generate()`; changing what goes inside one is a change in exactly one class.

**Two things to know.** Member names, interfaces, map fields and required item fields are never spelled out here — they come from [`../contract.mjs`](../contract.mjs), so adding a scope means an entry there *and* an entry in `SCOPE_SPECS`. And the scaffold registers no items on purpose: `onLoadCallback` gets a TODO per scope, which is why a fresh project builds but does not yet pass the validator. A scaffold shipping working placeholders would validate on the spot, but a placeholder that survives into an upload is a plugin that installs, looks alive and does the wrong thing.

Two smaller decisions, recorded here rather than in the sources:

- **Why this exists next to `npx create-docspace-plugin`.** That one is built on inquirer, so it blocks waiting for keyboard input — which hangs an agent's tool call. This generator takes every answer as a flag.
- **Why `SCOPE_SPECS` is one table.** Most specs are two lines, and they only carry what the contract cannot express: extra SDK type imports, the members a non-map scope needs, methods beyond the standard adder/getter/updater, the icons its items reference, and the one thing about the scope that catches people out.

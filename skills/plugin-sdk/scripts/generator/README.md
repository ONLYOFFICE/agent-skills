# generator/

The layers behind [`../generate-plugin.mjs`](../generate-plugin.mjs), which scaffolds a plugin project. Nothing here is run directly. In the order a run passes through them:

| File | What it does |
|---|---|
| [`options.mjs`](options.mjs) | argv in, validated options out; refuses a `--locales` tag `PluginLocale` does not have (naming the near ones, since `ja` for `ja-JP` compiles and never shows) |
| [`scopes.mjs`](scopes.mjs) | `SCOPE_SPECS` — what each declared scope adds to the generated code |
| [`sources.mjs`](sources.mjs) | renders `src/index.ts` (the class, ending in `export default plugin`) and `src/locales.ts` — one typed table per requested language, keyed by the `PluginLocale` member so the portal's `setLanguage` value finds it, plus `t()` and `tf()` |
| [`project-files.mjs`](project-files.mjs) | the manifest with `runtime: "module"`, pinned versions, placeholder icons, markdown |
| [`plugin-generator.mjs`](plugin-generator.mjs) | what a scaffold consists of, and the only code that writes to disk — including the build config from `../../templates/` |

Member names, interfaces, map fields and required item fields come from [`../contract.mjs`](../contract.mjs), so adding a scope means an entry there *and* in `SCOPE_SPECS`. The scaffold registers no items on purpose: `onLoadCallback` gets a TODO per scope, so a fresh project builds but does not yet pass the validator. There is no automated test for the generator — verify changes by generating a project with every scope and building it (see the skill [README](../../README.md#maintaining-it)).

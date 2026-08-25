# validator/

The passes behind [`../validate-plugin.mjs`](../validate-plugin.mjs), which checks a plugin against what the portal's loader actually does. Nothing here is run directly.

In the order they run:

| File | What it checks |
|---|---|
| [`plugin-project.mjs`](plugin-project.mjs) | nothing — it reads the project and reports facts: manifest, assets, source text, whether a build exists |
| [`project-checks.mjs`](project-checks.mjs) | the project as written: manifest, assets, sources |
| [`archive-checks.mjs`](archive-checks.mjs) | `dist/`, the packed archive and its `config.json`, and drift from the installed SDK |
| [`runtime-checks.mjs`](runtime-checks.mjs) | the bundle in a sandbox: `onLoadCallback`, the maps the loader reads, and with `--invoke` the item callbacks |
| [`shapes.mjs`](shapes.mjs) | the values that came out of it: items, returned messages, component trees |

Supporting cast: [`sandbox.mjs`](sandbox.mjs) is the fake browser the bundle runs in, and [`findings.mjs`](findings.mjs) defines what a finding is and what its level means.

**Two things to know.** Reading is separated from judging — a check never wonders where its input came from. And finding **codes are the report's contract**: [`../test-validator.mjs`](../test-validator.mjs) and the eval grader both match on them, so renaming one breaks both.

The three levels a finding can carry, and the difference is load-bearing:

| Level | Means |
|---|---|
| `ERROR` | the portal will not do what the plugin intends — fails the run |
| `WARN` | it will probably work, or the gap is this tool's rather than the plugin's: an unstubbed browser API, a newer SDK, a dead enum value |
| `INFO` | context the reader needs to judge the rest |

Two details of how `plugin-project.mjs` reads, which several checks depend on:

- **Comments are stripped from the source text**, so a commented-out item or icon is not counted as a live reference. Real plugins rely on this — draw.io keeps a disabled main button item in comments.
- **The SDK is imported from the audited project**, not from this repository. The question a check asks is what that project builds against.

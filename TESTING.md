# Testing

How to check the plugin on your own machine, what each check tells you, and which ones a
change needs. There is no CI yet; this is the protocol it will run.

## The layers

| Layer | Command | Catches | Cost |
|---|---|---|---|
| Manifests and structure | `claude plugin validate . --strict` **and** `claude plugin validate skills --strict` | a broken `plugin.json` / `marketplace.json` (the first), a skill without frontmatter or with a bad `name` (the second — the first stops at the manifest and never reads a `SKILL.md`) | seconds |
| Validator self-tests | `node skills/embed-sdk/scripts/test-validator.mjs`, `node skills/plugin-sdk/scripts/test-validator.mjs`, `node skills/ui-kit/scripts/test-validator.mjs` | a rule the validators stopped enforcing; the embed-sdk one also runs `sync-sources --check` and compares the validator's dictionaries with the SDK checkout when `--from` is set; the ui-kit one also runs `sync-ui-kit --check` | seconds |
| Kit manifest | `node tools/sync-ui-kit.mjs --from <kit> --check` | a `skills/ui-kit` manifest that no longer matches the kit's metadata — rerun with `--write`; needs a kit checkout or an installed package | seconds |
| Docs script self-test | `node .claude/skills/onlyoffice-docs/scripts/test-docs.mjs` | the parsers behind the internal docs script, offline | seconds |
| Links and pins | `node tools/sync-sources.mjs --check` | a link not built on a declared host, a version literal that disagrees with a skill's `sources.json` | seconds |
| Links, live | `node tools/sync-sources.mjs --verify` (production) or `--verify --fallback` (the stand) | a page the site no longer serves | one request per link |
| Docs availability | `node .claude/skills/onlyoffice-docs/scripts/docs.mjs status` | whether production serves `llms.txt` and Markdown pages for every section (exit 0), only the stand does (1), or neither (2) | a few requests |
| Token budget | `claude plugin details onlyoffice` (the installed copy) | the always-on cost of the descriptions and the on-invoke cost of each skill | seconds |
| Behaviour | `claude plugin eval …` | whether the skills change what the agent produces — see below | model calls, dollars |

## What to run when

**After any edit** to a `SKILL.md`, a reference, a script or a manifest:

```sh
claude plugin validate . --strict
claude plugin validate skills --strict
node skills/embed-sdk/scripts/test-validator.mjs
node skills/plugin-sdk/scripts/test-validator.mjs
node skills/ui-kit/scripts/test-validator.mjs
node .claude/skills/onlyoffice-docs/scripts/test-docs.mjs
node tools/sync-sources.mjs --check
node tools/sync-ui-kit.mjs --from <kit> --check     # with a kit checkout or an installed package at hand
```

All eight are offline and finish in seconds; a red one blocks the commit.

**After a content change** to a skill (a rule, a reference passage, a description), add the
cheap behaviour suite:

```sh
claude plugin eval . --tag question --tag trigger --trust-plugin --no-publish --max-cost-usd 12 --allow-tools WebFetch
```

`WebFetch` is for `ui-kit-explain-aside-prop`, which is graded on naming the docs page it read;
without the grant it cannot pass. Seven cases, two arms, three runs each: about 20 minutes and $5–6. Compare with the last row of
[evals/README.md → Results](evals/README.md#results) and add a row.

**Before a release**, everything above plus the build cases and the live checks
([RELEASING.md → Checklist](RELEASING.md#checklist)):

```sh
node tools/sync-sources.mjs --verify
node .claude/skills/onlyoffice-docs/scripts/docs.mjs status
claude plugin eval . --tag build --trust-plugin --no-publish --max-cost-usd 20 --allow-tools Write Edit Bash WebFetch
```

## The behaviour suite

`evals/` at the plugin root is read by `claude plugin eval`; [evals/README.md](evals/README.md)
lists the cases and how each is graded. What to know before running it:

- **Two arms.** Every case runs with the plugin and, by default, again without it; the report's
  `Δ` is the difference. A case with `Δ ≈ 0` on every model measures nothing (the model answers
  correctly on its own) and is kept only as a regression guard — say so in its description or drop
  it. `--ablation none` runs the with-arm alone, half the cost, while you iterate on graders.
- **Iterate on one case first.** `--case <name> --runs 1 --ablation none` costs cents and shows
  every grader's verdict; the `report.html` path printed at the end has the judge's votes and the
  text it judged.
- **Grants.** Read-only tools listed in a case's `allowed_tools` are granted automatically;
  `Write`, `Edit`, `Bash` and `WebFetch` need `--allow-tools`. A shell grant needs a sandbox
  backend: **on Windows the tool refuses a run with `Bash` granted**, so the build cases run here
  with `--allow-tools Write Edit` and their `config-validated` / `validated-against-loader`
  graders fail by construction; run the full build suite on Linux or macOS. The `heavy` cases
  (npm install, Vite build) need the network and up to an hour.
- **The judge.** `llm` graders use a small model; when a rubric fails on an answer that looks
  right, re-run with `--judge-model sonnet` before changing the skill, and tighten the rubric so
  formatting does not decide it.
- **Other models.** `--model haiku` / `--model opus` run the same suite against another agent
  model; record each in the Results table with the model named.
- **Noise you can ignore.** `"plugin:onlyoffice:docspace" has no mock and is NOT started`: the
  MCP server the plugin ships is not needed by any case. `not granted: WebFetch` on a question
  case: the answer comes from the skill, not the site.
- **Results** land in `evals/results/<timestamp>/` (gitignored); `--json <path>` writes the
  machine-readable summary — `aggregates.overallScore`, `aggregates.meanDelta`, per-case arms.

## The per-skill A/B protocol

`skills/<name>/evals/` keeps the older, hand-graded protocol in skill-creator format: long
scenarios with `[C]`/`[Q]` expectations (`evals.json`), the G1 admin-panel task with its
39-checkpoint rubric, and twenty trigger messages per skill. Use it to iterate on a skill inside
a session — the skill-creator plugin runs the with/without pairs and opens a viewer — and when a
scenario is too long or too open-ended for a plugin-eval grader. Each directory's `README.md`
has the steps and the results table; the trigger tests have a runner
(`node tools/run-triggers.mjs --skill <name> --model sonnet`) that the plugin suite's
`tool_used: Skill` graders replace for the cases it covers.

## Checking a fact against the sources

A claim in a reference is checked before it is written, and a correction commit names what was
checked. The sources, in order of authority: the installed package's types
(`node_modules/@onlyoffice/*/dist/types`), the SDK source at the branch the skill targets, the
client (`DocSpace/client`, `release/v4.0.0`), and the docs page — read with
`node .claude/skills/onlyoffice-docs/scripts/docs.mjs page <Type> --heading <text>`, whose
`generated from: … (branch …)` line tells you which branch the page describes. A docs page
generated from an older branch is stale, not wrong.

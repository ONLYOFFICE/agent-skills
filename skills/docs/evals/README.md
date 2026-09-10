# Evals

A measuring instrument for the skill, not part of it: nothing in `SKILL.md` references this directory and no agent reads it while working.

The skill's whole claim is that it stops integrations from failing *quietly* — a reused `document.key`, a callback answered with anything but `{"error": 0}`, a conversion request missing `Accept: application/json`, a JWT signed in the browser. None of that throws, so "does it run" proves nothing. Each scenario runs twice — with the skill in context and without — and is compared. A check the with-skill run passes and the baseline fails is a passage doing real work; a check **both** pass is a passage that can probably be deleted.

## The scenarios

[`evals.json`](evals.json) holds four. Three are `build`, one is `audit`:

| # | Name | Reference files under strain | What it tests |
|---|---|---|---|
| 0 | `sample-app-from-scratch` | `example.md`, `example-checklist.md`, `templates.md`, `api-testing.md`, `infrastructure/backend.md`, `architecture/hexagonal.md`, `additional/conversion/*` | the whole pipeline in a language the official examples don't cover (Go): five endpoints, a removable UI, key rotation that survives a restart, vendored templates instead of generated ones, the format table driving the legacy `.doc` path, one test per endpoint and status branch |
| 1 | `callback-retry-loop` | `callback/handler.md`, `signature/body.md` | the callback contract read from a symptom, not a spec: the exact `{"error": 0}` body, the full status table, verification before the download, claims compared to the sibling root fields, a genuine failure still answering non-zero |
| 2 | `conversion-progress` | `additional/conversion/{request,response,errors,table}.md`, `signature/body.md` | the conversion contract's silent traps: the `Accept` header, re-polling under the *same* key, `percent` as the progress source, `-7`/`-5` as distinct answers rather than one "conversion failed" |
| 3 | `audit-broken-embed` | `api.md`, `configuration/{config,document,editor,events}.md`, `signature/browser.md` | reading someone else's integration: two symptoms traced to their real causes, the flat-config pollution and the browser-side secret found on the way, and the one file that's actually correct left alone |

Four separate deliverables rather than one, so a failure in scenario 0's build doesn't darken every check at once. `automation.md` and `methods.md` are left out on purpose — Automation needs a Developer license to test against, and `methods.md` is a catalog scenario 3's audit already brushes.

Prompts are written the way someone would actually ask — lowercase, mid-thought, symptom-first — and **never name the mechanism**: no `callbackUrl`, no `documentType`, no "rotate the key", no "JWT vector". Recognising which rule a complaint maps to is the job being measured. What they do name is fair game (product, port, language, env var) — a real user names those.

Scenario 3 starts from [`fixtures/broken-embed/`](fixtures/broken-embed/), a small Express portal with ten planted faults. Its `server.js` `/track` handler is **deliberately correct** — token verified before fetch, `2`/`6` handled, `{"error": 0}` returned — and one assertion pins that a review doesn't report it as broken anyway; padding a report with a finding that isn't there is a real failure mode and cheaper to catch here than in front of a customer. Keep that handler correct when editing the fixture. The two files in `storage/` are text placeholders, read as source and never executed.

**No Document Server is needed to run any of this** — every assertion is static, so a run costs tokens and nothing else, and the set can run anywhere, anytime. The cost is real: nothing here proves a generated integration talks to a live editor, only that it obeys the contract the live editor enforces. A live smoke test is a separate exercise, not something to bolt onto these.

## Running them

Same protocol as [`plugin-sdk`'s evals](../../plugin-sdk/evals/README.md): after a change to `SKILL.md` or a reference, before shipping — once, not in a loop. Ask `skill-creator`, which owns it:

```
run the evals for skills/docs, iteration-1
```

It spawns two runs per scenario under `<workspace>/iteration-N/eval-<id>/{with_skill,without_skill}/`, grades each against the scenario's `assertions`, and opens a viewer. Run the prompts **verbatim** — several checks read chosen words, and the prompts are worded to withhold the mechanism. Use `without_skill` as the baseline, not `old_skill`.

[`scripts/signals.mjs`](scripts/signals.mjs) `<run-dir> [<run-dir> ...]` collects regex evidence from a run's outputs so the grader has line-anchored places to look instead of re-reading a whole project per assertion — a hit is evidence, not a verdict. Add `--json` for machine-readable output.

### Keeping the baseline honest

The baseline is only a baseline if it never sees the skill. An exploring agent *will* read sibling directories, and this repo is exactly the sibling that ruins the measurement:

- Run each arm in its own directory away from any checkout of this repo, scoped explicitly to that directory.
- Hand scenario 3's fixture over as a **copy**, not a path into `skills/docs/evals/` — a baseline given that path is one `cd ..` from `SKILL.md`.
- Audit afterwards: grep the transcript for `agent-skills`, `SKILL.md`, `references/`, `evals/`. Where no transcript is persisted, ask the agent to enumerate every file it read outside its working directory — its context is intact and it generally answers honestly.
- Same model and effort settings in both arms, fresh session each.

Baselines are reusable across iterations while the prompt and model are unchanged — copy them forward rather than paying for them again. Run only the scenarios a change could touch. The model is not deterministic; for the scenario a change was meant to affect, give a variant several run directories (`with_skill`, `with_skill-2`, …) and compare the spread before reading one changed check as a regression.

## Adding one

The best scenarios come from real failures: turn the report into a scenario, watch it fail, fix the skill, watch it pass. An entry needs a `name`, a `mode` (`build`, `audit`, `explain`), a prompt written as a person would ask with the mechanism withheld, and assertions a grader can settle by reading the output — "the successful path responds with exactly `{"error": 0}`, because anything else reads to the editing service as a failed delivery" — with the reason in the same sentence where the reason is the point.

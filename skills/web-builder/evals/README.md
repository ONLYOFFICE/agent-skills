# Evals

A measuring instrument for the skill, not part of it: nothing in `SKILL.md` references this directory and no agent reads it while working.

The skill's whole claim is that it stops Document Builder integrations from failing *quietly* — a poll that re-sends the script instead of the returned `key`, a progress bar animating a `percent` the service never sends, an `argument` dropped because it sat beside the JWT instead of inside it, customer data spliced into script source, a temporary result link stored as if it were permanent. None of that throws, so "does it run" proves nothing. Each scenario runs twice — with the skill in context and without — and is compared. A check the with-skill run passes and the baseline fails is a passage doing real work; a check **both** pass is a passage that can probably be deleted.

## The scenarios

[`evals.json`](evals.json) holds four. Three are `build`, one is `audit`:

| # | Name | Core rules under strain | What it tests |
|---|---|---|---|
| 0 | `report-generation-progress` | builder ≠ converter, token-only params, script as code, error codes, temporary `urls` | the async contract: the server-issued `key`, polls as `{async, key}` each signed on their own, no `percent` to render, data in `argument`, the result pulled into S3 under its `SaveFile` name |
| 1 | `batch-letters-sync` | script as code, token-only params, error codes | a synchronous batch: one static script plus `argument` as the answer to names with apostrophes and accents, and not inventing an async/polling flow the task never asked for |
| 2 | `argument-dropped-under-jwt` | token-only params | a symptom ("every field says undefined") that points at the script but is the JWT payload replacing the request's parameters - and recognising that turning JWT off would mask it, not fix it |
| 3 | `audit-broken-invoicer` | error codes, script as code, no `percent`, temporary `urls` | reading someone else's generator: a hang traced to *two* compounding causes (unchecked `error`, no bound), a deterministic per-order failure traced to data spliced into script source, a synthetic 99% bar, dead email links from stored temporary URLs, a catch-all message, public leftover scripts - and two things (token placement, polling by key) that are already correct and shouldn't be flagged |

Prompts are written the way someone would actually ask - lowercase, mid-thought, symptom-first - and **never name the mechanism**: no "put argument in the token", no "poll with the returned key", no "there is no percent". Recognising which rule a complaint maps to is the job being measured. What it does name is fair game (product, language, env var, file sizes) - a real user names those. Scenario 2 shows the request body because a real user pasting their code would.

Scenario 3 starts from [`fixtures/broken-invoicer/`](fixtures/broken-invoicer/), an invoice generator with several planted faults chosen to be internally consistent with "mostly works": the unchecked-`error`/unbounded-loop pair only bites when a job errors, and the one thing that makes a job error deterministically - a double quote or backslash in spliced-in order data - only exists for some orders, which is why requeuing the same order hangs again. Its token handling and its polling by key are **deliberately correct**, and assertions pin that a review doesn't report them as broken anyway; its template's `SaveFile` name matches the `urls` key the code reads, since a mismatch would fail every invoice. Keep all three correct when editing the fixture.

## Running it

Same protocol as [`plugin-sdk`'s evals](../../plugin-sdk/evals/README.md): after a change to `SKILL.md`, before shipping - once, not in a loop. Ask `skill-creator`, which owns it:

```
run the evals for skills/web-builder, iteration-1
```

It spawns two runs per scenario under `skills/web-builder-workspace/iteration-N/eval-<name>/{with_skill,without_skill}/`, grades each against the scenario's `assertions`, and opens a viewer. Run the prompts **verbatim** - several checks read chosen words, and they're worded to withhold the mechanism. Use `without_skill` as the baseline, not `old_skill`.

[`scripts/signals.mjs`](scripts/signals.mjs) `<run-dir> [<run-dir> ...]` collects regex evidence from a run's outputs so the grader has line-anchored places to look instead of re-reading a whole project per assertion - a hit is evidence, not a verdict. Add `--json` for machine-readable output.

### Keeping the baseline honest

The baseline is only a baseline if it never sees the skill. An exploring agent *will* read sibling directories, and this repo is exactly the sibling that ruins the measurement:

- Run each arm in its own directory away from any checkout of this repo, scoped explicitly to that directory.
- Hand scenario 3's fixture over as a **copy**, not a path into `skills/web-builder/evals/` - a baseline given that path is one `cd ..` from `SKILL.md`.
- Audit afterwards: grep the transcript for `agent-skills`, `SKILL.md`, `evals/`. Where no transcript is persisted, ask the agent to enumerate every file it read outside its working directory — its context is intact and it generally answers honestly.
- Same model and effort settings in both arms, fresh session each.

Baselines are reusable across iterations while the prompt and model are unchanged - copy them forward rather than paying for them again. Run only the scenarios a change could touch. The model is not deterministic; for the scenario a change was meant to affect, give a variant several run directories (`with_skill`, `with_skill-2`, ...) and compare the spread before reading one changed check as a regression.

## Adding one

The best scenarios come from real failures: turn the report into a scenario, watch it fail, fix the skill, watch it pass. An entry needs a `name`, a `mode` (`build`, `audit`, `explain`), a prompt written as a person would ask with the mechanism withheld, and assertions a grader can settle by reading the output - "polls send `async` and `key` rather than re-sending the url, which would queue a new job each time" - with the reason in the same sentence where the reason is the point.

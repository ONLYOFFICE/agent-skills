# Evals

A measuring instrument for the skill, not part of it: nothing in `SKILL.md` references this directory and no agent reads it while working.

The skill's whole claim is that it stops conversion integrations from failing *quietly* - a parameter sent beside the JWT instead of inside it, a progress bar bound to a `percent` that is only ever 0 or 100, a poll that mints a fresh `key` per attempt, a flat "conversion failed" message hiding a permanent token error behind a transient-looking one. None of that throws, so "does it run" proves nothing. Each scenario runs twice - with the skill in context and without - and is compared. A check the with-skill run passes and the baseline fails is a passage doing real work; a check **both** pass is a passage that can probably be deleted.

## The scenarios

[`evals.json`](evals.json) holds four. Three are `build`, one is `audit`:

| # | Name | Reference files under strain | What it tests |
|---|---|---|---|
| 0 | `conversion-progress` | `request.md`, `response.md`, `errors.md`, `table.md`, `signing.md` | the conversion contract's silent traps: every parameter inside the token, re-polling under the *same* key, progress as a state because `percent` is only 0 or 100, `-7`/`-5` as distinct answers rather than one "conversion failed" |
| 1 | `legacy-doc-migration-batch` | `request.md`, `table.md`, `signing.md`, `errors.md` | a synchronous (non-async) batch: checking a pair against the vendored table before running rather than after, `password`, and not inventing an async/polling flow the task never asked for |
| 2 | `converter-misdiagnosed-auth-failure` | `errors.md`, `request.md` | a symptom that looks like an auth problem but isn't - distinguishing `-5` (missing `password`, deterministic, retry-proof) from `-8` (an actual signing failure), and recognizing when disabling JWT would fix nothing |
| 3 | `audit-broken-converter` | `response.md`, `errors.md`, `table.md`, `signing.md` | reading someone else's conversion worker: a hung polling loop traced to *three* compounding causes (fresh key per attempt, an unchecked `error` field, no bound), a silently unsupported new format, a generic catch all message, a progress callback fed from `percent` (only ever 0 or 100) found on inspection, and the two things that are already correct and shouldn't be flagged (lowercasing, and a header token signed over the full request) |

Prompts are written the way someone would actually ask - lowercase, mid-thought, symptom-first - and **never name the mechanism**: no "sign the body token", no "poll with the same key", no "check the format table". Recognising which rule a complaint maps to is the job being measured. What it does name is fair game (product, language, env var, file sizes) - a real user names those.

Scenario 3 starts from [`fixtures/broken-converter/`](fixtures/broken-converter/), a small conversion-worker module with several planted faults chosen to be internally consistent with "mostly works" - each bug only breaks the specific case it breaks (a fresh-key/unchecked-error/unbounded-loop combination only ever surfaces on jobs needing more than one poll; a hardcoded format list only breaks the one format added after it was written), rather than a bug that would make every conversion fail and contradict the premise. Its `filetype`/`outputtype` lowercasing and its `Authorization: Bearer` token (signed over every parameter, which the service accepts when the body carries no `token`) are **deliberately correct**, and assertions pin that a review doesn't report them as broken anyway; it posts to `/converter`, which answers in JSON without an `Accept` header - on `/ConvertService.ashx` every conversion would fail and break the premise. Keep all three when editing the fixture.

## Running it

Same protocol as [`plugin-sdk`'s evals](../../plugin-sdk/evals/README.md): after a change to `SKILL.md` or a reference, before shipping - once, not in a loop. Ask `skill-creator`, which owns it:

```
run the evals for skills/web-converter, iteration-1
```

It spawns two runs per scenario under `<workspace>/iteration-N/eval-<id>/{with_skill,without_skill}/`, grades each against the scenario's `assertions`, and opens a viewer. Run the prompts **verbatim** - several checks read chosen words, and they're worded to withhold the mechanism. Use `without_skill` as the baseline, not `old_skill`.

**Evals run against the staging docs.** The skill links to `api.onlyoffice.com`; before the run, point the whole plugin at staging with the staging `--host apiSite=…` command from [`sync-sources`](../../../.claude/skills/sync-sources/SKILL.md#commands), and run its back-to-production command after grading. Don't commit while switched - afterwards `git status` should show no change to `sources.json` or to any skill's links.

[`scripts/signals.mjs`](scripts/signals.mjs) `<run-dir> [<run-dir> ...]` collects regex evidence from a run's outputs so the grader has line-anchored places to look instead of re-reading a whole project per assertion - a hit is evidence, not a verdict. Add `--json` for machine-readable output.

### Keeping the baseline honest

The baseline is only a baseline if it never sees the skill. An exploring agent *will* read sibling directories, and this repo is exactly the sibling that ruins the measurement:

- Run each arm in its own directory away from any checkout of this repo, scoped explicitly to that directory.
- Hand scenario 3's fixture over as a **copy**, not a path into `skills/web-converter/evals/` - a baseline given that path is one `cd ..` from `SKILL.md`.
- Audit afterwards: grep the transcript for `agent-skills`, `SKILL.md`, `references/`, `evals/`. Where no transcript is persisted, ask the agent to enumerate every file it read outside its working directory - its context is intact and it generally answers honestly.
- Same model and effort settings in both arms, fresh session each.

Baselines are reusable across iterations while the prompt and model are unchanged - copy them forward rather than paying for them again. Run only the scenarios a change could touch. The model is not deterministic; for the scenario a change was meant to affect, give a variant several run directories (`with_skill`, `with_skill-2`, ...) and compare the spread before reading one changed check as a regression.

## Adding one

The best scenarios come from real failures: turn the report into a scenario, watch it fail, fix the skill, watch it pass. An entry needs a `name`, a `mode` (`build`, `audit`, `explain`), a prompt written as a person would ask with the mechanism withheld, and assertions a grader can settle by reading the output - "the request sends `Accept: application/json`, because the service answers this endpoint in XML by default" - with the reason in the same sentence where the reason is the point.

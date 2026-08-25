# Evals

A measuring instrument for the skill, not part of it. Nothing in `SKILL.md` references this directory and no agent reads it while working — it costs nothing at runtime.

## Why it exists

`test-validator.mjs` proves the validator catches what it should. It says nothing about the part that is hardest to get right: whether the *instructions* lead an agent to a correct plugin. That question has no static answer. The only way to see it is to run the thing.

So each scenario here is run twice — once with the skill in context, once without — and the two are compared. The comparison is the point, and it answers in both directions:

- a check the with-skill run passes and the baseline fails is a passage doing real work;
- a check **both** pass is a passage that can probably be deleted. The model already knew. Half of improving a skill is cutting text that changes nothing, because a shorter skill is a skill the model follows more closely.

## The scenarios

[`evals.json`](evals.json) holds three, all `build`. Each is a whole multi-scope feature rather than one capability, because a run costs roughly 100k tokens and the interesting failures are the ones that survive a real project:

| # | Name | Scopes | What it puts under strain |
|---|---|---|---|
| 0 | `file-type-and-actions` | File, MainButton, ContextMenu, API | owning an extension end to end: the dot in the map key, the portal's create dialog (which does not append the extension), the two-step upload session, `.response` unwrapping — plus a modal with live validation across two elements |
| 1 | `settings-events-and-progress` | Settings, InfoPanel, EventListener, ArticleButton, ContextMenu, API | the admin-facing half: settings that arrive after installation, a tab that fetches in its own `onLoad`, no-argument event handlers, the 32×32 sidebar slot, a bulk action placed in the context menu rather than the main button, and progress through the floating operations button |
| 2 | `extend-with-external-tool` | ProfileMenu, PostMessage (on a live ContextMenu plugin) | a live contract — name, keys, version, existing conventions — plus an origin boundary: `cspDomains` (and its shipped `scpDomains` typo), the listener on `window.parent`, the portal-handed callback |

Between them the three cover all ten scopes. That is the point of the grouping: fewer runs, same surface.

The trade is worth stating, because it is the reason not to go further and merge them into one. A bigger project hides more behind an early failure — if the build breaks, every check in that scenario goes dark at once, and a third of the suite says nothing. Three projects keep three independent signals; one project would leave none.

The suite measures the **build** job only. Audit and explain are graded by reading; the prose-grading machinery (`REPORT_CHECKS`, the `audit`/`explain` modes) is kept so a scenario grown from a real failure report can be added back cheaply.

Prompts are written the way someone would actually ask — lowercase, mid-thought, sometimes with the wrong vocabulary. A prompt that names the right SDK concepts tests nothing, because recognising the request is half the job. They also must not dictate a surface the skill would reject: an earlier version of scenario 1 said "start the export from the main button", and every run duly put a bulk action where the portal puts creation.

Scenario 2 starts from a fixture rather than an empty directory:

- [`fixtures/working-plugin/`](fixtures/working-plugin/) — a small plugin that builds and validates clean, so the eval can ask for a feature to be *added*. Keep it that way: if this one ever stops validating, the scenario is measuring the wrong thing.

## When to run them

**Not once per iteration.** This suite does not make the skill better and it is not what improvement comes from — both of the first two iterations grew the references by reading the portal's own client, and the suite was blind to nearly all of it. What it does is notice when an edit to `SKILL.md` or a reference breaks something that used to work, which nothing else here can: there is no compiler for prose.

So run it the way you run tests: **after a change to the skill, before shipping it.** Once, not in a loop. Re-running an unchanged skill against unchanged fixtures re-measures the same thing and tells you nothing you did not already have.

The one exception is when you want to know how noisy a result is — see the note on samples below.

## Running them

Ask `skill-creator` — it owns the protocol and this directory only supplies the material:

```
run the evals for skills/plugin-sdk, iteration-3
```

It spawns two runs per scenario, saves them under `<workspace>/iteration-N/eval-<id>/{with_skill,without_skill}/`, and opens a viewer over the results.

**Run the prompts verbatim — do not translate them.** Any check that reads chosen words rather than an identifier is written in English only; hand a translated prompt to a run and such a column stops reporting "the run missed this" and starts reporting nothing at all, in every run, which looks identical to a pass being taken away. Iteration-2 was run on translated prompts and three of its report columns measured nothing as a result — the rule stands for any prose check added back later.

Pick `without_skill` for the baseline, not `old_skill`. Two adjacent revisions of the same skill produce nearly identical runs — iteration-1 was graded that way and the two arms differed in a single cell out of a hundred, which is not a result, it is a measurement with no room in it.

Then grade the mechanical half:

```sh
node skills/plugin-sdk/evals/grade.mjs <workspace>/iteration-3
```

[`grade.mjs`](grade.mjs) finds each generated project by looking for a `package.json` with `pluginName` anywhere beneath a run directory, so it does not care whether the run saved its work directly or under `outputs/`. It prints the universal table, a table per scenario that asks for anything beyond it, a summary of the comparison, and writes both `grading.json` and a readable `grading.md` beside the runs.

It is the walk and the write-up; the parts it is made of sit in [`grading/`](grading/), one job each:

| | |
|---|---|
| [`checks.mjs`](grading/checks.mjs) | the three catalogues of checks — **the file to open when adding a scenario** |
| [`verdict.mjs`](grading/verdict.mjs) | how a check answers, and how answers become a score |
| [`source.mjs`](grading/source.mjs) | reading meaning out of TypeScript text, knowing nothing about DocSpace |
| [`run-output.mjs`](grading/run-output.mjs) | what a run left behind: its project, its manifest, its prose |
| [`validator.mjs`](grading/validator.mjs) | invoking `validate-plugin.mjs` and reading its report |
| [`report.mjs`](grading/report.mjs) | tables and the summary |
| [`files.mjs`](grading/files.mjs) | reading files without first asking whether they are there |

### Samples and variance

The model is not deterministic: the same prompt twice gives different runs, so a single changed check may be the model having a different day rather than a regression. The grader says `1 sample` when that is all it has.

To get the spread, give a variant more than one run directory — `with_skill`, `with_skill-2`, `with_skill-3`. The grader groups them, averages the score and prints the range next to it. Worth doing for the one scenario a change was supposed to affect; not worth doing for all three at once.

Two cheaper habits before reaching for a full run. **Baselines are reusable**: the model without the skill does not change when the skill does, so a previous iteration's `without_skill` directories stay valid as long as the prompt and the model are the same — copy them forward instead of re-running, and half the cost disappears. And **run only the scenarios a change could touch**: an edit to `ui-components.md` cannot alter scenario 2's manifest handling. A full three-scenario run belongs before shipping the skill, not after every edit.

## What the grader can and cannot tell you

It decides the questions nobody should answer by hand: did it build, is the archive there, is the SDK the right major, are the keys namespaced, did the report name the defect. It answers four ways, and the last two are not the same thing:

| | |
|---|---|
| `✓` | passed |
| `·` | failed |
| `?` | **unknown** — the check applies here but could not decide. Read the run. A check that is *permanently* unknown is a broken check, not a finding. |
| `–` | **not applicable** — there is nothing here for it to be about, and it is left out of the score. A settings-only plugin registers no items, so "are the item keys namespaced" is not a question about it. |

That distinction is worth the two symbols. Scoring a not-applicable check as a shortfall gives every table a deficit no revision can close, and after a while nobody reads the number.

The summary at the end is the part to read first, because a **tie** is a finding in its own right: if the baseline reached the same score, the passages that scenario exercises are telling the model something it already knew, and the text is a candidate for cutting. A shorter skill is one the model follows more closely.

The checks are text and file-system heuristics. A regex cannot distinguish a correct finding from a lucky word, and it cannot see whether the code is any good. Treat the tables as a filter that tells you which runs to read first — not as a score to optimise. Two habits keep them honest:

- **Anchor a check on an identifier wherever one will do.** A scope name, a field, a file path or a `key:` is the same string in any run; a check that guesses the shape of the code around it is not. `cspDomains lists the tool's origin` matches a manifest field and a literal origin and is solid; `event handler stays inside toasts and updates` greps a handler body and is only as good as the code shapes it guessed.
- **Ask the bundle, not the source, when the report can answer.** `registeredKeysByScope` reads what the built bundle actually registered — a check built on it survives any way the source chose to arrange itself, which no regex does.

## Adding one

The most valuable scenarios come from real failures. When someone reports that the skill produced a plugin that did not work, turn the report into a scenario before fixing anything: watch it fail, fix `SKILL.md`, watch it pass. That defect is then covered permanently, which is not true of a fix applied on its own.

A new scenario needs an entry in `evals.json` with a `name`, a `mode` (`build`, `audit` or `explain`) and its assertions. If some of those assertions can be checked mechanically, [`grading/checks.mjs`](grading/checks.mjs) has three catalogues for them:

- `UNIVERSAL_CHECKS` — asked of every generated project. Only add here what is true of *any* plugin.
- `SCENARIO_CHECKS[<name>]` — what this scenario in particular put under strain. This is where the discriminating assertions belong; the universal set saturates quickly, and a scenario whose interesting half is never automated cannot show a regression in it.
- `REPORT_CHECKS[<name>]` — for `audit` and `explain`, which produce a report rather than a project.

A scenario with no mechanical checks is fine — it is simply graded by reading. Two things to avoid when writing one: a check that cannot resolve on the scenario's own fixture (return `NA`, not `false`), and a heuristic that assumes the shape the code happened to take in one run. Checks added in earlier iterations failed on their first pass for exactly the second reason — a list lifted into a constant, a callback with a return-type annotation containing a brace — which is the normal way this goes. Run the grader over an existing iteration before trusting a new check.

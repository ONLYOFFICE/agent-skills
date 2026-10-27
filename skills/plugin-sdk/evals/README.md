# Evals

A measuring instrument for the skill, not part of it: nothing in `SKILL.md` references this directory and no agent reads it while working.

`test-validator.mjs` proves the validator catches what it should; it says nothing about whether the *instructions* lead an agent to a correct plugin. So each scenario here is run twice — with the skill in context and without — and compared. A check the with-skill run passes and the baseline fails is a passage doing real work; a check **both** pass is a passage that can probably be deleted.

## The scenarios

[`evals.json`](evals.json) holds four: three `build` scenarios, each a multi-scope feature (a run costs ~150k tokens either way, and the interesting failures survive only in a real project), and one `explain` question that costs a few thousand and is graded on the transcript:

| # | Name | Mode | Scopes | What it puts under strain |
|---|---|---|---|---|
| 0 | `sidebar-workspace` | build | ArticleNavigation, Settings, EventListener, ArticleButton | the React half end to end: a `Tabs` page, paged reads through `usePluginAPI` with an `AbortController`, `SearchInput`'s odd `onChange`, a bulk job on the floating operations button (add before update), a settings page that wires its Save through `setSaveButton`, no-argument event handlers, the 32×32 slot, externals and the dark theme |
| 1 | `file-format-and-actions` | build | File, MainButton, ContextMenu | the class-side half meeting React: owning an extension (the dot in the key), a viewer opened from a class-side click that gets **no current file**, writing bytes back through `/files/{id}/update` under `security`, the two context menu items a bulk action needs, the create dialog (which does not append the extension), a people `showSelector` that does not close itself, a modal form with the action row in the body, `cspDomains` |
| 2 | `extend-room-notes` | build | InfoPanel + ProfileMenu or ArticleNavigation (on a live ContextMenu plugin) | a live contract — name, keys, version, the project's own conventions — plus the filter spelling of whichever scope carries the personal view (both spellings side by side when it is ProfileMenu), a tab following `useCurrentFile`, a searchable list that needs room — an aside or a page, never a modal — and no duplicate way in through the profile menu |
| 3 | `explain-filter-and-current-file` | explain | ContextMenu (a question, no project) | the Explain job: the two things nothing but the portal's code can tell you — the per-scope filter spelling and `useCurrentFile()` being `null` in a click-opened modal — asked as a "bug or wrong hook?" question, where the baseline tends to invent a hook or blame the portal |

Three separate build projects rather than one: a build failure darkens every check in a scenario at once, and three keep three independent signals. `API` and `PostMessage` are left out on purpose. The explain scenario is the cheap one to rerun after a change to `SKILL.md`'s Explain section, [portal.md](../references/portal.md) or the item pages in [references/items/](../references/items/common-fields.md); an `audit` scenario (a fixture with planted defects, graded on the findings) is still to be written.

Trigger accuracy of the `description` is a separate instrument: [trigger-tests.md](trigger-tests.md).

Prompts are written the way someone would ask — lowercase, mid-thought, wrong vocabulary — and **never say React, component, hook or UI kit**; recognising the mechanism is the job. They also must not dictate a surface the skill would reject. Scenario 2 starts from [`fixtures/working-plugin/`](fixtures/working-plugin/), a small module plugin that builds and validates clean — keep it that way. A fixture teaches its own conventions (the baseline reads the namespaced key and a `setLanguage` that only records the locale straight out of it), so when adding to that scenario prefer a claim the fixture cannot answer: requests, cancellation, error and empty states, filters on a new scope.

## Running them

After a change to `SKILL.md` or a reference, before shipping — once, not in a loop. Ask `skill-creator`, which owns the protocol:

```
run the evals for skills/plugin-sdk, iteration-0
```

It spawns two runs per scenario under `<workspace>/iteration-N/eval-<id>/{with_skill,without_skill}/`, grades each against the scenario's `assertions` and opens a viewer. Run the prompts **verbatim** — checks that read chosen words are English-only. Use `without_skill` as the baseline, not `old_skill`. The `explain` scenario produces no files: save the final answer as `answer.md` in the run's outputs and grade that.

### Names and versions, so runs can sit on one portal together

The interesting failures only show up on a real portal, and a portal keys an installed plugin by `name` and caches its bundle and icons by `version`. Two runs that pick the same name cannot be installed side by side, and a re-upload that reuses a version serves the old bundle — so the harness fixes both before the run starts:

| | `name` / `pluginName` | `version` |
|---|---|---|
| with-skill run | ends in `-skill` / `Skill` | `<N>.0.0` for iteration N |
| baseline run | no suffix | `<N>.0.0` |

`pluginName` has to stay a JS identifier, so the suffix there is `Skill`, not `-skill`. Both go in the run's instructions, not in the scenario prompt — the prompt is the user's words and stays identical in both arms.

**Scenario 2 is the exception on the name.** It starts from an installed plugin, one assertion pins that the name and `pluginName` survive the change, and the fixture's own item keys are built from the name — renaming it would change what the scenario tests. So its arms are told apart by version alone: set the fixture copy's `version` to `<N>.2.0` before handing it over and let the run bump it as it would anyway. Only one of its two arms can be on a portal at a time.

The model is not deterministic; one run is one sample. For the scenario a change was meant to affect, give a variant several run directories (`with_skill`, `with_skill-2`, …) and compare the spread before reading one changed check as a regression. Baselines are reusable across iterations while the prompt and model are unchanged — copy them forward. Run only the scenarios a change could touch.

## Results

Assertions passed per scenario, in the order of the table above; one sample per arm. A row is a snapshot, not a trend: the assertions and the baseline's docs hint change between rows. The analysis of each run is in its `benchmark.md` under the gitignored `skills/plugin-sdk-workspace/`.

| Date | Model | Scenarios | with_skill | without_skill | Notes |
|---|---|---|---|---|---|
| 2026-09-24 | claude-sonnet-5 | 0–3 | 83/92 (25 · 27 · 25 · 6) | 47/92 (6 · 14 · 22 · 5) | iteration-0, `2eb74a8`; no docs hint, the baseline built on npm's SDK 2.1.1 |
| 2026-10-05 | sonnet, graders sonnet | 0–3 | 87/92 (28 · 27 · 25 · 7) | 70/92 (19 · 21 · 24 · 6) | iteration-2, `82ff8c7`, docs on the stand; the baseline had its `llms.txt`, so scenarios 2 and 3 barely discriminate |
| 2026-10-27 | sonnet, graders sonnet | 0–3 | 88/92 (28 · 26 · 26 · 8) | 66/92 (17 · 18 · 25 · 6) | iteration-5, `36fbfeb`, docs on production; both arms install SDK 3.0.0 and the kit from npm, and a missing `getServerSnapshot` is now a warning, which lets the baseline's scenario 2 pass the validator |

## Adding one

The best scenarios come from real failures: turn the report into a scenario, watch it fail, fix, watch it pass. An entry needs a `name`, a `mode` (`build`, `audit`, `explain`), a prompt written as a person would ask, and assertions a grader can settle by looking at the project — "the File map is keyed by the extension with its leading dot", with the reason in the same sentence where the reason is the point.

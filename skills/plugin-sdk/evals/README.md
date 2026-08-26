# Evals

A measuring instrument for the skill, not part of it: nothing in `SKILL.md` references this directory and no agent reads it while working.

`test-validator.mjs` proves the validator catches what it should; it says nothing about whether the *instructions* lead an agent to a correct plugin. So each scenario here is run twice — with the skill in context and without — and compared. A check the with-skill run passes and the baseline fails is a passage doing real work; a check **both** pass is a passage that can probably be deleted.

## The scenarios

[`evals.json`](evals.json) holds three, all `build`, each a multi-scope feature (a run costs ~150k tokens either way, and the interesting failures survive only in a real project):

| # | Name | Scopes | What it puts under strain |
|---|---|---|---|
| 0 | `sidebar-workspace` | ArticleNavigation, Settings, EventListener, ArticleButton | the React half end to end: a `Tabs` page, paged reads through `usePluginAPI` with an `AbortController`, `SearchInput`'s odd `onChange`, a bulk job on the floating operations button (add before update), a settings page that saves only through `setSaveButton`, no-argument event handlers, the 32×32 slot, externals and the dark theme |
| 1 | `file-format-and-actions` | File, MainButton, ContextMenu | the class-side half meeting React: owning an extension (the dot in the key), a viewer opened from a class-side click that gets **no current file**, writing bytes back through `/files/{id}/update` under `security`, the two context menu items a bulk action needs, the create dialog (which does not append the extension), a people `showSelector` that does not close itself, a modal form with the action row in the body, `cspDomains` |
| 2 | `extend-room-notes` | InfoPanel, ProfileMenu (on a live ContextMenu plugin) | a live contract — name, keys, version, the project's own conventions — plus the two filter spellings side by side, a tab following `useCurrentFile`, a searchable list that belongs in an aside |

Three separate projects rather than one: a build failure darkens every check in a scenario at once, and three keep three independent signals. `API` and `PostMessage` are left out on purpose.

Prompts are written the way someone would ask — lowercase, mid-thought, wrong vocabulary — and **never say React, component, hook or UI kit**; recognising the mechanism is the job. They also must not dictate a surface the skill would reject. Scenario 2 starts from [`fixtures/working-plugin/`](fixtures/working-plugin/), a small module plugin that builds and validates clean — keep it that way. A fixture teaches its own conventions (the baseline reads the namespaced key and the `setLanguage` rebuild straight out of it), so when adding to that scenario prefer a claim the fixture cannot answer: requests, cancellation, error and empty states, filters on a new scope.

## Running them

After a change to `SKILL.md` or a reference, before shipping — once, not in a loop. Ask `skill-creator`, which owns the protocol:

```
run the evals for skills/plugin-sdk, iteration-4
```

It spawns two runs per scenario under `<workspace>/iteration-N/eval-<id>/{with_skill,without_skill}/`, grades each against the scenario's `assertions` and opens a viewer. Run the prompts **verbatim** — checks that read chosen words are English-only. Use `without_skill` as the baseline, not `old_skill`.

The model is not deterministic; one run is one sample. For the scenario a change was meant to affect, give a variant several run directories (`with_skill`, `with_skill-2`, …) and compare the spread before reading one changed check as a regression. Baselines are reusable across iterations while the prompt and model are unchanged — copy them forward. Run only the scenarios a change could touch.

## Adding one

The best scenarios come from real failures: turn the report into a scenario, watch it fail, fix, watch it pass. An entry needs a `name`, a `mode` (`build`, `audit`, `explain`), a prompt written as a person would ask, and assertions a grader can settle by looking at the project — "the File map is keyed by the extension with its leading dot", with the reason in the same sentence where the reason is the point.

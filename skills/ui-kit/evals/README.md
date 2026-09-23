# Evals

A measuring instrument for the skill, not part of it: nothing in `SKILL.md` references this
directory and no agent reads it while working.

`test-validator.mjs` proves `check-usage.mjs` catches what it should; it says nothing about
whether the *instructions* lead an agent to a screen that works. So each scenario here is run
twice — with the skill in context and without — and compared. A check the with-skill run passes
and the baseline fails is a passage doing real work; a check **both** pass is a passage that can
probably be deleted.

## The scenarios

[`evals.json`](evals.json) holds five: three `build` scenarios that extend a real Vite
application, one `explain` question graded on the transcript, and one `audit` of a planted
file.

| # | Name | Mode | What it puts under strain |
|---|---|---|---|
| 0 | `settings-form` | build | The form half end to end: `labelVisible`, the doubled spacing of a gapped column, `TextInput`'s required props, a `Textarea` that will not fill its field, a `ComboBox` whose selection the caller owns, a `ToggleButton` that occupies no space, `tabIndex` on every control, and the label that is associated with nothing |
| 1 | `confirm-dialog` | build | `ModalDialog`: `visible` mounting nothing, the four slots being direct children, the footer as a flex row two `scale` buttons share, and the absent destructive variant — which is `--accent-button` on the button, not on a wrapper and not on the dialog |
| 2 | `side-panel-list` | build | Choosing: `Aside` over a div, plain rows over the portal's `Rows`, `SearchInput`'s string payload and its one-second debounce, skeletons over a bare `Loader`, `EmptyView` over a blank body — and keeping `selectors/*` out |
| 3 | `explain-empty-labels` | explain | The i18n mechanism, from a symptom: which provider, the Map's shape, the `Common` table inside the package, and why the text is empty rather than the raw key |
| 4 | `audit-snippet` | audit | Reading someone else's code: a visibility prop the component ignores, a portal-internal import, `PUBLIC_DIR`, an unnecessary 727 KB stylesheet — and **not** inventing faults or asking for a stylesheet that is not needed |

Three separate build scenarios rather than one: a build failure darkens every check in a
scenario at once, and three keep three independent signals.

Prompts are written the way someone would ask — lowercase, mid-thought, wrong vocabulary — and
**never say component, provider, prop or UI kit**. Recognising the mechanism is the job. They
also never name a component: a prompt that says "use Aside" tests nothing.

Trigger accuracy of the `description` is a separate instrument:
[trigger-tests.md](trigger-tests.md).

## The fixtures

[`fixtures/consumer-app/`](fixtures/consumer-app/) is a bare Vite + React 19 + TypeScript
application with **nothing** from the kit in it — no providers, no components, no stylesheet.
Setting the kit up is part of what every build scenario is graded on. Its own README is the
single place in this repository that says how the kit is installed; the operator populates
`node_modules/` before a run, because an install that fails halfway darkens every check.

[`fixtures/audit-snippet/Panel.tsx`](fixtures/audit-snippet/) compiles and is wrong in eight
ways at once. `node ../../scripts/check-usage.mjs fixtures/audit-snippet` finds all of them,
which is how the fixture is kept honest — but the scenario is graded on the *answer*, not on
the validator's output, and an answer that only pastes the validator's findings has not read
the file.

## Running them

After a change to `SKILL.md` or a reference, before shipping — once, not in a loop. Ask
`skill-creator`, which owns the protocol:

```
run the evals for skills/ui-kit, iteration-0
```

It spawns two runs per scenario under
`<workspace>/iteration-N/eval-<id>/{with_skill,without_skill}/`, grades each against the
scenario's `assertions` and opens a viewer. Run the prompts **verbatim** — checks that read
chosen words are English-only. Use `without_skill` as the baseline, not `old_skill`.

**Give the baseline the documentation.** The kit ships a README for every component inside the
package, so a fair baseline is told they exist:

> The kit's own documentation is in `node_modules/@onlyoffice/apps-ui-kit/` — a `README.md`
> in each `components/<name>/` folder, and the type declarations under `dist/types/`.

Without that line the baseline is being tested on whether it guesses that the READMEs are
there, which is not what the skill is for. With it, the checks that still fail in the baseline
are the ones the skill earns: the prop names, the defaults that are not in the types, the
boundary between public and portal-internal, and the composition traps that no single
component's page states.

The `explain` scenario produces no files: save the final answer as `answer.md` in the run's
outputs and grade that. The `audit` scenario is the same, with the fixture copied in.

The model is not deterministic; one run is one sample. For the scenario a change was meant to
affect, give a variant several run directories (`with_skill`, `with_skill-2`, …) and compare
the spread before reading one changed check as a regression. Baselines are reusable across
iterations while the prompt and the model are unchanged — copy them forward. Run only the
scenarios a change could touch.

**Isolation.** A run must not be able to read this repository: the skill arrives in context or
not at all, and a baseline that finds `SKILL.md` on disk is not a baseline. Check the
transcript for reads outside the project before trusting a result.

## Recorded runs

| Iteration | Date | Model | Scenario | With skill | Baseline |
|---|---|---|---|---|---|
| — | — | — | — | not yet run | — |

## Adding one

The best scenarios come from real failures: turn the report into a scenario, watch it fail,
fix, watch it pass. An entry needs a `name`, a `mode` (`build`, `audit`, `explain`), a prompt
written as a person would ask, and assertions a grader can settle by looking at the result —
"every field carries `labelVisible`, whose default is false, so a container given only
`labelText` renders no label", with the reason in the same sentence where the reason is the
point.

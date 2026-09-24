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
| 0 | `settings-form` | build | The form half end to end: `labelVisible`, the doubled spacing of a gapped column, `TextInput`'s required props, a `Textarea` that will not fill its field and cannot be named from its container, a `ComboBox` whose selection the caller owns, a `ToggleButton` that occupies no space, and tying each caption to its control with `labelFor` |
| 1 | `confirm-dialog` | build | `ModalDialog`: `visible` mounting nothing, the four slots being direct children, the footer as a flex row two `scale` buttons share, and the absent destructive variant — which is `--accent-button` on the button, not on a wrapper and not on the dialog |
| 2 | `side-panel-list` | build | Choosing: `Aside` over a div, plain rows over the portal's `Rows`, `SearchInput`'s string payload and its one-second debounce, skeletons over a bare `Loader`, `EmptyView` over a blank body — and keeping `selectors/*` out |
| 3 | `explain-empty-labels` | explain | The i18n mechanism, from a symptom: which provider, the Map's shape, the `Common` table inside the package, and why the text is empty rather than the raw key |
| 4 | `audit-snippet` | audit | Reading someone else's code: a visibility prop the component ignores, a portal-internal import, `PUBLIC_DIR`, an unnecessary 727 KB stylesheet — and **not** inventing faults or asking for a stylesheet that is not needed |

Three separate build scenarios rather than one: a build failure darkens every check in a
scenario at once, and three keep three independent signals.

**What the assertions aim at, after iteration 0.** The fixture installs the real package, and
the package ships the kit's own READMEs and hand-annotated `.d.ts` — so a baseline that opens
`node_modules` answers every check that restates one component's page. That is the fixture
working as intended, not a flaw to strip out: it is the situation a real reader is in. It does
mean a check phrased as "knows what `labelVisible` defaults to" measures reading, not the
skill. The checks that separate the two arms are the ones no single page can answer: what
happens when components are composed, what the kit gets wrong and how to work around it, what
a prop is *for* rather than what it is called, and whether the thing runs. Each build scenario
therefore ends with a real `tsc --noEmit` and `vite build`, and with `check-usage.mjs` clean of
**warnings** as well as errors — the warning tier is where the difference showed.

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

**Every scenario gets the consumer app**, including `explain` and `audit`: the snippet is
dropped into a copy of it at `fixtures/audit-snippet/Panel.tsx`, and the `explain` question is
asked against a project that has the kit installed. Iteration 0 ran those two without one, so
the baseline had no package to read while the build scenarios' baseline did — the scores were
right but they were not measuring the same thing. With the package present in all five, a
check that still fails in the baseline is one the package's own pages do not answer.

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
| 0 | 2026-09-23 | Opus 5 | `settings-form` | 13/14 | 11/14 |
| 0 | 2026-09-23 | Opus 5 | `confirm-dialog` | 11/11 | 11/11 |
| 0 | 2026-09-23 | Opus 5 | `side-panel-list` | 13/13 | 13/13 |
| 0 | 2026-09-23 | Opus 5 | `explain-empty-labels` | 7/7 | 2/7 |
| 0 | 2026-09-23 | Opus 5 | `audit-snippet` | 9/9 | 4/9 |

| 1 | 2026-09-24 | Opus 5 | `settings-form` | 16/18 | 14/18 |
| 1 | 2026-09-24 | Opus 5 | `confirm-dialog` | 14/14 | 12/14 |
| 1 | 2026-09-24 | Opus 5 | `side-panel-list` | 15/15 | 14/15 |
| 1 | 2026-09-24 | Opus 5 | `explain-empty-labels` | 9/10 | **10/10** |
| 1 | 2026-09-24 | Opus 5 | `audit-snippet` | 13/13 | 10/13 |

Iteration 0 totalled 53/54 against 41/54, at 1.5× the wall clock and 1.3× the tokens. Read it
with the two ties in mind: their checks were answerable from the package's own documentation,
and the graders showed both arms citing it by name. The run earned three things regardless —
the `explain` and `audit` scenarios, where there is no project to read from; zero invented
findings against the baseline's five; and two real defects in the kit — which were recorded in
its `docs/known-defects.md`, and have since been fixed and that file removed — plus one in
`check-usage.mjs`. The assertions were rewritten afterwards to aim at composition, workarounds
and a real build.

Iteration 1 totalled 67/70 against 60/70 — a smaller margin than iteration 0's, and the
truer one: the baseline now has the package in all five scenarios, and the package's own
pages answer most of what a single component does. **The baseline won `explain-empty-labels`,
10/10 to 9/10.** What the skill still earns is composition and discipline — the failure path
of a dialog, colours declared for both themes, a panel laid out so its last row is reachable,
a review that stays inside the file it was given and says what it checked against. Five runs
were made rather than ten; `PROVENANCE.md` in the workspace says which and why.

The run's real yield was three corrections it forced, each verified against the kit's source
rather than argued: `Textarea` cannot be widened through `style` (it lands on the inner
scroller; `wrapperClassName` is the only way in); an empty toast title renders **no element**,
so there is no gap to see; and `Dropzone` translates nothing — eleven components do, and it is
not one of them. All three were wrong in the skill *and* in the kit's own pages, which is the
argument for running this at all.

## Adding one

The best scenarios come from real failures: turn the report into a scenario, watch it fail,
fix, watch it pass. An entry needs a `name`, a `mode` (`build`, `audit`, `explain`), a prompt
written as a person would ask, and assertions a grader can settle by looking at the result —
"every field carries `labelVisible`, whose default is false, so a container given only
`labelText` renders no label", with the reason in the same sentence where the reason is the
point.

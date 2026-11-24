# Evals

A measuring instrument for the skill, not part of it: nothing in `SKILL.md` references this directory and no agent reads it while working.

An editor plugin fails without an error - a click that never arrives, a command that reads `undefined`, a page that is blank once installed. "Does it load" proves little, so each scenario runs twice, with the skill in context and without, and the two are compared. A check the with-skill run passes and the baseline fails is a passage doing work; a check both pass is a passage that can probably go.

## The scenarios

[`evals.json`](evals.json):

| # | Name | Mode | SKILL.md rules under strain |
|---|---|---|---|
| 0 | `build-context-menu-action` | build | events and the click router, answering every `onContextMenuShow`, the `{ guid, items }` shape, absolute `plugins.js`, `"type"` from 8.1.0, the type setup with `moduleResolution`, running the validator |
| 1 | `audit-ticket-helper` | audit | every core rule at once, read from symptoms; plus the review discipline - one correct file left alone, no rewrite |
| 2 | `explain-command-scope` | explain | a command is source text, `Asc.scope` copied at the call, one `callCommand` in flight |

Every core rule in `SKILL.md` has at least one assertion behind it:

| Core rule | Scenario |
|---|---|
| A command is source text, not a closure; `Asc.scope` copied at the call; plain data only | 1, 2 |
| One `callCommand` at a time | 1, 2 |
| An event reaches the plugin only if the editor knows it listens; the click router | 0, 1 |
| Answer every `onContextMenuShow`; one object `{ guid, items }` | 0, 1 |
| `AddToolbarMenuItem` takes one object `{ guid, tabs }` | 1 |
| Absolute `plugins.js` | 0, 1 |
| `"type"` read from 8.1.0 | 0, 1 |
| Check the edition | 1 |
| `initOnSelectionChanged` on a selection, not on clearing | 1 |
| Type setup with `module`/`moduleResolution` | 0 |

Prompts are written the way someone would ask - lowercase, symptom first - and **never name the mechanism**: no `onContextMenuClick`, no `Asc.scope` in the build prompt, no "events array". What a real user names is fair game (the editor, the versions, VS Code).

Scenario 1 starts from [`fixtures/broken-plugin/`](fixtures/broken-plugin/), a small plugin with a page of team notes. Planted, one per note: the relative `plugins.js`; `"type": "panelRight"` without the flags and with `minVersion` 7.4.0; `onContextMenuClick` undeclared **and** an `attachEditorEvent("onContextMenuClick")` that replaces the router; an `onContextMenuShow` handler that returns early; `PREFIX` read inside a command and `Asc.scope.text` assigned after the call; two commands in flight; an `Api` object returned; `AddToolbarMenuItem` with `[[...]]` and `onToolbarMenuClick` undeclared; `initOnSelectionChanged` expected to fire on clearing; `AnnotateParagraph` on a Community Edition server. `settings.html` and `scripts/settings.js` are **deliberately correct** - an assertion pins that the review does not report them; keep them correct when editing the fixture. The icons are real, plain PNGs of the sizes the config names (28 and 56 px): a text placeholder with a `.png` name would itself be a fault a careful reviewer reports, and the scenario would then count a true finding against the run.

Everything is static: no Document Server is needed, and nothing here proves a plugin runs in a live editor - only that it obeys what the live editor enforces. `node ../scripts/validate-plugin.mjs fixtures/broken-plugin` shows which planted faults are mechanical (five errors, two warnings); the rest are for the agent to find.

## Running them

As for the sibling skills: after a change to `SKILL.md` or a reference, before shipping - once, not in a loop. Ask `skill-creator`:

```
run the evals for skills/doceditor-plugins, iteration-1
```

Run the prompts **verbatim**; use `without_skill` as the baseline. Hand the fixture of scenario 1 over as a **copy** in a directory away from this repository - a baseline given a path into `skills/doceditor-plugins/evals/` is one `cd ..` from `SKILL.md`. Audit afterwards that the baseline never read `agent-skills`, `SKILL.md` or `references/`.

## Adding one

The best scenarios are real failures: turn the report into a scenario, watch it fail, fix the skill, watch it pass. An entry needs a `name`, a `mode` (`build`, `audit`, `explain`), a prompt that withholds the mechanism, and assertions a grader can settle by reading the output, with the reason in the same sentence where the reason is the point.

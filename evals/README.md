# Plugin evals (`claude plugin eval`)

The suite `claude plugin eval` runs against this plugin: one directory per case with a `prompt.md`
(the request, phrased as a user would type it, plus run limits in its front matter) and one
grader per file under `graders/`. Each case has a grader on the result (a `regex` over a produced
file or the final message, or an `llm` rubric written as PASS/FAIL conditions for short answers)
and a grader on the steps (`tool_used: Skill` for the skill that should fire, `tool_used: Bash`
for the validator the skill makes the agent run). The tool compares every case with a no-plugin
baseline and reports the delta; graders that only make sense with the plugin (`tool_used: Skill`,
`arm: with-only`) are reported but not scored.

The per-skill `skills/<name>/evals/` directories keep the skill-creator protocol (`evals.json`, the
G1 rubric, the trigger tests); the two tools read different files and do not conflict. Results
land in `evals/results/` (gitignored).

## Cases

| Tag | Cases | What they measure |
|---|---|---|
| `question` | `embed-2fa-question`, `embed-csp-allowlist-verb`, `embed-theme-switch`, `embed-public-room-events`, `plugin-explain-filter` | Facts the skills carry and the docs do not: the CSP verb, `theme` read once, the public-room events, the `usersTypes` asymmetry, the two-factor flow. Cheap: one short answer per run |
| `trigger` | `no-trigger-editor-plugin` | Neither skill fires on a Document Server editor-plugin task (`min: 0, max: 0`, scored in both arms) |
| `build` | `embed-public-room-viewer`, `embed-select-then-upload` | Small integrations with fixed file names, graded by `regex` over those files, plus the validator run and a REPORT.md rubric |
| `build`, `heavy` | `embed-employee-cabinet`, `plugin-sidebar-workspace` | A full React connector and a full plugin build (npm install, Vite, `validate-plugin.mjs`); long and costly, run on demand |

## Running

```sh
claude plugin eval . --tag question --tag trigger --runs 1 --ablation none   # smoke: format and graders, ~6 short runs
claude plugin eval . --tag question --tag trigger                             # the cheap suite, 3 runs per arm
claude plugin eval . --tag build --allow-tools Write Edit Bash WebFetch       # builds need the write and shell grants
claude plugin eval . --json evals/results/last.json --threshold 0.8 --trust-plugin --no-publish --max-cost-usd 20
```

Build cases write files, so they need `--allow-tools Write Edit Bash` (and `WebFetch` for the docs);
without the grant the progress output lists the tools as `not granted` and the run scores low.
The `heavy` cases install packages from npm and build with Vite; run them with `--tag heavy` when
the network allows it and budget an hour.

For a rubric the small default judge disagrees with, re-run with `--judge-model sonnet` before
touching the plugin: a `tool_used: Skill` that passes with a negative delta usually means the
judge, not the skill. A case that scores the same in both arms on every model measures nothing
and should be sharpened or dropped.

## Adding a case

Turn a real failure into a case: the prompt as the user wrote it, one grader on the result, one
on the steps, run limits generous enough for the task (`max_turns`, `timeout_seconds`). Fix the
file names in the prompt when the graders read files; the run starts in an empty workspace.

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
| `question` | `embed-2fa-question`, `embed-csp-allowlist-verb`, `embed-theme-switch`, `embed-public-room-events`, `plugin-explain-filter`, `ui-kit-explain-aside-prop` | Facts the skills carry and the docs do not: the CSP verb, `theme` read once, the public-room events, the `usersTypes` asymmetry, the two-factor flow — and, for the kit, that the answer is read from the component's page and names it. Cheap: one short answer per run |
| `trigger` | `no-trigger-editor-plugin` | None of the three skills fires on a Document Server editor-plugin task (`min: 0, max: 0`, scored in both arms) |
| `build` | `embed-public-room-viewer`, `embed-select-then-upload` | Small integrations with fixed file names, graded by `regex` over those files, plus the validator run and a REPORT.md rubric |
| `build`, `heavy` | `embed-employee-cabinet`, `plugin-sidebar-workspace` | A full React connector and a full plugin build (npm install, Vite, `validate-plugin.mjs`); long and costly, run on demand |

## Running

```sh
claude plugin eval . --tag question --tag trigger --runs 1 --ablation none --allow-tools WebFetch   # smoke: format and graders, ~6 short runs
claude plugin eval . --tag question --tag trigger --allow-tools WebFetch                             # the cheap suite, 3 runs per arm
claude plugin eval . --tag build --allow-tools Write Edit Bash WebFetch       # builds need the write and shell grants
claude plugin eval . --json evals/results/last.json --threshold 0.8 --trust-plugin --no-publish --max-cost-usd 20
```

Build cases write files, so they need `--allow-tools Write Edit Bash` (and `WebFetch` for the docs);
without the grant the progress output lists the tools as `not granted` and the run scores low.
The `heavy` cases install packages from npm and build with Vite; run them with `--tag heavy` when
the network allows it and budget an hour.

**A shell grant needs a sandbox backend.** On Windows the tool refuses a run with `Bash` granted
("sandbox required but unavailable"), so the build cases run there with `--allow-tools Write Edit`
only: the file graders still work, the `config-validated` / `validated-against-loader` graders
(the validator the skill makes the agent run) fail, and the `heavy` cases cannot build at all.
Run the full build suite on Linux or macOS — the CI runner — where the shell is confined.
A refused run leaves its temp directory behind and prints the command to remove it.

For a rubric the small default judge disagrees with, re-run with `--judge-model sonnet` before
touching the plugin: a `tool_used: Skill` that passes with a negative delta usually means the
judge, not the skill. A case that scores the same in both arms on every model measures nothing
and should be sharpened or dropped.

## Results

| Date | Model | Cases | with | without | Δ | Notes |
|---|---|---|---|---|---|---|
| 2026-09-28 | default (sonnet), judge default | `question` + `trigger`, 3 runs per arm | 6/6 at 1.00 | 2fa 0.00 · public-room-events 0.50 · explain-filter 0.60 · csp-verb 1.00 · theme-switch 1.00 | mean 0.32 | $4.23, 18 min. The 2FA flow, the public-room events and the `usersTypes` asymmetry are knowledge the model lacks without the skill; the CSP verb and the theme reload it answers on its own, so those two cases are regression guards, not discriminators |
| 2026-09-28 | default (sonnet) | `embed-select-then-upload`, 1 run, `--allow-tools Write Edit`, no baseline | 0.92 | — | — | every file grader passed; `config-validated` cannot pass without a shell grant (Windows) |
| 2026-10-02 | sonnet, judge sonnet | `question` + `trigger`, 3 runs per arm, `-j 2`, `--allow-tools WebFetch`; `apiSite` pointed at the stand for the run, since production had no UI kit section yet | 4/7 passed, 0.91 overall: 2fa 1.00 · csp-verb 0.93 · public-room-events 0.67 · theme-switch 1.00 · no-trigger 1.00 · explain-filter 1.00 · ui-kit-aside 0.75 | 2fa 0.00 · csp-verb 0.80 · public-room-events 0.33 · theme-switch 1.00 · no-trigger 1.00 · explain-filter 0.20 · ui-kit-aside 0.33 | mean 0.38 | $3.33, 9 min. A with-arm answer costs $0.05–0.12, a baseline $0.04–0.14. The sonnet judge is stricter than haiku on the two embed cases: `public-room-events` on the revoked-link answer, `csp-verb` on one run that admitted not knowing the POST body. `ui-kit-aside`: two runs fetched the component pages and named them, one answered from rule 4 without fetching and failed both source graders, which is what the case is for; the baseline wandered, 14 turns and 53 s against 6 and 26 |
| 2026-10-23 | sonnet, judge sonnet | `question` + `trigger`, 3 runs per arm, `-j 2`, `--allow-tools WebFetch`; every link on production for the first time | 3/7 passed at the tool's default threshold of 1, 0.84 overall: 2fa 0.83 · csp-verb 1.00 · public-room-events 0.67 · theme-switch 1.00 · no-trigger 1.00 · explain-filter 0.73 · ui-kit-aside 0.67 | 2fa 0.00 · csp-verb 0.67 · public-room-events 0.50 · theme-switch 0.89 · no-trigger 1.00 · explain-filter 0.20 · ui-kit-aside 0.33 | mean 0.33 | $3.03, 10 min. Three with-arm misses were the instrument, not the skill: `explain-filter`'s rubric demanded the full list of eight scopes for a question about one and read the SDK 3 `UserRole` advice as an invention; `2fa`'s regex rejected `code || undefined` as the fifth argument; `public-room-events`' rubric did not know `onFilterSearch`, `onContentReady` and `onAppError`, which the page does send. One `ui-kit-aside` run answered from rule 4 without reading the page and named no source, the case's own failure mode; it also noticed that step 0 of the skill still said 4.0.0. Graders and step 0 corrected, rerun below |
| 2026-10-23 | sonnet, judge sonnet | the same, after the grader fixes and the apps-ui-kit step-0 change; `--threshold 0.8` | 7/7 passed, 0.97 overall: 2fa 1.00 · csp-verb 0.93 · public-room-events 0.83 · theme-switch 1.00 · no-trigger 1.00 · explain-filter 1.00 · ui-kit-aside 1.00 | 2fa 0.00 · csp-verb 0.87 · public-room-events 0.50 · theme-switch 0.33 · no-trigger 1.00 · explain-filter 0.33 · ui-kit-aside 0.33 | mean 0.49 | $2.77, 9 min. The release run for 0.1.0. `ui-kit-aside` read the component page in all three runs. The two remaining with-arm misses are the judge: one `csp-verb` answer named neither the portal UI nor the frame-ancestors consequence, and one `public-room-events` answer split the votes 1–2 while listing exactly the events the reference lists |
| 2026-10-28 | sonnet, judge sonnet | the same, after the rename of the skills to `apps-embed-sdk`, `apps-plugin-sdk` and `apps-ui-kit`; the tool's default threshold | 5/7 passed at the default threshold of 1, 6/7 at 0.8, 0.94 overall: 2fa 1.00 · csp-verb 1.00 · public-room-events 0.83 · theme-switch 1.00 · no-trigger 1.00 · explain-filter 0.73 · ui-kit-aside 1.00 | 2fa 0.00 · csp-verb 0.53 · public-room-events 0.50 · theme-switch 0.89 · no-trigger 1.00 · explain-filter 0.33 · ui-kit-aside 0.33 | mean 0.43 | $2.82, 17 min, part of it alongside the trigger runs. What the run is for: every `skill-fired` grader matched the new names in all 21 with-arm runs, and `no-docspace-skill` passed in all three. The three misses are the `criteria` judge: two `explain-filter` answers that name `usersTypes`, `UserRole` and the roles to list, and one `public-room-events` answer listing exactly the events the reference lists, as on 2026-10-23 |

## Adding a case

Turn a real failure into a case: the prompt as the user wrote it, one grader on the result, one
on the steps, run limits generous enough for the task (`max_turns`, `timeout_seconds`). Fix the
file names in the prompt when the graders read files; the run starts in an empty workspace.

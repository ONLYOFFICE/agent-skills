# Evaluating the embed-sdk skill: with vs. without

An A/B protocol that measures what the skill changes. The same task prompt is given to the
same model twice — once with the skill installed, once without it but with the documentation —
and both results are graded against the same expectations.

## Files

| File | Purpose |
|---|---|
| [evals.json](evals.json) | The scenario set in skill-creator format: E1–E3 from the internal testing plan, F1–F4 rebuilt from real failures (2FA question, cross-origin todo app, workspace with chat under OAuth, Next.js form intake), and G1, the original admin-panel task. Each has a prompt, an `expected_output` and `expectations`: strings prefixed `[C]` (critical, weight 2 — a silent breakage) or `[Q]` (quality, weight 1), ending in a `(how: …)` hint for the grader |
| [trigger-tests.md](trigger-tests.md) | 10 messages that must trigger the skill and 10 that must not; results table |
| [prompt.txt](prompt.txt) | The G1 task, copy-paste-ready (replace `{…}` placeholders first) |
| [task.md](task.md) | Operator guide for G1: annotated prompt + operator answers + the trap map (never show to the agent) |
| [rubric.md](rubric.md) | G1's 39 graded checkpoints mapped to SKILL.md rules, with grep hints |

## Running the scenario set

Ask `skill-creator`, which owns the mechanics ("run the evals for skills/embed-sdk on sonnet"),
or follow the same steps by hand:

1. One scenario is one prompt run twice, in fresh directories, in the same turn. **with_skill**:
   the skill directory is named, the agent may read it and run its scripts. **without_skill**:
   no skill; the prompt plus the `docs_hint` line from `evals.json` — the honest comparison is
   against an agent that has the documentation, not against one that has nothing.
2. Fill the placeholders (`{PORTAL_URL}`, `{ROOM_ID}`, `{FORMS_ROOM_ID}`, `{AGENT_ID}`) identically
   in both arms. A fictional portal is fine for static grading; the agent then cannot probe it, and
   the expectations about version handling test what it does with that.
3. Put the `operator_answers` into the prompt as facts the customer would give if asked; a
   subagent cannot ask. Same text in both arms.
4. **Isolation.** The run directory is the agent's whole workspace. The with_skill agent reads the
   skill directory and nothing else outside; it must never read `evals/` — `evals.json` is its own
   answer key, and a run that read it is discarded. The without_skill agent reads nothing outside
   its directory but the documentation site. Ask each run to end with a "Sources" section listing
   every file read outside its directory and every URL fetched, and check it.
5. Grade every expectation from the code, not from the report's prose: `[C]` = 2 points, `[Q]` = 1.
   F1 is a question — grade `answer.md`. G1 is graded by `rubric.md`.
6. Record tokens and wall time from the task notifications; compare by errors first. On strong
   models the arms cost about the same.

The model is not deterministic; one run is one sample. For the scenario a change was meant to
affect, run two or three samples before reading one changed check as a regression. Baseline
outputs are reusable while the prompt and model are unchanged: after a change to the
expectations only, regrade them instead of rerunning.

Turn every new failure from the testing log into a scenario here before fixing the skill: watch
it fail, fix, watch it pass. A check both arms pass on every model is a passage doing no work.

## Verification stages for G1

Grade G1 through four gates, in order. Stages A–C need no portal.

**Gate A — Discovery behavior (before any code).** Did the agent establish the portal's SDK
version before writing integration code? Did it react to the 2.0.0-vs-portal version conflict
planted in the task (the AI-chat requirement does not exist in SDK 2.0.0)?

**Gate B — Static code review.** Go through [rubric.md](rubric.md) top to bottom; most checkpoints
have a grep hint.

**Gate C — Config validation.** Extract every `TFrameConfig` the agent produced into JSON and run
each through `node scripts/validate-config.mjs '<json>'`. Score: configs with 0 errors.

**Gate D — Live smoke test (optional, needs a real portal).** Allow-list the dev origin, `npm run
dev`: manager renders; StrictMode double-mount does not break the frame; room selector returns an
id; clicking a file opens the in-app editor; a wrong password yields a graceful error.

## Results

| Date | Model | Scenarios | with_skill | without_skill | Notes |
|---|---|---|---|---|---|
| 2026-09-17 | claude-sonnet-5 | E1–E3, F1–F4, 1 sample each | 62/73 weighted (83% of checks) | 39/73 weighted (47%) | Documentation = local build of the 2.2.0 site. Critical failures 4 vs 12. F4 with_skill had read `evals.json` and is discounted. Expectations were rewritten afterwards (E1, F1, F3, F4); baselines to be regraded |
| 2026-09-17 | claude-sonnet-5 | E1–E3, F1–F4, 1 sample each | 87/89 weighted (97% of checks) | 59/89 weighted (60%) | Iteration 2: with_skill rerun after the wave-2 text, baselines regraded against the final expectations (composite ones split, OAuth state/PKCE and CSP checks added). Critical failures 0 vs 10. No with_skill run read `evals/` |

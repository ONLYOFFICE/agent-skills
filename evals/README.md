# Evaluating the embed-sdk skill: with vs. without

An A/B protocol that demonstrates what the skill changes. The same task prompt is given to
the same model twice — once in a clean session without the skill, once with it — and both
results are graded against the same rubric.

## Files

| File | Purpose |
|---|---|
| [prompt.txt](prompt.txt) | The exact text to paste as the first message (replace `{…}` placeholders first) |
| [task.md](task.md) | Operator guide: the same prompt annotated + operator answers + the trap map (never show to the agent) |
| [rubric.md](rubric.md) | 39 graded checkpoints mapped to SKILL.md rules, with grep hints |

## Setup

Two empty directories, identical machine/model/settings:

```
mkdir demo-baseline demo-skill
```

**Run A — baseline (no skill):**

```
cd demo-baseline
claude            # plain session, no plugin
# paste the prepared prompt.txt (placeholders filled) as the first message
```

**Run B — with the skill:**

```
cd demo-skill
claude --plugin-dir /path/to/agent-skills
# paste the SAME prepared prompt.txt
```

Fair-test rules:

- **Isolation**: create the run directories away from any workspace that contains this
  skill repo, the SDK sources, its `specs/`, or sample integrations — an exploring agent
  WILL read sibling directories (observed in practice: a baseline found the skill next
  door and used its validator and rules, invalidating the run). Also scope the agent
  explicitly: "treat this directory as your entire workspace; do not read outside it".
- **Contamination audit after each run** (a baseline that touched the skill, `specs/` or
  `evals/` is invalid): grep the session transcript for the skills repo (`agent-skills`),
  `SKILL.md`, `specs/`, `evals/` if a transcript is available; if not (some harnesses
  don't persist subagent transcripts), ask the agent directly to enumerate every file
  it accessed outside its working directory — its context is intact and the final
  report often self-reports the sources it used.
- Same model and effort settings in both runs; fresh session each (no history).
- Do not mention the skill, DocSpace docs, or any hints in the prompt — task.md only.
- Answer the agent's questions identically in both runs (see "operator answers" in
  task.md). If the baseline never asks, that is itself a scored observation.
- Fill `{PORTAL_URL}` in task.md with a real test portal if you want the live stage
  (D below); any https URL works for static grading.

## Verification stages

Grade each run through four gates, in order. Stages A–C need no portal.

**Gate A — Discovery behavior (before any code).**
Did the agent ask which portal / establish the portal's SDK version before writing
integration code? Did it react to the 2.0.0-vs-portal version conflict planted in the
task (the AI-chat requirement does not exist in SDK 2.0.0)? Record: questions asked,
connection method chosen (npm / portal IIFE / hybrid).

**Gate B — Static code review.**
Go through [rubric.md](rubric.md) top to bottom. Each checkpoint has a grep hint —
most can be checked mechanically. Fill the score column for both runs.

**Gate C — Config validation.**
Extract every `TFrameConfig` object the agent produced (manager, selector, editor,
system, forms/uploader) into JSON and run each through the validator:

```
node <skill>/scripts/validate-config.mjs '<json>'
```

Score: number of configs passing with 0 errors.

**Gate D — Live smoke test (optional, needs a real portal).**
1. Add the dev origin to the portal CSP allowlist (the agent should have told you to —
   that instruction is itself a rubric item).
2. `npm run dev`, open the app: manager renders; StrictMode double-mount does not
   duplicate/break the frame; room selector returns an id; clicking a file opens the
   in-app editor; login flow works with a wrong password (graceful error, because
   `login()` resolves with `status !== 200`).

## Scoring

Rubric checkpoints are weighted: **critical = 2 points** (violations produce silently
broken integrations), **quality = 1 point**. Sum per run; report as
`score / max` plus the Gate A narrative. A useful demo artifact is the diff table:
checkpoint × (baseline, skill) with one-line evidence quotes.

## Expected divergence (what the demo typically shows)

| Behavior | Baseline (typical) | With skill (expected) |
|---|---|---|
| Portal discovery | starts coding immediately | asks portal URL/version, probes `/static/scripts/sdk/{v}/api.js` |
| Version conflict (npm 2.0.0 vs chat requirement) | writes `initChat` against 2.0.0 (does not exist) | flags conflict; portal IIFE or unpin, npm kept for types |
| `sortBy` | `"Name"` (silently unsorted) | `"AZ"` / enum constant |
| `login()` result | assumes resolve = success | checks `response.status !== 200` |
| Selector payload | treats room payload as object | `items[0].id`, `.requestTokens[0].requestToken` |
| Programmatic upload | calls `upload()` on manager/uploader frame | Forms frame, or Uploader UI, with explanation |
| StrictMode | double init breaks frame in dev | ref-guard or documented StrictMode handling |
| CSP | not mentioned; or `checkCSP: false` "fix" | tells operator to allow-list the dev origin |

Baseline runs are not always this weak — grade honestly; the rubric, not the table above,
is the source of truth.

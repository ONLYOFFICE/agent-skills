# Contributing

What a skill in this repository must consist of, and how a change to one is judged.
Release mechanics — versions, names, publishing — are in [RELEASING.md](RELEASING.md).

## One skill per SDK

Every skill lives in `skills/<name>/` and describes one ONLYOFFICE SDK or tool. `<name>`
is kebab-case and equals the `name` in the skill's frontmatter. There is one plugin,
`onlyoffice`, for the whole repository; a new SDK is a new skill directory plus one row in
the README table, nothing else.

## What a skill directory contains

| Path | Required | What it is |
|---|---|---|
| `SKILL.md` | yes | The skill. Frontmatter: `name`, `description`, `license`, `metadata.author`, `metadata.sdk-version`. The body is a **router**: pinned facts, a discovery step, a routing table into `references/`, and the critical rules — the things an agent gets wrong without being told. It is loaded whole on every trigger, so it stays short; detail goes in a reference. |
| `README.md` | yes | For people: what the skill does, how to install it alone, what it targets, how to maintain it. Nothing in `SKILL.md` links to it. |
| `references/` | yes | The knowledge base, one topic per file, loaded on demand. The place for "what the portal/SDK actually does" — tables, payload shapes, recipes, pitfalls. |
| `evals/` | yes | The measuring instrument — see below. Not read by agents. |
| `scripts/` | if useful | Tools an agent runs: validators, generators, probes. Every validator ships with a `test-validator.mjs` that exercises it against known-good and known-bad input and exits non-zero on a mismatch — the validator is what makes a rule mechanical, so it must not silently rot. Node only, no dependencies. No network, with one exception: a script named `probe-*.mjs` may query the portal or site the user named, reads only, and never runs from the self-test. (The repository-internal `.claude/skills/onlyoffice-docs/scripts/docs.mjs` reads the docs site for the people writing references; it is not part of a shipped skill.) |
| `sources.json` | yes | The skill's external sources: the SDK version it targets (omitted by a skill that pins none), which of the hosts declared in the root `sources.json` it links to and at which paths, and the placeholder hosts of its examples. A new site is a new host at the root first; a host named `<name>Fallback` there (`apiSiteFallback`, the docs stand) is a stand-in, never a link base — `--verify --fallback` and the internal `onlyoffice-docs` script read from it when the primary host has no page. `node tools/sync-sources.mjs --check` fails when a link or a pinned version is not traceable to it — see `.claude/skills/sync-sources/SKILL.md` for moving a skill to another site or SDK release. |
| `templates/`, `vendor/` | if needed | Files a generator copies into a project. |

Content language is English throughout: models read it.

The `description` in the frontmatter is what decides whether the skill triggers. Write it
as the situations a user is in — including the ones where they describe a feature without
naming the SDK — not as a summary of the contents.

## What a reference says

A reference describes the SDK **as it runs**, not as its type definitions compile: a field
the types accept but the portal ignores is documented as ignored. Every claim an agent
would act on is checked against the SDK source or a live portal before it is written, and
a correction commit names what was checked ("Correct eight reference claims against the
4.0 client"). Where the rule exists because of a silent failure, say what the failure looks
like — a blank page, an unsorted list, an item that never appears — so the agent can
recognise it when debugging.

## Evals decide

Two suites, one idea: the same task given to the same model with and without the skill,
graded against the same checks. A check that passes only with the skill is a passage doing
work; a check both runs pass is a passage that can probably go.

- `evals/` at the plugin root is the suite `claude plugin eval` runs: one directory per case
  with a `prompt.md` and one grader per file (`regex` over a produced file or the answer,
  `tool_used: Skill` for the skill that should fire, an `llm` rubric for short answers). It
  runs unattended and compares against a no-plugin baseline — [evals/README.md](evals/README.md).
- `skills/<name>/evals/` keeps the skill-creator protocol (`evals.json`, the long A/B
  scenarios, the G1 rubric, the trigger tests) for hand-graded iteration inside a session —
  each skill's `evals/README.md`.

Run the plugin suite's cheap cases (`--tag question --tag trigger`) after every content
change and the build cases before a release — the commands, costs and platform limits are in
[TESTING.md](TESTING.md). The best new case is a real failure turned into a check: watch it
fail, fix the skill, watch it pass.

Feedback from testing (the internal testing log, issues, a reflection somebody wrote after a
session) is an input to this loop, not a note to file: every remark becomes either a new
case or grader in `evals/`, a new rule or reference passage in the skill, or is closed
with a comment saying why not. A remark that only changes prose without a check behind it
tends to be lost on the next rewrite.

## Before opening a pull request

```
claude plugin validate . --strict                              # the marketplace manifest, and only that
claude plugin validate skills --strict                         # the SKILL.md files; the line above never reads them
node skills/<name>/scripts/test-validator.mjs                  # for every skill that has a validator
node .claude/skills/onlyoffice-docs/scripts/test-docs.mjs      # the internal docs script's parsers
node tools/sync-sources.mjs --check                            # every link and pinned version traces to sources.json
node tools/sync-ui-kit.mjs --from <kit> --check                # the ui-kit manifest matches the kit (a checkout or an installed package)
```

For a content change, also the cheap behaviour suite — [TESTING.md](TESTING.md) has the full
protocol and what each result means.

Commit messages say what changed and why in one line, in the imperative, without a type
prefix ("Warn that FieldContainer's own margin doubles against a column gap").

Do not add `Co-Authored-By` trailers or any other AI-attribution lines to commit messages
or pull request descriptions. Same rule as `docspace-ui-kit-react` and the DocSpace client.

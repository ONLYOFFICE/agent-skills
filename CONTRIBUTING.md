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
| `scripts/` | if useful | Offline tools an agent runs: validators, generators. Every validator ships with a `test-validator.mjs` that exercises it against known-good and known-bad input and exits non-zero on a mismatch — the validator is what makes a rule mechanical, so it must not silently rot. Node only, no dependencies, no network. |
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

Each skill carries its own `evals/`: the same task given to the same model with and
without the skill, graded against the same checks. A check that passes only with the skill
is a passage doing work; a check both runs pass is a passage that can probably go. Run the
evals of the skill you changed after the last content change, once — the protocol is in
each skill's `evals/README.md`. The best new scenario is a real failure turned into a
check: watch it fail, fix the skill, watch it pass.

## Before opening a pull request

```
claude plugin validate . --strict
node skills/<name>/scripts/test-validator.mjs   # for every skill that has a validator
```

Commit messages say what changed and why in one line, in the imperative, without a type
prefix ("Warn that FieldContainer's own margin doubles against a column gap").

Do not add `Co-Authored-By` trailers or any other AI-attribution lines to commit messages
or pull request descriptions. Same rule as `docspace-ui-kit-react` and the DocSpace client.


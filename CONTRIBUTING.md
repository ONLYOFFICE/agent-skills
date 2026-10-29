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
| `README.md` | yes | For a person deciding whether to use the skill: what it does, what to ask for, the scripts it carries, what it targets — one screen. How the skill is maintained goes in `scripts/README.md` and `evals/README.md`, not here. Nothing in `SKILL.md` links to it. |
| `references/` | yes | The knowledge base, one topic per file, loaded on demand. The place for "what the portal/SDK actually does" — tables, payload shapes, recipes, pitfalls. |
| `evals/` | yes | The measuring instrument — see below. Not read by agents. |
| `scripts/` | if useful | Tools an agent runs: validators, generators, probes. Every validator ships with a `test-validator.mjs` that exercises it against known-good and known-bad input and exits non-zero on a mismatch — the validator is what makes a rule mechanical, so it must not silently rot. Node only, no dependencies. No network, with one exception: a script named `probe-*.mjs` may query the portal or site the user named, reads only, and never runs from the self-test. A `README.md` here says what each script checks and how it is kept in step with the SDK. (The repository-internal `.claude/skills/onlyoffice-docs/scripts/docs.mjs` reads the docs site for the people writing references; it is not part of a shipped skill.) |
| `sources.json` | yes | The skill's external sources: the SDK version it targets (omitted by a skill that pins none), which of the hosts declared in the root `sources.json` it links to and at which paths, and the placeholder hosts of its examples. A new site is a new host at the root first; a host named `<name>Fallback` there (`apiSiteFallback`, the docs stand) is a stand-in, never a link base — `--verify --fallback` and the internal `onlyoffice-docs` script read from it when the primary host has no page. `node tools/sync-sources.mjs --check` fails when a link or a pinned version is not traceable to it — see `.claude/skills/sync-sources/SKILL.md` for moving a skill to another site or SDK release. |
| `templates/` | if needed | Files a generator copies into a project. |

Content language is English throughout: models read it.

The `description` in the frontmatter is what decides whether the skill triggers. Write it
as the situations a user is in — including the ones where they describe a feature without
naming the SDK — not as a summary of the contents.

## Layout of the repository

```
.claude-plugin/          plugin + marketplace manifests
.claude/skills/          repository-internal skills, not shipped in the plugin:
                         sync-sources (links and versions), sync-ui-kit (the apps-ui-kit manifest),
                         onlyoffice-docs (read the docs site as Markdown while writing references)
sources.json             the external hosts named once for every skill;
                         `node tools/sync-sources.mjs --host apiSite=<origin>` points the whole plugin at another docs build
tools/                   sync-sources.mjs: every link and pinned version traces to the root hosts and a skill's sources.json
                         sync-ui-kit.mjs: derives skills/apps-ui-kit's component manifest from the UI kit's own metadata
                         run-triggers.mjs: sends a skill's evals/trigger-tests.md through `claude -p` and reports which messages loaded it
evals/                   the `claude plugin eval` suite: one directory per case (prompt.md + graders/), results/ gitignored
skills/apps-embed-sdk/   references: config-reference (fields by mode), one file per mode, methods, events, editor automation,
                         auth recipes, testing, framework recipes; scripts: probe-portal, validate-config, sync-sdk
skills/apps-plugin-sdk/  references: build and audit workflows, plugins/ items/ components/ react/ (a page per SDK type),
                         bundling, portal behaviour, styles, the UI kit in a plugin, REST API, SDK 2 plugins;
                         scripts: generate, validate, preview, contract.mjs; templates: Vite/TS config for generated projects
skills/apps-ui-kit/      references: setup, choosing, forms, overlays, lists, theming, i18n, testing, public API, troubleshooting;
                         scripts: check-usage and data/kit-manifest.json; templates: the entry point and the providers
```

## What a reference says

A reference describes the SDK **as it runs**, not as its type definitions compile: a field
the types accept but the portal ignores is documented as ignored. Every claim an agent
would act on is checked against the SDK source or a live portal before it is written, and
a correction commit names what was checked ("Correct eight reference claims against the
4.0 client"). Where the rule exists because of a silent failure, say what the failure looks
like — a blank page, an unsorted list, an item that never appears — so the agent can
recognise it when debugging.

**Where a fact is written — once.** In `apps-plugin-sdk`, on the page of the SDK type it belongs
to — under `plugins/`, `items/`, `components/` or `react/`, each page named after its type
without the `I`, in kebab-case (`IInfoPanelItem` → `references/items/info-panel-item.md`); the
topical files at the root hold what belongs to no single type and link to those pages rather
than restating them, and `SKILL.md` links every page directly. In `apps-ui-kit`, in the kit: every
component's behaviour lives in its README inside `docspace-ui-kit-react`, which ships in the
package and on the docs site, so a fault in a component page is corrected upstream and the skill
keeps only what no component page can hold — which component to choose, how the pieces compose,
the rules an agent breaks without being told. In `apps-embed-sdk`, `config-reference.md` keeps only
what the SDK's types do not say — defaults, which mode reads a field, traps — and the generated
dictionaries of the validator carry the rest.

**Links.** The references do not restate the SDK's documentation — signatures, props, enum
values and method lists are linked, one docs page per interface, hook and enum, in the `.md` form
the site serves as plain Markdown (the trailing slash of a page URL replaced by `.md`). Every link is
built on a host in the root `sources.json` through the skill's own `sources.json`, and the
committed text always carries the production URLs. To work against a staging site or a local
build of the docs, move the whole plugin there and back before committing:

```sh
node tools/sync-sources.mjs --host apiSite=<origin of the staging site or local build>   # every link of every skill moves there
node tools/sync-sources.mjs --skill apps-plugin-sdk --verify                                  # one request per link
node tools/sync-sources.mjs --host apiSite=<production origin>                           # back, so git status shows no change
```

`localhost` is a placeholder host for the checker — links to it are neither checked nor
verified — so a local build is addressed as `127.0.0.1` with its port. `node
tools/sync-sources.mjs --check` fails on a link built on anything else, and `--verify` must
answer `ok` for every link on production before a release.

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

A rule enters `SKILL.md` only with an eval assertion behind it: the file is loaded whole on
every trigger, so a new trap goes on the component's page upstream or into a reference first.
`apps-ui-kit` keeps a budget of 175 lines for its `SKILL.md`; the entry condition, not the ceiling,
is what keeps it small. Its `evals/README.md` records why each rule the kit's own pages also
state still stays.

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
node tools/sync-ui-kit.mjs --from <kit> --check                # the apps-ui-kit manifest matches the kit (a checkout or an installed package)
```

For a content change, also the cheap behaviour suite — [TESTING.md](TESTING.md) has the full
protocol and what each result means.

Commit messages say what changed and why in one line, in the imperative, without a type
prefix ("Warn that FieldContainer's own margin doubles against a column gap").

Do not add `Co-Authored-By` trailers or any other AI-attribution lines to commit messages
or pull request descriptions. Same rule as `docspace-ui-kit-react` and the DocSpace client.

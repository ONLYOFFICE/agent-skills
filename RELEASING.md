# Releasing

How the plugin is versioned, where it is installable from, and what to check before a
release. The audience is whoever cuts a release; contributors need [CONTRIBUTING.md](CONTRIBUTING.md).

## What "publishing" means here

There is no registry. A Claude Code marketplace **is a git repository** with
`.claude-plugin/marketplace.json` in it, and `/plugin marketplace add <repo>` simply
clones that repository. The plugin is therefore available exactly to those who can
clone the repository that holds it:

| Where the repository lives | Who can install | How |
|---|---|---|
| `git.onlyoffice.com/ONLYOFFICE/agent-skills` (origin) | company | `/plugin marketplace add git@git.onlyoffice.com:ONLYOFFICE/agent-skills.git` |
| `github.com/ONLYOFFICE/agent-skills` (public mirror, **not yet created**) | everyone | `/plugin marketplace add ONLYOFFICE/agent-skills`, `npx skills add ONLYOFFICE/agent-skills` |

Pushing to the public mirror **is** the publication. Nothing is announced or indexed
automatically, but both install commands above start working the moment the public
repository exists, and `npx skills add` (agentskills.io) requires it to be public on
GitHub. Until that push the plugin stays internal, and every install command in the
README and `repository` in `.claude-plugin/plugin.json` point at `git.onlyoffice.com`;
switch them to the GitHub path as part of that release.

## Names

| What | Value | Where | Notes |
|---|---|---|---|
| Marketplace | `onlyoffice-skills` | `marketplace.json` → `name` | Goes after `@` in `/plugin install`. Kebab-case. **Do not rename to `agent-skills`** — it is on Claude Code's reserved list (with `claude-*`, `anthropic-*`, `agent-skills`, `anthropic-agent-skills`, …); the client rejects such marketplaces at `marketplace add`, and `claude plugin validate` does not catch it. |
| Plugin | `onlyoffice` | `plugin.json` → `name`, and the entry in `marketplace.json` → `plugins[].name` | The two must match. This is the namespace prefix every skill is shown under (`onlyoffice:embed-sdk`). One plugin covers every ONLYOFFICE SDK and tool; new SDKs become new skills, not new plugins. |
| Skills | `embed-sdk`, `plugin-sdk`, `ui-kit` | `skills/<name>/SKILL.md` → `name` | Must equal the directory name. |

Installation reads `/plugin install onlyoffice@onlyoffice-skills`.

## Versions

Two different things carry a version; do not confuse them.

**Plugin version** — the version of this repository as a whole. Lives in two places that
must be equal: `.claude-plugin/plugin.json` → `version` and
`.claude-plugin/marketplace.json` → `metadata.version`. Claude Code uses `plugin.json`
to detect updates, so a release that does not bump it is invisible to installed
copies. Skills do not have versions of their own; a change to any skill is a plugin
release. Semver: new skill or breaking rewrite of one → minor while `0.x`; corrections
→ patch.

**Target SDK version** — the SDK release a skill describes. Lives in each skill's
`SKILL.md` frontmatter as `metadata.sdk-version`, and is repeated in prose in the root
README (the "Targets" column of the skills table). For `plugin-sdk` the SDK/DocSpace pair
is also stated in `skills/plugin-sdk/references/plugins/scopes.md`. When an SDK is released:

- `embed-sdk`: `node tools/sync-sources.mjs --skill embed-sdk --set-version <x.y.z>` (moves
  `sdk-version`, the pinned-facts line, the validator header and the raw GitHub links
  together), then `node skills/embed-sdk/scripts/sync-sdk.mjs --from <SDK checkout or
  node_modules/@onlyoffice/docspace-sdk-js> --write` (regenerates the validator's
  dictionaries from the types), then read the SDK changelog and revise the references that
  describe behaviour (`config-reference.md` traps, `methods.md`, `events.md`, mode files).
  Finish with `--verify` on the links and the README table.

  **The `raw` source is `"verify": false` and is waiting for one thing: the `v2.2.0` tag.**
  The skill describes 2.2.0 — the named `SDK` export, the fifth `code` argument to `login()` —
  and the newest tag GitHub resolves is `v2.1.0`, so every `raw` link 404s and `--verify` would
  report five dead links that are all the same fact. Lowering the pin to 2.1.0 would trade
  correct prose for a green tick and is not the answer. **The moment `v2.2.0` is tagged**: set
  `"verify": true` on `raw` in `skills/embed-sdk/sources.json`, delete the "that tag is not cut
  yet" note from step 3 of "Sources, and which one wins" in its `SKILL.md`, and run `--verify`
  to confirm the three URLs answer. Until then the flag is what keeps that check able to report
  a *new* breakage instead of drowning it in a known one.
- `plugin-sdk`: update `scripts/contract.mjs` (the portal contract, imported by both
  generator and validator) and the version pair in `references/plugins/scopes.md`; if the
  kit changed, move `UI_KIT_RANGE` in `scripts/generator/project-files.mjs` with the range the
  portal installs and update `references/ui-kit.md`. Then bump `sdk-version` and the README table. The
  validator's `checkSdkDrift()` warns when the contract and an installed SDK diverge.
- `ui-kit`: the target is a release of the kit itself. Pull `docspace-ui-kit-react` to the
  released revision (or install the released package) and run
  `node tools/sync-ui-kit.mjs --from <kit> --write`, which rebuilds
  `scripts/data/kit-manifest.json`. If the kit's `package.json` version moved, the run prints
  the `--set-version` command to follow it with. Then read the critical rules in `SKILL.md`
  against the kit's pages and drop the ones the kit now states itself — only where the eval
  assertion behind the rule still passes without it. The skill links the kit's pages on the
  docs site, so `node .claude/skills/onlyoffice-docs/scripts/docs.mjs status` must show
  `docspace/ui-kit` served from production before the release. See
  `.claude/skills/sync-ui-kit/SKILL.md`.

## Checklist

Before tagging a release:

1. `claude plugin validate . --strict` **and** `claude plugin validate skills --strict` pass.
   Two commands, not one: the tool picks its mode from the path, so a directory holding a
   `.claude-plugin/` is validated as a manifest and nothing under it is read. The `.` form alone
   has never checked a `SKILL.md`, which is most of what a release changes.
2. `node skills/embed-sdk/scripts/test-validator.mjs`,
   `node skills/plugin-sdk/scripts/test-validator.mjs` and
   `node skills/ui-kit/scripts/test-validator.mjs` pass. Run the last one once more with
   `--kit-project <dir>`, naming a project that has the kit installed — the `ui-kit` eval
   fixture after its install will do: that type-checks `skills/ui-kit/templates/*` against the
   kit's own types, which the offline run cannot reach. The templates are copied into
   projects verbatim, so a prop the kit renamed breaks every one of them.
2a. `node tools/sync-sources.mjs --verify` passes: every link traces to a `sources.json`,
   every pinned version matches, every source URL answers. For `embed-sdk` also
   `node skills/embed-sdk/scripts/sync-sdk.mjs --from <SDK> --check`; for `ui-kit`,
   `node tools/sync-ui-kit.mjs --from <kit> --check --strict` — the manifest must match the
   released kit, and `--strict` additionally fails when a component README upstream has lost
   its metadata block, which would drop that component from the manifest.
   The self-test runs the same check when it is given `--kit-project <dir with the kit installed>`.
   Before the docs site is deployed, `--verify --fallback` checks the same links on the stand
   (`apiSiteFallback`).
2b. `node .claude/skills/onlyoffice-docs/scripts/docs.mjs status` exits 0: production serves
   `llms.txt` and a Markdown page for every section, so the skills' "append `.md`" and `llms.txt`
   instructions work for users. Exit 1 means only the stand serves them — fine for an internal
   release, not for a public one. `node .claude/skills/onlyoffice-docs/scripts/test-docs.mjs` passes.
3. The plugin eval suite passes after the last content change:
   `claude plugin eval . --json evals/results/release.json --threshold 0.8 --trust-plugin --no-publish --allow-tools Write Edit Bash WebFetch`
   (the `heavy` cases need the network for npm; run them once, `--tag heavy`). Pin `--model`
   and `--judge-model` in the notes so the number is reproducible. The per-skill A/B
   protocols ([embed-sdk](skills/embed-sdk/evals/README.md),
   [plugin-sdk](skills/plugin-sdk/evals/README.md),
   [ui-kit](skills/ui-kit/evals/README.md)) are for iterating on a skill, not a
   release gate.
4. `version` in `plugin.json` and `metadata.version` in `marketplace.json` are bumped
   and equal.
5. `metadata.sdk-version` in every `SKILL.md` matches the "Targets" column in the README.
6. Commit, tag `v<version>`, push to origin. Push to the GitHub mirror only when the
   release is meant to be public (see above).

## Not yet done

- CI that runs the offline checks of [TESTING.md](TESTING.md) on every push and the cheap eval
  cases (`--tag question --tag trigger`) on a schedule; the build cases need a Linux or macOS
  runner, since a shell grant requires a sandbox backend. Until then every step is run by hand.
- `skills/plugin-sdk/vendor/` holds the packed SDK in git until 3.0.0 is on npm; delete it then.
- `skills/embed-sdk/scripts/sync-sdk.mjs` derives the validator dictionaries by parsing the
  SDK's `.d.ts` files with regular expressions; a generated schema on the SDK side was
  considered and dropped (the SDK itself has no use for it), so the parser stays and must be
  re-checked when the type declarations change shape.
- `sources.json` knows one version per skill; `plugin-sdk` also pins a DocSpace version
  (`docspace-version` in its frontmatter) that the tooling does not track yet.

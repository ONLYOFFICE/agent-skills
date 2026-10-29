# Releasing

How the plugin is versioned, where it is installable from, and what to check before a
release. The audience is whoever cuts a release; contributors need [CONTRIBUTING.md](CONTRIBUTING.md).

## What "publishing" means here

There is no registry. A Claude Code marketplace **is a git repository** with
`.claude-plugin/marketplace.json` in it, and `/plugin marketplace add <repo>` simply
clones that repository. Users add ONLYOFFICE's,
[ONLYOFFICE/agent-plugins](https://github.com/ONLYOFFICE/agent-plugins), whose entry for this
plugin fetches the `plugin` branch of `github.com/ONLYOFFICE/agent-skills`; Codex reads the same
repository's `.agents/plugins/marketplace.json`, which points at the same branch. So what a
release publishes to `plugin` is what users get, and nothing in `agent-plugins` changes for a
release. `npx skills add ONLYOFFICE/agent-skills` reads the skills from the default branch,
`main`. Every branch of `github.com/ONLYOFFICE/agent-skills` is public — do not push anything
that may not be. Nothing is announced or indexed automatically.

### How a release gets there

The repository's origin is `git.onlyoffice.com`; `github.com/ONLYOFFICE/agent-skills` is its
public mirror. Two workflows in `.github/workflows/` turn a version bump into a release, each
running on one side only:

1. **`create-tag.yml`, on Gitea.** A push to `main` that changes `.claude-plugin/plugin.json`
   does nothing if the tag `v<version>` exists. Otherwise it runs `tools/check-manifests.mjs`,
   the offline checks of [TESTING.md](TESTING.md) and `tools/build-plugin.mjs`, commits `dist/`
   as the next commit of the `plugin` branch — a history of its own that holds the plugin and
   nothing else; a build identical to the branch's tip is not committed again — and pushes that
   commit and the tag `v<version>` in one atomic push: both land or neither does.
2. The mirror carries the branch and the tag to GitHub.
3. **`release.yml`, on GitHub.** The tag checks that it matches the manifest's version, builds
   `dist/` again and fails unless the tip of `plugin` holds exactly that build, then zips `dist/`
   and creates the GitHub release `v<version>` with `onlyoffice-devtools-<version>.zip` attached,
   the archive submitted to OpenAI's directory. It pushes nothing.

The `plugin` branch is what Anthropic's directory follows (*Branch or tag* in the developer
portal) and what a marketplace entry outside this repository points at. It is made on Gitea
because the push mirror runs `git push --mirror`, which deletes from GitHub every ref missing on
Gitea and cannot be told not to: a branch pushed to GitHub alone is gone at the next sync. Never
push to `plugin` on GitHub directly, and never delete it on Gitea.

## What ships

The repository is the plugin's source, not the plugin. `node tools/build-plugin.mjs` builds what
an install receives into `dist/`; the release workflow zips the same files into
`onlyoffice-devtools-<version>.zip`, the archive OpenAI's directory takes. To look at that archive
before a release, make it on Linux or macOS the way the workflow does:
`cd dist && zip -r -X ../onlyoffice-devtools-<version>.zip .`

| Ships | Left out |
|---|---|
| `.claude-plugin/plugin.json`, `plugin.json`, `assets/icon.png`, `LICENSE` | `.claude-plugin/marketplace.json`, `.claude/`, `tools/`, `evals/`, `sources.json`, `CONTRIBUTING.md`, `RELEASING.md`, `TESTING.md` |
| `README.md`, made from the root README: the skills table links each `SKILL.md`, the line for contributors is dropped | |
| per skill: `SKILL.md`, `references/`, `templates/`, `scripts/` | per skill: `README.md`, `sources.json`, `evals/`; in `scripts/` every `README.md`, `test-validator.mjs`, `validator-tests/` and `embed-sdk`'s `sync-sdk.mjs` |

The rules are in `SKILL_RULES` at the top of the script. Every tracked file under `skills/` must
match one, so a new file fails the build until it is given one — decide by whether an agent
reads or runs it while doing the skill's job. A relative link from a shipped Markdown file to
anything left out fails the build too. The build reads the committed files of a revision
(`--ref`, HEAD by default), never the working tree: the same revision gives the same files on
every OS. It runs `tools/check-manifests.mjs --ref` on that revision first, so the manifests and
icon it checks are the ones it ships.

## Names

| What | Value | Where | Notes |
|---|---|---|---|
| Marketplace | `onlyoffice-skills` | `marketplace.json` → `name` | Goes after `@` in `/plugin install`. Kebab-case. **Do not rename to `agent-skills`** — it is on Claude Code's reserved list (with `claude-*`, `anthropic-*`, `agent-skills`, `anthropic-agent-skills`, …); the client rejects such marketplaces at `marketplace add`, and `claude plugin validate` does not catch it. |
| Plugin | `onlyoffice-devtools` | `name` in both plugin manifests, and the entry in `marketplace.json` → `plugins[].name` | All three must match. This is the namespace prefix every skill is shown under (`onlyoffice-devtools:apps-embed-sdk`). One plugin covers every ONLYOFFICE SDK and tool; new SDKs become new skills, not new plugins. The ONLYOFFICE Apps MCP server is not part of it: it ships as a plugin of its own, from its own repository. |
| Skills | `apps-embed-sdk`, `apps-plugin-sdk`, `apps-ui-kit` | `skills/<name>/SKILL.md` → `name` | Must equal the directory name. |

Installation reads `/plugin install onlyoffice-devtools@onlyoffice`, from the `onlyoffice`
marketplace in `ONLYOFFICE/agent-plugins`. That marketplace's entry repeats the plugin's
`displayName`, `description` and links, which Claude Code shows before the plugin is installed:
a change to them here reaches the listing only when the entry there changes too. This
repository's own marketplace, `onlyoffice-skills`, still installs the repository root as it is;
the README does not point at it.

## Versions

Two different things carry a version; do not confuse them.

**Plugin version** — the version of this repository as a whole. Lives in three places that
must be equal: `version` in both plugin manifests and `.claude-plugin/marketplace.json` →
`metadata.version`. The plugin carries two manifests because the clients read different
ones: `.claude-plugin/plugin.json` is Claude Code's and Anthropic's directory's, and
`plugin.json` at the root is the Agent Plugins 1.0.0 manifest that OpenAI, Codex and the other
clients of that standard read, with the OpenAI listing under `extensions["com.openai"]` (it
replaces `.codex-plugin/plugin.json`, which OpenAI now keeps only as a fallback).
`node tools/check-manifests.mjs` says whether the three agree. Claude Code uses
`.claude-plugin/plugin.json` to detect updates, so a release that does not bump it is invisible to installed
copies. Skills do not have versions of their own; a change to any skill is a plugin
release. Semver: new skill or breaking rewrite of one → minor while `0.x`; corrections
→ patch.

**Icon** — `assets/icon.png`, named by `icon` in the Claude manifest and by `composerIcon` and
`logo` in the OpenAI listing. OpenAI's directory takes PNG, JPEG, WebP or SVG, square, 48 to
4096 px, 5 MiB or less; Anthropic's documents only an image file inside the plugin, which its
file checks accept as PNG, JPEG, GIF, WebP or SVG of 5 MiB or less.

**Target SDK version** — the SDK release a skill describes. Lives in each skill's
`SKILL.md` frontmatter as `metadata.sdk-version`, and is repeated in prose in the root
README (the "Targets" column of the skills table). For `apps-plugin-sdk` the SDK/DocSpace pair
is also stated in `skills/apps-plugin-sdk/references/plugins/scopes.md`. When an SDK is released:

- `apps-embed-sdk`: `node tools/sync-sources.mjs --skill apps-embed-sdk --set-version <x.y.z>` (moves
  `sdk-version`, the pinned-facts line, the validator header and the raw GitHub links
  together), then `node skills/apps-embed-sdk/scripts/sync-sdk.mjs --from <SDK checkout or
  node_modules/@onlyoffice/docspace-sdk-js> --write` (regenerates the validator's
  dictionaries from the types), then read the SDK changelog and revise the references that
  describe behaviour (`config-reference.md` traps, `methods.md`, `events.md`, mode files).
  Finish with `--verify` on the links and the README table.
- `apps-plugin-sdk`: update `scripts/contract.mjs` (the portal contract, imported by both
  generator and validator), the version pair in `references/plugins/scopes.md` and, on a new
  SDK major, `SDK_RANGE` in `scripts/generator/project-files.mjs`; if the
  kit changed, move `UI_KIT_RANGE` in `scripts/generator/project-files.mjs` with the range the
  portal installs and update `references/ui-kit.md`. Then bump `sdk-version` and the README table. The
  validator's `checkSdkDrift()` warns when the contract and an installed SDK diverge.
- `apps-ui-kit`: the target is a release of the kit itself. Pull `docspace-ui-kit-react` to the
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
   `node tools/check-manifests.mjs` passes too: `validate` reads only the Claude manifest.
2. `node skills/apps-embed-sdk/scripts/test-validator.mjs`,
   `node skills/apps-plugin-sdk/scripts/test-validator.mjs` and
   `node skills/apps-ui-kit/scripts/test-validator.mjs` pass. Run the last one once more with
   `--kit-project <dir>`, naming a project that has the kit installed — the `apps-ui-kit` eval
   fixture after its install will do: that type-checks `skills/apps-ui-kit/templates/*` against the
   kit's own types, which the offline run cannot reach. The templates are copied into
   projects verbatim, so a prop the kit renamed breaks every one of them.
2a. `node tools/sync-sources.mjs --verify` passes: every link traces to a `sources.json`,
   every pinned version matches, every source URL answers. For `apps-embed-sdk` also
   `node skills/apps-embed-sdk/scripts/sync-sdk.mjs --from <SDK> --check`; for `apps-ui-kit`,
   `node tools/sync-ui-kit.mjs --from <kit> --check --strict` — the manifest must match the
   released kit, and `--strict` additionally fails when a component README upstream has lost
   its metadata block, which would drop that component from the manifest.
   The self-test runs the same check when it is given `--kit-project <dir with the kit installed>`.
   The gate is `--verify` against production. While a docs release is still on the stand,
   `--verify --fallback` checks the same links there (`apiSiteFallback`) to tell a page the
   release will bring from a link that is simply wrong.
2b. `node .claude/skills/onlyoffice-docs/scripts/docs.mjs status` exits 0: production serves
   `llms.txt` and a Markdown page for every section, so the skills' "append `.md`" and `llms.txt`
   instructions work for users. Exit 1 means only the stand serves them, and the release waits
   for the docs. `node .claude/skills/onlyoffice-docs/scripts/test-docs.mjs` passes.
3. The plugin eval suite passes after the last content change:
   `claude plugin eval . --json evals/results/release.json --threshold 0.8 --trust-plugin --no-publish --allow-tools Write Edit Bash WebFetch`
   (the `heavy` cases need the network for npm; run them once, `--tag heavy`). Pin `--model`
   and `--judge-model` in the notes so the number is reproducible. The per-skill A/B
   protocols ([apps-embed-sdk](skills/apps-embed-sdk/evals/README.md),
   [apps-plugin-sdk](skills/apps-plugin-sdk/evals/README.md),
   [apps-ui-kit](skills/apps-ui-kit/evals/README.md)) are for iterating on a skill, not a
   release gate.
4. `version` in both plugin manifests and `metadata.version` in `marketplace.json` are bumped
   and equal (`node tools/check-manifests.mjs`).
5. `metadata.sdk-version` in every `SKILL.md` matches the "Targets" column in the README.
5a. `node tools/build-plugin.mjs` passes on the release commit, and
   `claude plugin validate dist --strict` and `claude plugin validate dist/skills --strict` pass
   on what it built.
6. Merge into `main` on Gitea; `create-tag.yml` publishes the `plugin` branch and tags the merge
   commit `v<version>`. Once the mirror has carried both, `release.yml` on GitHub creates the
   release: `git ls-remote https://github.com/ONLYOFFICE/agent-skills refs/heads/plugin refs/tags/v<version>`
   lists both, the tip of `plugin` says `built from v<version>`, and the release has the zip
   attached.

## Not yet done

- CI that runs the offline checks of [TESTING.md](TESTING.md) on every push, not only on a
  release, and the cheap eval cases (`--tag question --tag trigger`) on a schedule; the build
  cases need a Linux or macOS runner, since a shell grant requires a sandbox backend. Until then
  a change is checked by hand before its pull request, and the eval suite before a release.
- `skills/apps-embed-sdk/scripts/sync-sdk.mjs` derives the validator dictionaries by parsing the
  SDK's `.d.ts` files with regular expressions; a generated schema on the SDK side was
  considered and dropped (the SDK itself has no use for it), so the parser stays and must be
  re-checked when the type declarations change shape.
- `sources.json` knows one version per skill; `apps-plugin-sdk` also pins a DocSpace version
  (`docspace-version` in its frontmatter) that the tooling does not track yet.

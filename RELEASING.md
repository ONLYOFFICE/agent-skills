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
| Skills | `embed-sdk`, `plugin-sdk` | `skills/<name>/SKILL.md` → `name` | Must equal the directory name. |

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
is also stated in `skills/plugin-sdk/references/scopes.md`. When an SDK is released:

- `embed-sdk`: regenerate `references/config-reference.md` and the dictionary in
  `scripts/validate-config.mjs` from the SDK's `src/types` / `src/enums`, then bump
  `sdk-version` and the README table.
- `plugin-sdk`: update `scripts/contract.mjs` (the portal contract, imported by both
  generator and validator) and the version pair in `references/scopes.md`; if the
  client's `libs/ui-kit` changed, repack the tarball in `vendor/` and update
  `references/ui-kit.md`. Then bump `sdk-version` and the README table. The
  validator's `checkSdkDrift()` warns when the contract and an installed SDK diverge.

## Checklist

Before tagging a release:

1. `claude plugin validate . --strict` passes.
2. `node skills/embed-sdk/scripts/test-validator.mjs` and
   `node skills/plugin-sdk/scripts/test-validator.mjs` pass.
3. The skill(s) that changed have been through their evals
   ([embed-sdk](skills/embed-sdk/evals/README.md),
   [plugin-sdk](skills/plugin-sdk/evals/README.md)) — once, after the last content
   change, not in a loop.
4. `version` in `plugin.json` and `metadata.version` in `marketplace.json` are bumped
   and equal.
5. `metadata.sdk-version` in every `SKILL.md` matches the "Targets" column in the README.
6. Commit, tag `v<version>`, push to origin. Push to the GitHub mirror only when the
   release is meant to be public (see above).

## Not yet done

- CI that runs steps 1, 2, 4 and 5 on every push.
- `skills/plugin-sdk/vendor/` holds ~7 MB of tarballs in git; move them to LFS, a
  registry or release assets once a home is chosen.
- `tools/generate-skill-refs.mjs` to produce `config-reference.md` and the embed-sdk
  validator dictionary from the SDK sources instead of maintaining them by hand.

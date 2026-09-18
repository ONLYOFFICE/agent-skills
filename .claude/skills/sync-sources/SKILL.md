---
name: sync-sources
description: >
  Keep the external links and pinned SDK versions of the skills in this repository in step
  with their sources.json. Use when a docs site moves or gets a staging/local build, when an
  SDK releases and the skill must target the new version, when a reference needs a new link
  to api.onlyoffice.com or GitHub, or when someone asks to "point the plugin at the staging
  site", "switch to the local docs build", "update the links" or "bump the SDK version".
  Repository-internal; not shipped in the plugin.
---

# Sync the skills' links and versions with their sources

External sites are named once, in `sources.json` at the repository root (`hosts`). Every skill
under `skills/<name>/` carries its own `sources.json` that says which hosts it links to and at
which path (`docs`, `repo`, `raw`, `demo`, …), the SDK version it targets and the placeholder
hosts of its examples. `tools/sync-sources.mjs` checks that every URL in a skill is built on one
of those sources and that every pinned version agrees with the manifest, and it performs the
two moves that otherwise mean a search-and-replace across the repository: pointing a host at
another site, and bumping a version.

## Rules

- A site is named only in the root `sources.json`. A skill source is `{ host, path }`; the link
  base is the host's URL plus the path. A new site means a new host at the root first, then a
  source in the skill, then the link.
- The SDK version lives in the skill's `sources.json` and is written into the text through
  `versionPatterns`; never edit a version literal by hand — change the manifest and run
  `--set-version`.
- Links to the SDK repository at a tag are built on a source whose path contains
  `{version}` (`raw`), so a version bump moves them all.
- Example hosts (`portal.example.com`, `localhost`, `*.example`) are placeholders; the checker
  ignores them. Anything else that is not built on a source fails the check. A local docs
  build is therefore addressed as `127.0.0.1`, never `localhost`.
- The texts always carry the production URLs when committed: `--host` rewrites the root
  manifest too, so a plugin pointed at another site shows `sources.json` as modified in
  `git status`. Switch back before committing.
- `--check` runs inside the validator self-test of a skill and in the release checklist;
  a red check blocks a release.

## Commands

```
node tools/sync-sources.mjs --check                         # every skill and the root README
node tools/sync-sources.mjs --skill embed-sdk --check
node tools/sync-sources.mjs --verify                        # + one request per link
node tools/sync-sources.mjs --host apiSite=http://127.0.0.1:3005      # whole plugin → local docs build
node tools/sync-sources.mjs --host apiSite=https://api.teamlab.info   # whole plugin → staging
node tools/sync-sources.mjs --host apiSite=https://api.onlyoffice.com # back to production
node tools/sync-sources.mjs --skill embed-sdk --set-version 2.3.0
```

## Pointing the plugin at another docs site (staging, local build)

1. `--host apiSite=<origin>`: rewrites the host in the root `sources.json` and every link built
   on it in every skill — SKILL.md, references, scripts, evals — then re-runs `--check`.
2. `--verify` against the new site. A `DEAD` line is either a page that does not exist there
   yet (keep the production link, note it) or a path that changed (fix the path in the text).
3. Do the work, then `--host apiSite=https://api.onlyoffice.com` and confirm `git status`
   shows no change to `sources.json`.

A renamed section of the same site (`get-started/` → `getting-started/`) is a path change, not a
host change: fix the paths in the text and in the skill's `sources.json`, then `--check`.

## Targeting a new SDK release

1. `--skill <name> --set-version <x.y.z>`: manifest, `sdk-version` in the frontmatter, the
   pinned-facts line, the validator header and the `raw` links move together.
2. `node skills/embed-sdk/scripts/sync-sdk.mjs --from <sdk checkout or node_modules/@onlyoffice/docspace-sdk-js> --check`
   and `--write` if the dictionaries changed (that script owns the validator's dictionaries;
   this one owns links and versions).
3. Read the SDK changelog for the release and update the references that describe behaviour
   (new modes, fields, events), then `--verify` and the self-test.
4. Record the target in the skill's README "What it targets" and in the commit message.

## When --check fails

- `FOREIGN` — a link not built on any source of that skill. Either add a host at the root and
  a source in the skill (`"verify": true` unless the host rejects anonymous HEAD/GET), or turn
  the host into a placeholder if it is only an example.
- `STALE` — a link built on a `{version}` source with another version. Run `--set-version`
  with the manifest version instead of editing the link.
- `VERSION` — a `versionPatterns` entry does not match. Either the pattern is out of date
  (update it in the manifest) or the text was edited by hand (run `--set-version`).
- `DEAD` (with `--verify`) — the site no longer serves the page. Fix the path, or drop the
  link and the sentence that needed it.
- `ERROR: … names host "x", which sources.json does not declare` — the skill manifest refers
  to a host missing at the root; add it there.

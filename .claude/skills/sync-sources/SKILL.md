---
name: sync-sources
description: >
  Keep the external links and pinned SDK versions of the skills in this repository in step
  with their sources.json. Use when a docs site moves or gets a staging/local build, when an
  SDK releases and the skill must target the new version, when a reference needs a new link
  to api.onlyoffice.com or GitHub, or when someone asks to "remap the skill to another site",
  "update the links" or "bump the SDK version". Repository-internal; not shipped in the plugin.
---

# Sync the skills' links and versions with their sources

Every skill under `skills/<name>/` carries a `sources.json`: the SDK version it targets, the
external sites it links to (docs, repository, raw files, demo) and the placeholder hosts used
in examples. `tools/sync-sources.mjs` checks that every URL in the skill comes from that
manifest and that every pinned version agrees with it, and it performs the two moves that
otherwise mean a search-and-replace across the repository.

## Rules

- A URL enters a skill only if its base is in the skill's `sources.json`. A new site means a
  new entry in `sources` first, then the link.
- The SDK version lives in `sources.json` and is written into the text through
  `versionPatterns`; never edit a version literal by hand — change the manifest and run
  `--set-version`.
- Links to the SDK repository at a tag are built on a source whose base contains
  `{version}` (`raw`), so a version bump moves them all.
- Example hosts (`portal.example.com`, `localhost`, `*.example`) are placeholders; the checker
  ignores them. Anything else that is not a source fails the check.
- `--check` runs inside the validator self-test of a skill and in the release checklist;
  a red check blocks a release.

## Commands

```
node tools/sync-sources.mjs --check                         # every skill
node tools/sync-sources.mjs --skill embed-sdk --check
node tools/sync-sources.mjs --skill embed-sdk --verify      # + one request per source URL
node tools/sync-sources.mjs --skill embed-sdk --map https://api.onlyoffice.com/docspace/javascript-sdk=http://localhost:3000/docspace/javascript-sdk
node tools/sync-sources.mjs --skill embed-sdk --set-version 2.3.0
```

## Moving a skill to another docs site (staging, local build, renamed section)

1. Compare the page layout of the new site with the paths used in the skill (`get-started/`,
   `embedding-modes/{mode}-mode/`, `usage-sdk/…`). If a path changed, fix the path in the
   text first; `--map` only replaces the base.
2. `--map <old base>=<new base>`: rewrites the base in `sources.json` and every link built
   on it, then re-checks.
3. `--verify` against the new site. Fix or remove dead links; do not leave a link that 404s.
4. Run the skill's `scripts/test-validator.mjs` and commit with a message that names the
   site and the reason ("embed-sdk: point the docs links at the staging site for the 2.3 review").

## Targeting a new SDK release

1. `--set-version <x.y.z>`: manifest, `sdk-version` in the frontmatter, the pinned-facts
   line, the validator header and the raw links move together.
2. `node skills/embed-sdk/scripts/sync-sdk.mjs --from <sdk checkout or node_modules/@onlyoffice/docspace-sdk-js> --check`
   and `--write` if the dictionaries changed (that script owns the validator's dictionaries;
   this one owns links and versions).
3. Read the SDK changelog for the release and update the references that describe behaviour
   (new modes, fields, events), then `--verify` and the self-test.
4. Record the target in the skill's README "What it targets" and in the commit message.

## When --check fails

- `FOREIGN` — a link whose base is not a source. Either add the source to `sources.json`
  (with `"verify": true` unless the host rejects HEAD/GET for anonymous callers) or turn the
  host into a placeholder if it is only an example.
- `STALE` — a link built on a `{version}` source with another version. Run `--set-version`
  with the manifest version instead of editing the link.
- `VERSION` — a `versionPatterns` entry does not match. Either the pattern is out of date
  (update it in the manifest) or the text was edited by hand (run `--set-version`).
- `DEAD` (with `--verify`) — the site no longer serves the page. Fix the path, or drop the
  link and the sentence that needed it.

---
name: sync-ui-kit
description: >
  Copy the ONLYOFFICE UI kit's own component documentation into the ui-kit skill and rebuild
  its manifest. Use when docspace-ui-kit-react has changed and skills/ui-kit/references/
  components/ must follow, when the kit releases a new version, when someone asks to "re-sync
  the kit pages", "update the component docs" or "regenerate the kit manifest", and when
  `node tools/sync-ui-kit.mjs --check` fails in the self-test or the release checklist.
  Repository-internal; not shipped in the plugin.
---

# Sync the ui-kit skill with the kit's own READMEs

`skills/ui-kit/references/components/` is not written here. Every page in it is a copy of a
README that lives in [`docspace-ui-kit-react`](https://github.com/ONLYOFFICE/docspace-ui-kit-react),
carrying a provenance header, a pointer back to the file it came from, and a hash of its own
body. `tools/sync-ui-kit.mjs` makes those copies, rewrites their relative links to the shape
this skill's directory has, and derives `skills/ui-kit/scripts/data/kit-manifest.json` — the
data `check-usage.mjs` validates a project against.

## Rules

- **Never edit a page under `references/components/`.** The next sync reverts it, and the
  offline `--check` fails in the meantime. A wrong sentence there is a wrong sentence in the
  kit: fix the component's README in `docspace-ui-kit-react`, then re-sync.
- **Nothing else in the skill is generated.** `SKILL.md` and the hand-written references are
  this repository's own work, and where a rule of theirs contradicts a synced page, the rule
  wins — every page says so in a quoted line under its header.
- **What the manifest knows comes from the metadata block** of each README
  (`<!-- ui-kit-doc … -->`): name, category, status, import form, the prop that shows and
  hides the component. A README without one is announced as `META-MISSING` and is simply
  absent from the manifest; `--strict` turns that into a failure.
- **`sources.json` names `references/components` in `skipDirs`**, so `sync-sources.mjs` does
  not scan those pages. Their links point at the kit's own world and cannot be corrected here.
- The version the skill targets stays in `skills/ui-kit/sources.json` and is written into the
  text by `sync-sources.mjs`; this tool only reports when the kit's version has moved past it.

## Commands

```
node tools/sync-ui-kit.mjs --from ../docspace-ui-kit-react --write   # copy the pages, rebuild the manifest
node tools/sync-ui-kit.mjs --from ../docspace-ui-kit-react --check   # exit 1 when a copy is out of date
node tools/sync-ui-kit.mjs --check                                   # offline: exit 1 when a page was edited here
node tools/sync-ui-kit.mjs --from ../docspace-ui-kit-react --dump    # print the derived manifest
```

`--from` takes a checkout of the kit or an installed `node_modules/@onlyoffice/apps-ui-kit`:
the package ships the component READMEs and the cross-cutting docs pages at their source
paths, so both trees read the same. A checkout also gives the commit and branch, which are
written into every page header and into `sources.json`.

## Re-syncing after the kit changes

1. Pull the kit checkout to the revision the skill should describe.
2. `--from <kit> --write`, then read the run: the page count, the components in the manifest,
   and any `META-MISSING`.
3. If the kit's version moved, run the command the tool prints
   (`node tools/sync-sources.mjs --skill ui-kit --set-version <x.y.z>`).
4. Re-read the critical rules in `skills/ui-kit/SKILL.md` against the new pages. A rule the
   synced page now states in the same words is a candidate for deletion — delete it only when
   its eval assertion still passes without it.
5. `node skills/ui-kit/scripts/test-validator.mjs` and `node tools/sync-sources.mjs --check`.

## When --check fails

- `EDITED` — a page here no longer hashes to its own header: someone corrected the text in
  this repository. Move the correction into the kit's README and re-sync, or re-sync to throw
  it away.
- `DRIFT` — the kit's page and the copy differ. Re-sync; if the copy is what you wanted,
  the kit changed under you and the skill's rules may need reading again.
- `MISSING` / `STALE` — the kit gained or dropped a README. Re-sync, then check whether the
  routing table in `SKILL.md` still points at pages that exist.
- `NO-HASH` — a file under `references/components/` that this tool never wrote. Delete it or
  move it to a hand-written reference outside that directory.
- `META-MISSING` — the kit's README has no `ui-kit-doc` block, so the component is missing
  from the manifest. Fix it upstream against the kit's `README_TEMPLATE.md`.
- `LINK?` — a relative link in a synced page points at something this skill does not carry;
  it was rewritten to the file in the kit's repository at the synced commit. Expected for
  pages the skill has no copy of, and a signal to add one if it is read often.

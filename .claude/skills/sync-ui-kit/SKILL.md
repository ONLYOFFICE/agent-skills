---
name: sync-ui-kit
description: >
  Rebuild the ui-kit skill's component manifest from the ONLYOFFICE UI kit's own metadata.
  Use when docspace-ui-kit-react has changed and skills/ui-kit/scripts/data/kit-manifest.json
  must follow, when the kit releases a new version, when someone asks to "regenerate the kit
  manifest" or "update check-usage's view of the kit", and when
  `node tools/sync-ui-kit.mjs --from <kit> --check` fails in the release checklist.
  Repository-internal; not shipped in the plugin.
---

# Rebuild the ui-kit manifest from the kit

`skills/ui-kit/scripts/data/kit-manifest.json` is not written here. It is derived by
`tools/sync-ui-kit.mjs` from [`docspace-ui-kit-react`](https://github.com/ONLYOFFICE/docspace-ui-kit-react):
the `<!-- ui-kit-doc … -->` block of every component README (name, category, status, import
form, the prop that shows and hides the component), the portal-internal modules of
`docs/public-api.md`, and the root-barrel snapshot in `docs/plugin-surface.json`. It is the
data `check-usage.mjs` validates a project against.

The skill carries no copies of the kit's pages. An agent reads a component's README inside
the installed package, or its page on the docs site (`https://api.onlyoffice.com/docspace/ui-kit/`);
`SKILL.md` says in which order.

## Rules

- **Never edit the manifest by hand.** A wrong entry is a wrong metadata block in the kit: fix
  the component's README in `docspace-ui-kit-react`, then rebuild.
- **A README without a metadata block is absent from the manifest** and announced as
  `META-MISSING`; `--strict` turns that into a failure.
- The version the skill targets stays in `skills/ui-kit/sources.json` and is written into the
  text by `sync-sources.mjs`; this tool only reports when the kit's version has moved past it.
- Links to the kit's documentation in the skill point at the docs site and are checked by
  `node tools/sync-sources.mjs --skill ui-kit --check`; nothing here rewrites them.

## Commands

```
node tools/sync-ui-kit.mjs --from ../docspace-ui-kit-react --write   # rebuild the manifest
node tools/sync-ui-kit.mjs --from ../docspace-ui-kit-react --check   # exit 1 when it is out of date
node tools/sync-ui-kit.mjs --from ../docspace-ui-kit-react --dump    # print the derived manifest
```

`--from` takes a checkout of the kit or an installed `node_modules/@onlyoffice/apps-ui-kit`:
the package ships the component READMEs and the docs pages at their source paths, so both
trees read the same.

## After the kit changes

1. Pull the kit checkout to the revision the skill should describe.
2. `--from <kit> --write`, then read the run: the README count, the components in the manifest,
   and any `META-MISSING`.
3. If the kit's version moved, run the command the tool prints
   (`node tools/sync-sources.mjs --skill ui-kit --set-version <x.y.z>`).
4. Re-read the critical rules in `skills/ui-kit/SKILL.md` against the kit's pages. A rule the
   kit's page now states in the same words is a candidate for deletion — delete it only when
   its eval assertion still passes without it.
5. `node skills/ui-kit/scripts/test-validator.mjs` and `node tools/sync-sources.mjs --check`.

## When --check fails

- `DRIFT` — the manifest differs from what the kit now says. Run `--write` and read the diff:
  a new visibility prop, a component that changed status or import form, a new barrel leak.
- `META-MISSING` — a README has no `ui-kit-doc` block. Fix it upstream against the kit's
  `README_TEMPLATE.md`.
- `META-BAD` — the block is not JSON. Fix it upstream.
- `TREE` — a top-level module the tool lists as public is missing from the kit. Either the kit
  renamed it, or the list in the tool is stale.
- `NO-SURFACE` — the kit ships no `docs/plugin-surface.json`; the barrel leak was read from
  `uploader` and `billing` by pattern instead, which is less complete.

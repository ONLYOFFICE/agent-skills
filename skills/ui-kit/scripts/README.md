# scripts/

What the checker reports, where it gets its knowledge of the kit, and how both are kept
current. The command an agent runs is in the skill's [README](../README.md).

**`check-usage.mjs`** reads a project as text — no build, no network, nothing executed — and
reports what the kit itself never does. Errors are things that are already broken: a value
import from the root barrel, which does not build outside the portal; a visibility prop the
component ignores; a portal-internal import; `Providers`; a path into `dist/`; `PUBLIC_DIR`; a
missing provider; a `SearchInput` handler reading `.target.value` off a string. Warnings are the
silent traps: a field with no visible label, a caption attached to no control, a column whose
`gap` doubles the spacing, a `Loader` with no type, the whole-library stylesheet. It is written
for an application of its own: on a plugin it reports the portal's providers as missing, which
is why the `plugin-sdk` skill does not run it.

**`data/kit-manifest.json`** is what the checker knows about the kit — the visibility prop each
component expects, the portal-internal modules, which components are default exports on their
subpath — derived from the kit's own metadata by `tools/sync-ui-kit.mjs`, so those are facts
rather than a hand-kept list. That is also the limit: the manifest is only as right as the kit's
own README validator, which once rebuilt the barrel's names by hand.

```sh
node tools/sync-ui-kit.mjs --from <kit checkout or node_modules/@onlyoffice/apps-ui-kit> --check --strict   # has it drifted
node tools/sync-ui-kit.mjs --from <kit> --write                                                              # rebuild it
```

`--strict` also fails when a component README upstream has lost its metadata block, which would
silently drop that component from the manifest. If the kit's version moved, the run prints the
`sync-sources --set-version` command to follow it with.

**`test-validator.mjs`** builds twenty throwaway projects in the temp directory and asserts both
what each must report and what it must not, then checks the manifest for internal sense and runs
the link check offline. Given `--kit-project <dir with the kit installed>`, it also compares the
manifest with the installed kit and type-checks `../templates/*` against the kit's own types —
the templates are copied into projects verbatim, so a prop the kit renamed breaks every one of
them. A checkout of `docspace-ui-kit-react` beside this repository is compared with too, but only
when it is at the version the skill pins. Breaking one branch of the validator fails it.

On a kit release: `node tools/sync-ui-kit.mjs --from <kit> --write`, `node tools/sync-sources.mjs
--skill ui-kit --set-version <x.y.z>`, then read the rules in `SKILL.md` against the kit's pages.
The full checklist is in [RELEASING.md](../../../RELEASING.md).

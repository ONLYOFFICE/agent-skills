# scripts/

What each script does, and how they are kept in step with the SDK. The commands an agent runs
are in the skill's [README](../README.md); this page is for whoever maintains them.

**`probe-portal.mjs`** is Step 0 of the skill as a script: it reports which SDK bundles the
portal serves and whether the newest carries OAuth, the `X-Frame-Options` and `frame-ancestors`
headers on the frame pages, OAuth discovery, the CSP allow-list, and ends with a recommendation
(npm or portal script, modes available, what the admin must change). It is the one script here
that touches the network — only the portal named on the command line, reads only.

**`validate-config.mjs`** checks one `TFrameConfig` against the SDK's types and enums without a
portal: the required trio (`frameId`, `mode`, `src`), the mode-specific required fields (`id` for
editor/viewer, `id` + `requestToken` for public-room), enum values (`theme`, `viewAs`, `sortBy`
with hints for the common wrong spellings), boolean fields, unknown keys the SDK silently ignores,
the `editorCustomization` and `events` shapes, and a few cross-field contradictions. Exit code 0
means no errors (warnings allowed). Its dictionaries — `MODES`, `ENUMS`, `FILTER_ENUMS`,
`BOOLEAN_FIELDS`, `KNOWN_KEYS`, `KNOWN_FILTER_KEYS`, `KNOWN_CUSTOMIZATION_KEYS`, `KNOWN_EVENTS` —
are generated from the SDK's type declarations; `MODE_REQUIREMENTS` and `SORTBY_HINTS` are
hand-written.

**`sync-sdk.mjs`** regenerates those dictionaries from a checkout or an installed package and,
with `--check`, reports where they have drifted:

```sh
node sync-sdk.mjs --from node_modules/@onlyoffice/docspace-sdk-js --check
node sync-sdk.mjs --from node_modules/@onlyoffice/docspace-sdk-js --write
```

It parses the SDK's `.d.ts` files with regular expressions, so it has to be re-checked when the
type declarations change shape.

**`test-validator.mjs`** runs the validator over known-good and known-bad configs and asserts the
verdicts and the messages that matter, runs `sync-sources --check` for the skill, and compares
the dictionaries with the SDK the skill pins: `--from <dir>` names a checkout at the matching tag
or an installed package; without it, an installed `@onlyoffice/docspace-sdk-js` found up the
directory chain is used, and with neither that comparison is skipped.

On every SDK release: `node tools/sync-sources.mjs --skill apps-embed-sdk --set-version <x.y.z>`,
`sync-sdk.mjs --write` from the released package, read the release changelog and revise the
references that describe behaviour (`config-reference.md` keeps only what the types do not say —
defaults, which mode reads a field, traps), run the self-test, then the
[evals](../evals/README.md). The full checklist is in [RELEASING.md](../../../RELEASING.md).

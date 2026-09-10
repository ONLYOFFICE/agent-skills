# ONLYOFFICE Apps Embed SDK skill

A skill that teaches an AI coding agent to embed ONLYOFFICE Apps into a web application
with the Embed SDK (`@onlyoffice/docspace-sdk-js`, historically "JavaScript SDK"): a file
manager, an editor or viewer, a room or file selector, an uploader, the forms gallery, AI
chat or a personal files section, each an iframe configured by a `TFrameConfig` and driven
through promise-based instance methods and frame events.

The SDK fails quietly. A `sortBy: "Name"` renders an unsorted list; `login()` resolves on a
wrong password and the code that awaited it carries on; a selector returns its room inside
`items[0]` and the share token two levels deeper; a manager frame has no `upload()` to call;
a React StrictMode double mount breaks the frame in development only. This skill encodes
those rules, asks for the portal's SDK version before any code is written, and checks
configs offline. The body is [`SKILL.md`](SKILL.md).

## Installing it

As part of the `onlyoffice` plugin — see [Install](../../README.md#install) in the root
README. On its own: copy this directory to where your agent scans for skills (for example
`~/.claude/skills/embed-sdk/`), or hand it `SKILL.md`.

## Tools

```sh
node skills/embed-sdk/scripts/probe-portal.mjs https://portal.example.com --origin https://app.example.com
node skills/embed-sdk/scripts/validate-config.mjs '<TFrameConfig JSON>'   # or a file path, or stdin
node skills/embed-sdk/scripts/test-validator.mjs
node skills/embed-sdk/scripts/sync-sdk.mjs --from node_modules/@onlyoffice/docspace-sdk-js --check
```

The **portal probe** is Step 0 of the skill as a script: it reports which SDK bundles the
portal serves and whether the newest carries OAuth, the `X-Frame-Options` and
`frame-ancestors` headers on the frame pages, OAuth discovery, the CSP allow-list, and ends
with a recommendation (npm or portal script, modes available, what the admin must change).
It is the one script here that touches the network — only the portal you name, reads only.

The **validator** checks one `TFrameConfig` against the SDK's types and enums without a
portal: the required trio (`frameId`, `mode`, `src`), the mode-specific required fields
(`id` for editor/viewer, `id` + `requestToken` for public-room), enum values (`theme`, `viewAs`,
`sortBy` with hints for the common wrong spellings), boolean fields, unknown keys the SDK
silently ignores, the `editorCustomization` and `events` shapes, and a few cross-field
contradictions. Exit code 0 means no errors (warnings allowed).

The **self-test** runs the validator over known-good and known-bad configs and asserts the
verdicts and the messages that matter.

## What it targets

Embed SDK **2.2.0** from npm as the default connection. It also documents connecting through
the portal's own script (`/static/scripts/sdk/{version}/api.js`) for pages without a build
step and for portals older than the package, because the portal, not the npm package,
decides which methods exist. Beyond the SDK contract it records the portal behaviours that
break real integrations and that no type expresses: which of the five "tokens" does what,
why a cross-origin frame answers 401 with a live session, why `login()` cannot pass 2FA,
what the chat page needs before it renders, and what the manager events actually carry.
Node >= 18.

## Layout

```
SKILL.md      the skill: pinned facts, discovery, routing table, critical rules
references/   config-reference (fields by mode), one file per mode, methods, events,
              editor automation, auth recipes, testing, framework recipes
scripts/      validate-config.mjs and its self-test
evals/        the A/B protocol: task prompt, operator guide, rubric — a maintenance tool,
              not read by agents
```

## Maintaining it

The validator's dictionaries (`MODES`, `ENUMS`, `FILTER_ENUMS`, `BOOLEAN_FIELDS`,
`KNOWN_KEYS`, `KNOWN_FILTER_KEYS`, `KNOWN_CUSTOMIZATION_KEYS`, `KNOWN_EVENTS`) are generated
from the SDK's type declarations by `scripts/sync-sdk.mjs`; `MODE_REQUIREMENTS` and
`SORTBY_HINTS` are hand-written. External links and the pinned version are declared in
`sources.json` and checked by `node tools/sync-sources.mjs --skill embed-sdk --check`.
On every SDK release: `node tools/sync-sources.mjs --skill embed-sdk --set-version <x.y.z>`,
`node scripts/sync-sdk.mjs --from <sdk checkout or node_modules package> --write`, read the
release changelog and update the references that describe behaviour, run the self-test,
then the [evals](evals/README.md). `references/config-reference.md` keeps only what the types
do not say (defaults, which mode reads a field, traps) and is revised by hand.

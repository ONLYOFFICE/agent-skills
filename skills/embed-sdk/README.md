# DocSpace Embed SDK skill

A skill that teaches an AI coding agent to embed ONLYOFFICE DocSpace into a web application
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

```
npx skills add ONLYOFFICE/agent-skills
```

Claude Code: `claude --plugin-dir /path/to/agent-skills`, or copy this directory to
`~/.claude/skills/embed-sdk/`. Any other agent: copy this directory where it scans, or hand
it `SKILL.md`.

## Tools

```sh
node skills/embed-sdk/scripts/validate-config.mjs '<TFrameConfig JSON>'   # or a file path, or stdin
node skills/embed-sdk/scripts/test-validator.mjs
```

The **validator** checks one `TFrameConfig` against the SDK's types and enums without a
portal: the required trio (`frameId`, `mode`, `src`), the mode-specific required fields
(`id` for editor/viewer, `requestToken` for public-room), enum values (`theme`, `viewAs`,
`sortBy` with hints for the common wrong spellings), boolean fields, unknown keys the SDK
silently ignores, the `editorCustomization` and `events` shapes, and a few cross-field
contradictions. Exit code 0 means no errors (warnings allowed).

The **self-test** runs the validator over known-good and known-bad configs and asserts the
verdicts and the messages that matter.

## What it targets

Embed SDK **2.2.0**. It also documents connecting through the portal's own script
(`/static/scripts/sdk/{version}/api.js`), because the portal, not the npm package, decides
which methods exist. Node >= 18.

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

`references/config-reference.md` and the dictionary at the top of
`scripts/validate-config.mjs` (`MODES`, `ENUMS`, `FILTER_ENUMS`, `KNOWN_KEYS`,
`KNOWN_EVENTS`, `KNOWN_CUSTOMIZATION_KEYS`, `MODE_REQUIREMENTS`) are hand-synced with
`src/types` and `src/enums` of the [SDK repository](https://github.com/ONLYOFFICE/docspace-sdk-js).
On every SDK release: diff those sources, update both, bump `metadata.sdk-version` in
`SKILL.md` and the version in its "Pinned facts" section, run the self-test, then the
[evals](evals/README.md).

# ONLYOFFICE Agent Skills

Agent Skills that teach AI coding agents (Claude Code, Cursor, GitHub Copilot, Codex and
other [Agent Skills](https://agentskills.io)-compatible clients) how to build
integrations with [ONLYOFFICE](https://www.onlyoffice.com) developer SDKs and tools.

## What's inside

Two skills today; the repository layout (`skills/<name>/`) is ready for more.

| Skill | Purpose |
|---|---|
| [`embed-sdk`](skills/embed-sdk/SKILL.md) | Embedding DocSpace into web apps with the [Embed SDK](https://api.onlyoffice.com/docspace/javascript-sdk/get-started/) ([`@onlyoffice/docspace-sdk-js`](https://github.com/ONLYOFFICE/docspace-sdk-js)): mode selection, `TFrameConfig`, authentication (password hash flow, OAuth `getToken`, public room tokens), frame events, instance methods, editor automation, troubleshooting |
| [`plugin-sdk`](skills/plugin-sdk/SKILL.md) | Building, auditing and explaining DocSpace plugins with the [Plugins SDK](https://api.onlyoffice.com/docspace/plugins-sdk/get-started/) ([`@onlyoffice/docspace-plugin-sdk`](https://github.com/ONLYOFFICE/docspace-plugin-sdk)): the ten scopes, item shapes and filters, actions and payloads, declarative UI, host behaviour, plus offline scripts that scaffold a buildable project and check one against the portal loader contract |

`embed-sdk` targets **SDK 2.2.0**; `plugin-sdk` targets **SDK 2.1.0 with DocSpace 4.0**.
Both follow the router pattern: `SKILL.md` holds the decision tables and critical rules;
details live in `references/` and are loaded on demand.

Effectiveness is measured, not assumed. The A/B protocol in [`evals/`](evals/README.md)
compares the same `embed-sdk` integration task with and without the skill against a
39-checkpoint rubric; `plugin-sdk` carries its own graded scenarios and grader in
[`skills/plugin-sdk/evals/`](skills/plugin-sdk/evals/README.md). Run them after
substantial content changes.

## Install

**Any agent via the skills CLI:**

```
npx skills add ONLYOFFICE/agent-skills
```

**Manual (any client):** copy `skills/<name>/` into your project's skills directory
(e.g. `.claude/skills/embed-sdk/`).

**Claude Code (local plugin):**

```
claude --plugin-dir /path/to/agent-skills
```

The Claude Code marketplace channel (`/plugin marketplace add ONLYOFFICE/agent-skills`)
is prepared but not yet enabled — see the publishing checklist below.

## Layout

```
.claude-plugin/          plugin + marketplace manifests
skills/embed-sdk/
├── SKILL.md             router: pinned facts, discovery, routing table, critical rules
├── references/
│   ├── config-reference.md    TFrameConfig fields by mode (kept in sync with SDK types)
│   ├── modes/                 one file per SDK mode
│   ├── methods.md             SDKInstance methods + return semantics
│   ├── events.md              TFrameEvents payload shapes
│   ├── editor-automation.md   executeInEditor / connector pitfalls
│   ├── auth-recipes.md        production authentication recipes
│   ├── testing.md             e2e-testing embedded frames
│   └── frameworks/            React / Next.js / Vue / Angular recipes
└── scripts/
    └── validate-config.mjs    offline TFrameConfig validator
skills/plugin-sdk/
├── SKILL.md             router: build / audit / explain, scope tables, critical rules
├── references/          SDK contract, item shapes, UI, host behaviour, REST API, recipes
├── scripts/             generate-plugin, validate-plugin, test-validator + contract.mjs
├── templates/           build configs for generated projects
└── evals/               graded scenarios, fixture plugins and a grader
evals/                   A/B evaluation protocol for embed-sdk (task, rubric, operator guide)
```

## Development

- Content language is English (it is read by models).
- `skills/embed-sdk/references/config-reference.md` and its validator dictionary must be
  kept in sync with `src/types` / `src/enums` of the Embed SDK repository — regenerate on
  every SDK release. For `plugin-sdk` the equivalent single source is
  `skills/plugin-sdk/scripts/contract.mjs`, imported by both its generator and its
  validator; the version pair it targets lives in `references/sdk-target.md`.
- Validate the plugin before publishing: `claude plugin validate . --strict`.
- Quality gate: run the A/B protocol in [`evals/`](evals/README.md) after substantial
  content changes.

### Publishing checklist (for the release owner)

1. `claude plugin validate . --strict` must pass.
2. Push to `ONLYOFFICE/agent-skills` on GitHub — the install commands above and
   `.claude-plugin/*.json` already assume that path.
2a. To open the Claude Code marketplace channel, rename
   `.claude-plugin/marketplace.json.disabled` back to `marketplace.json`, re-run the
   validation, and update the Install section above — that single file is what makes
   the repo installable via `/plugin marketplace add ONLYOFFICE/agent-skills`.
3. Set up CI: validate on push + a reminder to re-sync `metadata.sdk-version` in each
   skill's `SKILL.md` frontmatter and `.claude-plugin/plugin.json` `version` on every
   SDK release.
4. Not yet built (tracked, optional): `tools/generate-skill-refs.mjs` to generate
   `config-reference.md` and the validator dictionary from the SDK sources instead of
   maintaining them by hand.

## License

Apache-2.0. See [LICENSE](LICENSE).

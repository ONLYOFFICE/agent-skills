# ONLYOFFICE Agent Skills

Agent Skills that teach AI coding agents (Claude Code, Cursor, GitHub Copilot, Codex and
other [Agent Skills](https://agentskills.io)-compatible clients) how to build
integrations with [ONLYOFFICE](https://www.onlyoffice.com) developer SDKs and tools.

## What's inside

One plugin, `onlyoffice`, with one skill per SDK under `skills/<name>/`. This table is
the list of skills; the plugin manifests only point here.

| Skill | Targets | Purpose |
|---|---|---|
| [`embed-sdk`](skills/embed-sdk/SKILL.md) | Embed SDK **2.2.0** | Embedding DocSpace into web apps with the [Embed SDK](https://api.onlyoffice.com/docspace/javascript-sdk/get-started/) ([`@onlyoffice/docspace-sdk-js`](https://github.com/ONLYOFFICE/docspace-sdk-js)): mode selection, `TFrameConfig`, authentication (password hash flow, OAuth `getToken`, public room tokens), frame events, instance methods, editor automation, troubleshooting |
| [`plugin-sdk`](skills/plugin-sdk/SKILL.md) | Plugins SDK **3.0.0**, DocSpace **4.0** | Building, auditing and explaining DocSpace plugins with the [Plugins SDK](https://api.onlyoffice.com/docspace/plugins-sdk/get-started/) ([`@onlyoffice/docspace-plugin-sdk`](https://github.com/ONLYOFFICE/docspace-plugin-sdk)): React components built from the portal's `@docspace/ui-kit`, the plugin runtime hooks, the eleven scopes, item shapes and filters, actions and payloads, host behaviour, plus offline scripts that scaffold a buildable Vite project and check one against the portal loader contract |

Every skill follows the router pattern: `SKILL.md` holds the decision tables and critical
rules; details live in `references/` and are loaded on demand. Each skill carries its own
`evals/` — the same task run with and without the skill, graded against a rubric — and
those, not intuition, decide whether a change to the skill text stays.

## Install

**Any agent via the skills CLI:**

```
npx skills add ONLYOFFICE/agent-skills
```

**Manual (any client):** copy `skills/<name>/` into your project's skills directory
(e.g. `.claude/skills/embed-sdk/`).

**Claude Code (marketplace):**

```
/plugin marketplace add ONLYOFFICE/agent-skills
/plugin install onlyoffice@onlyoffice-skills
```

Until the public GitHub mirror exists, point the first command at the internal remote
instead (`/plugin marketplace add git@git.onlyoffice.com:ONLYOFFICE/agent-skills.git`);
the marketplace is the repository itself, so it is available exactly to those who can
clone it.

**Claude Code (local checkout):**

```
claude --plugin-dir /path/to/agent-skills
```

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
├── scripts/             validate-config.mjs (offline TFrameConfig validator) + its self-test
└── evals/               A/B evaluation protocol (task, rubric, operator guide)
skills/plugin-sdk/
├── SKILL.md             router: build / audit / explain, scope tables, critical rules
├── references/          SDK target and contract, React runtime, UI kit, item shapes, host behaviour, REST API, reading SDK 2 plugins
├── scripts/             generate-plugin, validate-plugin, test-validator + contract.mjs
├── templates/           Vite/TS config for generated projects
├── vendor/              packed @docspace/ui-kit (+ the tarballs it needs), copied into every generated project
└── evals/               graded scenarios and the fixture plugin one of them starts from
```

## Development

- What a skill directory must contain and how changes are judged: [CONTRIBUTING.md](CONTRIBUTING.md).
- Validate the plugin before pushing: `claude plugin validate . --strict`; run
  `node skills/<name>/scripts/test-validator.mjs` for every skill that has a validator.
- Quality gate: run a skill's evals after substantial content changes
  ([embed-sdk](skills/embed-sdk/evals/README.md),
  [plugin-sdk](skills/plugin-sdk/evals/README.md)).
- Versions, names, what counts as publishing and the release checklist:
  [RELEASING.md](RELEASING.md).

## License

Apache-2.0. See [LICENSE](LICENSE).

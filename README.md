# ONLYOFFICE Agent Skills

Agent Skills that teach AI coding agents (Claude Code, Cursor, GitHub Copilot, Codex and
other [Agent Skills](https://agentskills.io)-compatible clients) how to build
integrations with [ONLYOFFICE](https://www.onlyoffice.com) developer SDKs and tools.

## What's inside

One plugin, `onlyoffice`, with one skill per SDK under `skills/<name>/`. This table is
the list of skills; the plugin manifests only point here.

| Skill | Targets | Purpose |
|---|---|---|
| [`embed-sdk`](skills/embed-sdk/SKILL.md) | Embed SDK **2.2.0** | Embedding ONLYOFFICE Apps (formerly DocSpace) into web apps with the [Embed SDK](https://api.onlyoffice.com/docspace/javascript-sdk/get-started/) ([`@onlyoffice/docspace-sdk-js`](https://github.com/ONLYOFFICE/docspace-sdk-js)): mode selection, `TFrameConfig`, authentication (password hash flow, OAuth `getToken`, public room tokens), frame events, instance methods, editor automation, troubleshooting |
| [`plugin-sdk`](skills/plugin-sdk/SKILL.md) | Plugins SDK **3.0.0**, ONLYOFFICE Apps **4.0** | Building, auditing and explaining ONLYOFFICE Apps plugins with the [Plugins SDK](https://api.onlyoffice.com/docspace/plugins-sdk/get-started/) ([`@onlyoffice/docspace-plugin-sdk`](https://github.com/ONLYOFFICE/docspace-plugin-sdk)): React components built from the portal's `@onlyoffice/apps-ui-kit`, the plugin runtime hooks, the eleven scopes, item shapes and filters, actions and payloads, host behaviour, plus offline scripts that scaffold a buildable Vite project and check one against the portal loader contract |
| [`ui-kit`](skills/ui-kit/SKILL.md) | UI kit **4.0.0** | Building React 19 screens in your own application with the ONLYOFFICE UI kit ([`@onlyoffice/apps-ui-kit`](https://github.com/ONLYOFFICE/docspace-ui-kit-react), the public name of the portal's `@docspace/ui-kit`): setting it up (the two providers, and why the stylesheet needs no import), which of the 98 components fits a job, barrel versus subpath imports, the boundary between the public components and the portal-internal modules, per-component pages synced from the kit's own READMEs, and an offline check of a project's kit usage |

Every skill follows the router pattern: `SKILL.md` holds the decision tables and critical
rules; details live in `references/` and are loaded on demand. Each skill carries its own
`evals/` — the same task run with and without the skill, graded against a rubric — and
those, not intuition, decide whether a change to the skill text stays.

The plugin also ships an MCP server, `docspace`, over HTTP at
`https://mcp.onlyoffice.com/mcp` (declared in [`.mcp.json`](.mcp.json)). It gives the
agent live access to an ONLYOFFICE Apps workspace alongside the skills' static knowledge. The
endpoint requires authentication (it answers `401` to an unauthenticated `initialize`);
in Claude Code, run `/mcp` and authenticate the `docspace` server before first use.

The server is installed with the plugin. The manual and `npx skills add` install paths
copy skills only, so it has to be added by hand there:
`claude mcp add --transport http docspace https://mcp.onlyoffice.com/mcp`.

## Install

Pick your agent. Every path below ends with `skills/<name>/` (the directory holding a
`SKILL.md`) in a place the agent scans; the agent picks the skill up on its own.

### Claude Code

Install as a plugin — it stays updatable through `/plugin`, and the skills appear as
`onlyoffice:embed-sdk`, `onlyoffice:plugin-sdk` and `onlyoffice:ui-kit`:

```
/plugin marketplace add git@git.onlyoffice.com:ONLYOFFICE/agent-skills.git
/plugin install onlyoffice@onlyoffice-skills
```

To try a local checkout without installing: `claude --plugin-dir /path/to/agent-skills`.

In the VS Code extension, type `/plugins` in the chat: add this repository on the
*Marketplaces* tab, then install `onlyoffice` on the *Plugins* tab.

### Cursor

Cursor reads `.cursor/skills/` and `.agents/skills/` in the project, `~/.cursor/skills/`
for the user:

```bash
git clone git@git.onlyoffice.com:ONLYOFFICE/agent-skills.git
cp -r agent-skills/skills/* .cursor/skills/
```

### Codex

Codex reads `.agents/skills/` in the repository and `~/.agents/skills/` for the user:

```bash
git clone git@git.onlyoffice.com:ONLYOFFICE/agent-skills.git
cp -r agent-skills/skills/* .agents/skills/
```

### GitHub Copilot

Copilot reads `.github/skills/` (also `.agents/skills/` and `.claude/skills/`) in the
repository and `~/.copilot/skills/` for the user:

```bash
git clone git@git.onlyoffice.com:ONLYOFFICE/agent-skills.git
cp -r agent-skills/skills/* .github/skills/
```

### Other agents

Any client that reads [Agent Skills](https://agentskills.io) works: clone the repository
and copy `skills/<name>/` into the directory your agent scans, or hand it
`skills/<name>/SKILL.md` directly. `.agents/skills/` is read by Cursor, Codex and Copilot
alike — the one directory to use when a project mixes agents.

## Layout

```
.claude-plugin/          plugin + marketplace manifests
.claude/skills/          repository-internal skills (sync-sources) — not shipped in the plugin
.mcp.json                MCP servers shipped with the plugin (docspace, HTTP)
sources.json             the external hosts (docs site, GitHub, raw files, demo) named once for every skill;
                         `node tools/sync-sources.mjs --host apiSite=<origin>` points the whole plugin at a staging or local docs build
tools/                   sync-sources.mjs: every link and pinned version traces to the root hosts and a skill's sources.json
                         sync-ui-kit.mjs: copies the UI kit's own component READMEs into skills/ui-kit and derives its manifest
skills/embed-sdk/
├── SKILL.md             router: pinned facts, discovery, routing table, critical rules
├── sources.json         SDK version, which hosts it links to and at which paths, placeholder hosts
├── references/
│   ├── config-reference.md    TFrameConfig fields by mode (kept in sync with SDK types)
│   ├── modes/                 one file per SDK mode
│   ├── methods.md             SDKInstance methods + return semantics
│   ├── events.md              TFrameEvents payload shapes
│   ├── editor-automation.md   executeInEditor / connector pitfalls
│   ├── auth-recipes.md        production authentication recipes
│   ├── testing.md             e2e-testing embedded frames
│   └── frameworks/            React / Next.js / Vue / Angular recipes
├── scripts/             probe-portal.mjs (Step 0 as a script), validate-config.mjs + its self-test,
│                        sync-sdk.mjs (validator dictionaries from the SDK types)
└── evals/               A/B evaluation protocol (task, rubric, operator guide)
skills/plugin-sdk/
├── SKILL.md             router: which job, scope table, the Explain job, the checklist of rules
├── references/          build and audit workflows, SDK target and contract, React runtime, UI kit, item shapes, host behaviour, REST API, reading SDK 2 plugins
├── scripts/             generate-plugin, validate-plugin, preview-plugin, test-validator + contract.mjs
├── templates/           Vite/TS config for generated projects
├── vendor/              packed @onlyoffice/apps-ui-kit and SDK, copied into every generated project
└── evals/               graded scenarios, the fixture plugin one of them starts from, trigger tests
skills/ui-kit/
├── SKILL.md             router: pinned facts, discovery, routing table, critical rules
├── sources.json         kit version, the commit the synced pages came from, hosts it links to
├── references/          setup, choosing, forms, overlays, lists, theming, i18n, testing, public API, troubleshooting
│   └── components/      115 pages synced from docspace-ui-kit-react — regenerate, never edit
├── scripts/             check-usage.mjs + its self-test, and data/kit-manifest.json derived by the sync
├── templates/           the entry point and the provider composition, copied into a project
└── evals/               graded scenarios, the bare Vite app they build on, trigger tests
```

## Development

- What a skill directory must contain and how changes are judged: [CONTRIBUTING.md](CONTRIBUTING.md).
- Validate the plugin before pushing, with both forms: `claude plugin validate . --strict`
  checks the marketplace manifest and stops there, and `claude plugin validate skills --strict`
  is what reads the `SKILL.md` files. Then run
  `node skills/<name>/scripts/test-validator.mjs` for every skill that has a validator, and
  `node tools/sync-ui-kit.mjs --check` to confirm no synced page was edited here.
- Quality gate: run a skill's evals after substantial content changes
  ([embed-sdk](skills/embed-sdk/evals/README.md),
  [plugin-sdk](skills/plugin-sdk/evals/README.md),
  [ui-kit](skills/ui-kit/evals/README.md)).
- Versions, names, what counts as publishing and the release checklist:
  [RELEASING.md](RELEASING.md).

## License

Apache-2.0. See [LICENSE](LICENSE).

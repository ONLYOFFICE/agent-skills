# ONLYOFFICE Agent Skills

Skills that teach AI coding agents — Claude Code, Cursor, GitHub Copilot, Codex and any other
client of the open [Agent Skills](https://agentskills.io) format — how to build on the ONLYOFFICE
developer SDKs. Install them once. When a task matches, the agent loads the right skill on its
own, reads the SDK's documentation and types, applies the rules the documentation cannot state,
and checks its work with the scripts the skill carries.

## Skills

| Skill | Ask for | What the agent does | Targets |
|---|---|---|---|
| [`embed-sdk`](skills/embed-sdk/README.md) | "embed our DocSpace file manager in the CRM", "open a document from our page in an editor frame", "why does the embedded frame answer 401" | Embeds ONLYOFFICE Apps (formerly DocSpace) into a web page with the [Embed SDK](https://api.onlyoffice.com/docspace/javascript-sdk/get-started): probes the portal, picks the mode, writes the frame config and the sign-in flow, validates the config offline | Embed SDK **2.2.0** |
| [`plugin-sdk`](skills/plugin-sdk/README.md) | "a context menu action that converts the selected file", "a page in the sidebar listing our rooms", "my plugin installs but the item never appears" | Builds, audits and explains portal plugins with the [Plugins SDK](https://api.onlyoffice.com/docspace/plugins-sdk/get-started): scaffolds a Vite + React project, validates it against the portal's loader, renders every surface in a browser | Plugins SDK **3.0.0**, ONLYOFFICE Apps **4.0** |
| [`ui-kit`](skills/ui-kit/README.md) | "a settings form like the portal's", "a dialog in the DocSpace style in our admin", "the kit's labels are blank" | Builds React 19 screens in your own application with the [ONLYOFFICE UI kit](https://api.onlyoffice.com/docspace/ui-kit/getting-started): picks the components, mounts the providers, uses the prop names the kit reads, checks the result | UI kit **4.0.1** |

Every skill is a `SKILL.md` the agent reads whole, a `references/` folder it reads on demand, and
`scripts/` it runs — Node only, no dependencies, offline except where a script says which host it
reads.

## Install

### Claude Code

Install the `onlyoffice` plugin; it stays updatable through `/plugin`, and the skills appear as
`onlyoffice:embed-sdk`, `onlyoffice:plugin-sdk` and `onlyoffice:ui-kit`:

```
/plugin marketplace add git@git.onlyoffice.com:ONLYOFFICE/agent-skills.git
/plugin install onlyoffice@onlyoffice-skills
```

In the VS Code extension, type `/plugins` in the chat: add this repository on the *Marketplaces*
tab, then install `onlyoffice` on the *Plugins* tab. To try a local checkout without installing:
`claude --plugin-dir /path/to/agent-skills`.

The plugin also ships the ONLYOFFICE Apps MCP server, `docspace`, at
`https://mcp.onlyoffice.com/mcp`, which gives the agent live access to a workspace beside the
skills' static knowledge. It requires a sign-in (an unauthenticated request gets `401`): run
`/mcp` once and authenticate it.

### Cursor, Codex, GitHub Copilot and other agents

Clone the repository and copy `skills/*` into a directory your agent scans. `.agents/skills/` in
a project is read by Cursor, Codex and Copilot alike:

```bash
git clone git@git.onlyoffice.com:ONLYOFFICE/agent-skills.git
cp -r agent-skills/skills/* .agents/skills/
```

Each agent also reads its own directories: `.cursor/skills/` and `~/.cursor/skills/` (Cursor),
`~/.agents/skills/` (Codex), `.github/skills/` and `~/.copilot/skills/` (Copilot). Any other client
of the Agent Skills format can be handed `skills/<name>/SKILL.md` directly. These install paths
copy skills only; add the MCP server the way your agent adds any HTTP MCP server
(`claude mcp add --transport http docspace https://mcp.onlyoffice.com/mcp` in Claude Code).

## What you need

- Node 18 or newer, for the scripts the skills run.
- npm access, for a plugin or a UI kit project the agent scaffolds.
- An ONLYOFFICE Apps workspace — the cloud or your own installation — to probe, embed into or
  upload a plugin to. The skills work without one; the final checks need one.

## Documentation

- [Embed SDK](https://api.onlyoffice.com/docspace/javascript-sdk/get-started) ·
  [Plugins SDK](https://api.onlyoffice.com/docspace/plugins-sdk/get-started) ·
  [UI kit](https://api.onlyoffice.com/docspace/ui-kit/getting-started) ·
  [REST API](https://api.onlyoffice.com/docspace/api-backend/get-started/basic-concepts)
- Changing or adding a skill: [CONTRIBUTING.md](CONTRIBUTING.md); checking one:
  [TESTING.md](TESTING.md); releasing: [RELEASING.md](RELEASING.md).

## License

Apache-2.0. See [LICENSE](LICENSE).

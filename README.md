# ONLYOFFICE Agent Skills

Skills that teach AI coding agents — Claude Code, Cursor, GitHub Copilot, Codex and any other
client of the open [Agent Skills](https://agentskills.io) format — how to build on the ONLYOFFICE
developer SDKs. Install them once. When a task matches, the agent loads the right skill on its
own, reads the SDK's documentation and types, applies the rules the documentation cannot state,
and checks its work with the scripts the skill carries.

## Skills

| Skill | Ask for | What the agent does | Targets |
|---|---|---|---|
| [`apps-embed-sdk`](skills/apps-embed-sdk/README.md) | "embed our DocSpace file manager in the CRM", "open a document from our page in an editor frame", "why does the embedded frame answer 401" | Embeds ONLYOFFICE Apps (formerly DocSpace) into a web page with the [Embed SDK](https://api.onlyoffice.com/docspace/javascript-sdk/get-started): probes the portal, picks the mode, writes the frame config and the sign-in flow, validates the config offline | Embed SDK **2.2.0** |
| [`apps-plugin-sdk`](skills/apps-plugin-sdk/README.md) | "a context menu action that converts the selected file", "a page in the sidebar listing our rooms", "my plugin installs but the item never appears" | Builds, audits and explains portal plugins with the [Plugins SDK](https://api.onlyoffice.com/docspace/plugins-sdk/get-started): scaffolds a Vite + React project, validates it against the portal's loader, renders every surface in a browser | Plugins SDK **3.0.0**, ONLYOFFICE Apps **4.0** |
| [`apps-ui-kit`](skills/apps-ui-kit/README.md) | "a settings form like the portal's", "a dialog in the DocSpace style in our admin", "the kit's labels are blank" | Builds React 19 screens in your own application with the [ONLYOFFICE UI kit](https://api.onlyoffice.com/docspace/ui-kit/getting-started): picks the components, mounts the providers, uses the prop names the kit reads, checks the result | UI kit **4.0.1** |

Every skill is a `SKILL.md` the agent reads whole, a `references/` folder it reads on demand, and
`scripts/` it runs — Node only, no dependencies. What reaches the network is listed under
[What the skills run, send and fetch](#what-the-skills-run-send-and-fetch).

## Install

### Claude Code

Install the `onlyoffice-devtools` plugin from the ONLYOFFICE marketplace,
[ONLYOFFICE/agent-plugins](https://github.com/ONLYOFFICE/agent-plugins); it stays updatable through
`/plugin`, and the skills appear as `onlyoffice-devtools:apps-embed-sdk`,
`onlyoffice-devtools:apps-plugin-sdk` and `onlyoffice-devtools:apps-ui-kit`:

```
/plugin marketplace add ONLYOFFICE/agent-plugins
/plugin install onlyoffice-devtools@onlyoffice
```

In the VS Code extension, type `/plugins` in the chat: add `ONLYOFFICE/agent-plugins` on the
*Marketplaces* tab, then install `onlyoffice-devtools` on the *Plugins* tab.
`/plugin update onlyoffice-devtools@onlyoffice` installs a newer release. To try a local checkout
without installing: `claude --plugin-dir /path/to/agent-skills`.

### Codex and the ChatGPT desktop app

```
codex plugin marketplace add ONLYOFFICE/agent-plugins
```

Then install `onlyoffice-devtools` from the `ONLYOFFICE` marketplace in the plugin list.
`codex plugin marketplace upgrade onlyoffice` fetches a newer release.

### GitHub Copilot CLI

Copilot CLI reads the same marketplace as Claude Code:

```
copilot plugin marketplace add ONLYOFFICE/agent-plugins
copilot plugin install onlyoffice-devtools@onlyoffice
```

### Cursor and other agents

Clone the repository and copy `skills/*` into a directory your agent scans. `.agents/skills/` in
a project is read by Cursor, Codex and Copilot alike:

```bash
git clone --branch plugin --depth 1 https://github.com/ONLYOFFICE/agent-skills
mkdir -p .agents/skills
cp -r agent-skills/skills/* .agents/skills/
```

Each agent also reads its own directories: `.cursor/skills/` and `~/.cursor/skills/` (Cursor),
`~/.agents/skills/` (Codex), `.github/skills/` and `~/.copilot/skills/` (Copilot). Any other client
of the Agent Skills format can be handed `skills/<name>/SKILL.md` directly.

## What you need

- Node 18 or newer, for the scripts the skills run.
- npm access, for a plugin or a UI kit project the agent scaffolds.
- An ONLYOFFICE Apps workspace — the cloud or your own installation — to probe, embed into or
  upload a plugin to. The skills work without one; the final checks need one.

## What the skills run, send and fetch

The skills collect nothing and send no telemetry; no script reads or stores credentials. Every
script works on local files and stays offline, except for these:

- **`apps-embed-sdk/scripts/probe-portal.mjs`** sends `HEAD` and `GET` requests to the portal named
  on its command line, and to no other host: the SDK bundles, the frame headers of three SDK
  pages, OAuth discovery and the CSP allow-list endpoint. It sends no credentials and no request
  body.
- **The documentation.** The agent reads the SDKs' pages on `api.onlyoffice.com`, the Embed SDK's
  type definitions on `raw.githubusercontent.com`, and, when it weighs a dependency, its download
  count on `api.npmjs.org`.
- **`npm install`.** A plugin project that `apps-plugin-sdk` scaffolds, and an application that
  `apps-ui-kit` adds the UI kit to, install their packages from the npm registry. The agent runs
  the install in your project; the scripts never do.
- **`apps-plugin-sdk/scripts/preview-plugin.mjs`** needs Playwright and its Chromium, which
  `npx playwright install chromium` downloads. It serves the plugin from a Vite server on
  `127.0.0.1` and opens it in that browser; nothing leaves the machine.

## Documentation

- [Embed SDK](https://api.onlyoffice.com/docspace/javascript-sdk/get-started) ·
  [Plugins SDK](https://api.onlyoffice.com/docspace/plugins-sdk/get-started) ·
  [UI kit](https://api.onlyoffice.com/docspace/ui-kit/getting-started) ·
  [REST API](https://api.onlyoffice.com/docspace/api-backend/get-started/basic-concepts)
- Changing or adding a skill: [CONTRIBUTING.md](CONTRIBUTING.md); checking one:
  [TESTING.md](TESTING.md); releasing: [RELEASING.md](RELEASING.md).

## License

Apache-2.0. See [LICENSE](LICENSE).

# ONLYOFFICE Apps plugin skill

Teaches an AI coding agent to build, audit and explain ONLYOFFICE Apps (formerly DocSpace)
plugins: React components built from the portal's own UI kit, registered through the Plugins
SDK (`@onlyoffice/docspace-plugin-sdk`). Describe the feature and the agent produces a built,
validated project with an uploadable `dist/plugin.zip`.

**Ask for** things like "a context menu action that pushes the selected file to our archive",
"a page in the sidebar listing our rooms", "an admin settings form for our API key", "my plugin
installs but the item never appears", "review this plugin before we ship it".

**What the agent does.** It picks the scopes a feature needs, scaffolds a Vite + React 19
project, writes the class and the components from the references, builds, validates the result
the way the portal's loader will read it, renders every surface in a browser in both themes,
and reports what it checked. The portal reports almost nothing about a plugin once it has
loaded — a scope declared but never filled, a role filter under the wrong field name, an action
returned without its payload each install cleanly and silently do nothing — so the references
and the validator are built around those silent failures.

## Install

Comes with the `onlyoffice-devtools` plugin — see [Install](../../README.md#install). On its own, copy
or symlink this directory to where your agent scans for skills (for example
`~/.claude/skills/apps-plugin-sdk/`), or hand it `SKILL.md`. It leans on the `apps-ui-kit` skill for the
kit's own rules; without it, the agent reads the kit's READMEs from the project's
`node_modules` instead.

## Scripts

```sh
node scripts/generate-plugin.mjs --name my-plugin --plugin-name MyPlugin --scopes ArticleNavigation,Settings --dir ./my-plugin   # scaffold a project
node scripts/validate-plugin.mjs ./my-plugin --invoke                                                                            # check it against the portal's loader
node scripts/preview-plugin.mjs ./my-plugin                                                                                      # render every surface in Chromium, both themes
```

All three run on Node alone. The project's own `npm install` and, for the preview, Playwright's
Chromium are the only things that touch the network. What each pass checks and what it cannot:
[scripts/README.md](scripts/README.md).

## Targets

SDK `@onlyoffice/docspace-plugin-sdk` **`^3.0.0`** and ONLYOFFICE Apps **4.0**. Generated plugins
are TypeScript + React 19, built with Vite and packed by the SDK's own `build-docspace-plugin`,
matching the SDK's template. SDK 2 plugins (webpack, `window.Plugins`, declarative `IBox` trees)
still run on the portal; the skill reads them but the validator does not check them.

## Read more

- [`SKILL.md`](SKILL.md) — the skill itself: which job, the scope table, the Explain job, the
  rules.
- [Plugins SDK documentation](https://api.onlyoffice.com/docspace/plugins-sdk/get-started) — the
  pages the references link to.
- Changing the skill: [CONTRIBUTING.md](../../CONTRIBUTING.md); its evals: [evals/README.md](evals/README.md).

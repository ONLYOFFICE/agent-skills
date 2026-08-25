# DocSpace plugin skill

A skill that teaches an AI coding agent to build, audit and explain ONLYOFFICE DocSpace plugins.

Describe the feature you want — "a context menu action that converts the selected file to Markdown", "a sidebar panel showing which rooms went quiet" — and the agent produces a complete, built, validated project with an uploadable `dist/plugin.zip`. Point it at a plugin that misbehaves and it finds the reason. Ask it how a scope works and it answers from the references rather than from memory.

It is one skill, not three, and it is host-agnostic: the body lives in [`SKILL.md`](SKILL.md) and every supported agent is pointed at that same file.

## Why it exists

DocSpace loads plugins with very little error reporting. A plugin whose registered name does not match its manifest, or that declares a scope without filling it, or that spells a filter field `usersType` where the portal reads `usersTypes`, will install cleanly, enable cleanly, and then do nothing — with an empty console.

This skill encodes those rules and checks them offline, before anything reaches a portal.

## Installing it

This skill ships in the [ONLYOFFICE agent skills](../../README.md) repository, so the repository-level install commands bring it along:

```
npx skills add ONLYOFFICE/agent-skills
```

For an agent that has no plugin system, hand it the skill directly: copy this directory somewhere the agent scans, or give it [`SKILL.md`](SKILL.md) and let it read the rest from disk.

| Agent | How it finds the skill |
|---|---|
| Claude Code | `claude --plugin-dir /path/to/agent-skills` against a checkout — or `~/.claude/skills/plugin-sdk/`, a copy or symlink of this directory, for a global install |
| Any other agent | copy this directory into the directory it scans, or give it [`SKILL.md`](SKILL.md) directly |

Each entry is a thin pointer at `SKILL.md`; none of them carries its own copy of the instructions. Adding another host means adding another pointer, not another fork.

`$SKILL` in the skill body means this directory. Agents should resolve it to an absolute path before running anything, because the working directory is normally the plugin project rather than this repository.

## Tools

Both run standalone on Node, without a portal, an ONLYOFFICE checkout or a network connection:

```sh
# generate a project skeleton that already builds - it registers no items, by design
node skills/plugin-sdk/scripts/generate-plugin.mjs --name my-plugin --plugin-name MyPlugin --scopes ContextMenu,API --dir ./my-plugin

# check a plugin against the portal loader contract
node skills/plugin-sdk/scripts/validate-plugin.mjs ./my-plugin --invoke
```

The validator runs static checks over the manifest, sources and packed archive, then loads the built bundle in a sandbox, executes `onLoadCallback`, and verifies that each declared scope really registered items with the fields and filter values the portal reads. `--invoke` also calls the item callbacks with the argument the host would pass, checks that every returned action carries its payload, and walks the declarative UI trees for nodes missing a prop they cannot render without.

`node skills/plugin-sdk/scripts/test-validator.mjs` runs the validator against deliberately broken projects with hand-written bundles, asserting which findings it must and must not produce. It never invokes npm, which keeps it fast and offline — and blind to the toolchain. Whether the pinned versions in [`scripts/generator/project-files.mjs`](scripts/generator/project-files.mjs) still compile the config in `templates/` is checked by hand, by generating a project and building it; see [references/sdk-target.md](references/sdk-target.md).

`evals/fixtures/working-plugin/` is a small plugin that already builds and validates, used by the eval that asks for a feature to be added to a live project rather than a new one created.

## What it targets

SDK `@onlyoffice/docspace-plugin-sdk` **`^2.1.0`** and DocSpace **4.0**, which support the same ten scopes. Generated plugins are TypeScript built with webpack and packed by the SDK's own `build-docspace-plugin` — matching how the official ONLYOFFICE plugins are built.

Only what that pair supports is generated: a scope a newer SDK compiles but a shipped portal cannot host would install and show nothing. See [references/sdk-target.md](references/sdk-target.md).

## Layout

```
SKILL.md      the skill — one body covering build, audit and explain
references/   SDK contract, item shapes, UI, host behaviour, REST API, recipes
scripts/         the three entry points — generate, validate, self-test — and the portal contract
  generator/     the generator's layers: options, scopes, sources, project files
  validator/     one pass per thing checked: project, archive, runtime, shapes
  validator-tests/  the self-test's harness, fixtures and one suite per area
templates/    build configs for generated projects
evals/        graded scenarios, their fixture plugins, and a grader
```

`evals/` is a maintenance tool rather than part of the skill: nothing in `SKILL.md` points at it, and no agent reads it at runtime. It exists so that an edit to the skill body can be measured instead of guessed at — each scenario is run twice, once with the skill and once without, and the difference is what says whether a passage is earning its place. Reach for it after changing `SKILL.md` or `contract.mjs`, not after changing prose here. See [evals/README.md](evals/README.md).

## Keeping it current

Everything describing what a portal accepts — scopes, item shapes, filter values, actions and their payloads, component props — lives in [`scripts/contract.mjs`](scripts/contract.mjs). The validator and the scaffolder both import it, so a scope described once is generated and checked the same way.

What a scope *emits* lives in `SCOPE_SPECS` in [`scripts/generator/scopes.mjs`](scripts/generator/scopes.mjs). A spec says only what is specific to that scope — extra SDK imports, the members a non-map scope adds, any method beyond the standard adder/getter/updater, its icon assets, and the one thing about it that catches people out. Interfaces, member names, map fields and required item fields are never restated there; they come from the contract, because a name in two places is a name that will disagree with itself. Adding a scope therefore means an entry in `contract.mjs` and an entry in `SCOPE_SPECS` — the latter throws on load if a scope the contract knows about has no spec.

When a new SDK reaches npm *and* a portal release handles its new scopes, update that file and the version pair in [`references/sdk-target.md`](references/sdk-target.md). Nothing else needs touching.

You should not have to spot the new SDK yourself: the validator compares those tables against the SDK the audited project installed and warns when they diverge.

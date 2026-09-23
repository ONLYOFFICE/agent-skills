# ONLYOFFICE UI kit skill

A skill that teaches an AI coding agent to build screens in your own React application out
of the component library ONLYOFFICE DocSpace and ONLYOFFICE Apps are made of. Describe the
screen ("a settings form like the portal's", "a side panel listing the members of a room")
and the agent produces it with the kit's own components, its two providers mounted, and the
prop names the kit actually reads.

The kit fails quietly. A panel given `isVisible` never opens and reports nothing, because
the prop it reads is `visible`; a label passed to a `FieldContainer` is invisible until
`labelVisible` is set, and its default is `false`; a `Textarea` in a flex row collapses; a
column `gap` adds to the 16px margin every field already carries. None of that is in the
type definitions, and an agent that guesses gets code that compiles and looks broken. The
body is [`SKILL.md`](SKILL.md); every supported agent is pointed at that one file.

## Installing it

As part of the `onlyoffice` plugin — see [Install](../../README.md#install) in the root
README. On its own: copy or symlink this directory to where your agent scans for skills
(for example `~/.claude/skills/ui-kit/`), or hand it `SKILL.md`. `$SKILL` in the skill body
means this directory, resolved to an absolute path.

## What it targets

`@onlyoffice/apps-ui-kit` **4.0.0** — the public name of the library the portal ships as
`@docspace/ui-kit`, built from
[`docspace-ui-kit-react`](https://github.com/ONLYOFFICE/docspace-ui-kit-react).
ESM only, React 19, no registry carries it today: a consumer installs it from a tarball
packed with `pnpm pack`, or from a checkout. The repository carries no tags either, so
[`sources.json`](sources.json) pins a branch and a commit rather than a release. When the
kit is published, the install line moves in one place — the eval fixture's own README — and
the tag and registry sources are added there.

Screens built **for the portal itself** are a different job: a plugin gets the kit through
the portal's shim, which resolves one specifier per package and throws on a subpath import.
That belongs to [`plugin-sdk`](../plugin-sdk/SKILL.md), which keeps the plugin delta and
nothing else.

## Layout

```
SKILL.md      the skill: pinned facts, the discovery step, the routing table and the critical rules
sources.json  the kit version this skill is pinned to, and the commit its synced pages came from
references/   the knowledge base, loaded on demand
  components/   synced from the kit's own component READMEs — regenerate, never edit
evals/        graded scenarios and the trigger tests for the description — not read by agents
scripts/      offline checks an agent runs over a project that uses the kit
templates/    provider composition copied into a project
```

## Maintaining it

**Where a fact about the kit is written.** In the kit, not here. Every component's
behaviour lives in `components/<folder>/README.md` in `docspace-ui-kit-react`, which ships
inside the package itself, and `references/components/` is a mechanical copy of those pages
carrying a provenance header and a hash of its own body. Correct the kit's README and
re-sync; a page edited here is reverted by the next sync and the self-test says so. What is
written here by hand is the part no component README can hold: which component to choose,
how the pieces compose, and the rules an agent breaks without being told.

**How a rule earns its place in `SKILL.md`.** `SKILL.md` is loaded whole on every trigger,
so it has a hard budget of 150 lines. A new trap goes on the component's page upstream or
into a reference; it moves into `SKILL.md` only with an eval assertion behind it, and it
moves back out when the assertion passes without it.

## What is not here yet

This skill is being built in the order its phases were planned. Present today: the router with
its rules, ten hand-written references, the 115 synced component pages with the manifest
derived from them, and the provider templates. Still to come: `scripts/check-usage.mjs` with
its self-test — which the router will then tell an agent to run before handing work over — and
the evals. The plugin version is bumped when the skill is complete, not before: an installed
copy that sees 0.2.0 should get all of it.

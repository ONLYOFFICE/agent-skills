# ONLYOFFICE UI kit skill

Teaches an AI coding agent to build screens in your own React application out of the
component library ONLYOFFICE DocSpace and ONLYOFFICE Apps are made of, `@onlyoffice/apps-ui-kit`.
Describe the screen and the agent produces it with the kit's own components, its two providers
mounted, and the prop names the kit actually reads.

**Ask for** things like "a settings form like the portal's", "a side panel listing the members
of a room", "a confirmation dialog in the DocSpace style in our admin", "which kit component is
a search box", "the kit's labels are blank".

**What the agent does.** It reads the installed kit's version and the component pages that
ship inside the package, picks the components for the job, writes the screen with the providers
and the field wiring the kit expects, renders it once in the dark theme and runs `check-usage`
over the project before handing over. The references hold what the types cannot say: a panel
given `isVisible` never opens because the prop is `visible`; a `FieldContainer` draws no label
until `labelVisible` is set; a `Textarea` in a flex row collapses; a column `gap` doubles the
16px margin every field already carries.

## Install

Comes with the `onlyoffice-devtools` plugin — see [Install](../../README.md#install). On its own, copy
or symlink this directory to where your agent scans for skills (for example
`~/.claude/skills/apps-ui-kit/`), or hand it `SKILL.md`.

## Scripts

```sh
node scripts/check-usage.mjs ./my-app            # the kit mistakes that render without a word; --json for machines
```

Offline: it reads the project as text and knows the kit from a manifest derived from the kit's
own metadata. What it reports and how the manifest is kept current:
[scripts/README.md](scripts/README.md).

## Targets

`@onlyoffice/apps-ui-kit` **4.0.1** from npm — ESM only, React 19. Its documentation is the
kit's own: the READMEs and `docs/*.md` inside the package, and the same pages on the docs site
under [`docspace/ui-kit`](https://api.onlyoffice.com/docspace/ui-kit/getting-started); the skill
links them and copies nothing. Screens for the portal itself — plugins — are the
[`apps-plugin-sdk`](../apps-plugin-sdk/README.md) skill's job: the portal hands a plugin the kit through
its own shim, and `references/ui-kit.md` there says which rules of this skill still hold.

## Read more

- [`SKILL.md`](SKILL.md) — the skill itself: pinned facts, the discovery step, which component
  for which job, the rules.
- [UI kit documentation](https://api.onlyoffice.com/docspace/ui-kit/getting-started) — the pages
  the references link to.
- Changing the skill: [CONTRIBUTING.md](../../CONTRIBUTING.md); its evals and why each rule
  stays: [evals/README.md](evals/README.md).

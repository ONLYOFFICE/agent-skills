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

## Tools

```sh
node skills/ui-kit/scripts/check-usage.mjs ./my-app          # findings as text
node skills/ui-kit/scripts/check-usage.mjs ./my-app --json
node skills/ui-kit/scripts/test-validator.mjs                # the self-test
node tools/sync-ui-kit.mjs --from ../docspace-ui-kit-react --write
```

**`check-usage.mjs`** reads a project as text — no build, no network, nothing executed — and
reports what the kit itself never does. It knows the kit from
`scripts/data/kit-manifest.json`, which the sync derives from the kit's own sources, so the
visibility prop it expects for a component, the list of portal-internal modules and the nine
components that are default exports are all facts rather than a hand-kept list. Errors are
things that are already broken: a visibility prop the component ignores, a portal-internal
import, `Providers`, a path into `dist/`, `PUBLIC_DIR`, a missing provider, a `SearchInput`
handler reading `.target.value` off a string. Warnings are the silent traps: a field with no
visible label, a caption attached to no control, a column whose `gap` doubles the spacing, a
`Loader` with no type, the whole-library stylesheet.

**`test-validator.mjs`** builds twenty throwaway projects in the temp directory and asserts
both what each must report and what it must not, then checks the manifest for internal sense
and runs the two sync tools offline. 390 expectations; breaking one branch of the validator
fails it.

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

**How a rule earns its place in `SKILL.md`.** `SKILL.md` is loaded whole on every trigger, so
it has a budget of **175 lines**. A new trap goes on the component's page upstream or into a
reference; it reaches `SKILL.md` only with an eval assertion behind it.

The budget was 150 and was raised deliberately once it started binding. It exists to stop the
file growing without limit, not because any particular number is right, and 150 was chosen by
eye before a single rule had been measured. Trading a trap that an eval has shown to matter for
a round number is a bad exchange; what keeps the file small is the entry condition above, not
the ceiling.

**Rules the kit's own pages now state as well.** Most of the sixteen are said somewhere under
`references/components/` too — rules 1, 2, 5 and 6 in `_getting-started.md`, rule 4 in the
catalogue's *prop that shows and hides it* table, and rules 7 to 15 on the page of the component
each is about.

**That is not, by itself, a reason to cut them, and the first two eval iterations do not settle
it.** Both arms of every scenario had the kit installed, so both could read those pages and the
package's own `.d.ts`; what the ties show is that the pages are *sufficient once read*. They say
nothing about whether an agent would go and read them unprompted, which is exactly what a rule
in `SKILL.md` buys: it names the trap before the agent decides what to open. No run so far has
separated those two things.

Separating them needs a third arm — the skill with one rule removed, against the same scenario —
and until that is run, a rule with a passing assertion behind it stays. An argument from "the
page says it too" is not evidence.

Two are not candidates at all. **Rule 16 cannot move upstream**: the kit's own validator
forbids the string `PUBLIC_DIR` in any README, even in a sentence telling the reader not to use
it, so the kit is structurally unable to warn about the alias its own client defines. And
**rule 3** is only half-said upstream — `providers/README.md` explains what the composed
`Providers` is, but that page is not one this skill copies.

## What the evidence says, and what it does not

Both instruments have been run. [`evals/`](evals/README.md) carries two iterations — 67/70
against a baseline's 60/70 in the second — and [`trigger-tests.md`](evals/trigger-tests.md)
carries ten of ten and none of ten across three orders.

What that buys: the skill's value is concentrated where the package cannot answer for itself —
explaining a symptom with no project to read, auditing someone else's file without inventing
findings, and the composition traps no single component page states. The two build scenarios
that tied did so because the kit vendors its own READMEs and hand-annotated `.d.ts` into
`node_modules`, which is workstream A working, not this skill failing.

What it does not buy, and should not be claimed:

- **No rule has been shown to be individually load-bearing.** Measuring that needs the third arm
  described above. The run tells you the skill as a whole beats no skill; it does not rank the
  rules inside it.
- **The trigger figure is from a routing-judgement method, not the protocol.** The protocol wants
  fresh sessions with the plugin installed; the run gave three judges the descriptions and the
  messages. `trigger-tests.md` says so in full. Re-run the real thing before a release that
  changes the description.
- **Prose in the synced pages is checked by nobody.** The kit's validator settles metadata,
  generated tables and compiling examples; a sentence that has become false as the component
  changed is caught only by someone re-reading it. Three such sentences were found by the eval
  runs and fixed upstream, which is the argument for running these at all — and also the measure
  of how they were found.

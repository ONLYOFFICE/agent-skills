# Trigger tests for the `description`

Twenty first messages, each sent to a fresh session with the plugin installed and nothing else
said. Record whether the agent loaded `onlyoffice:ui-kit` before answering. Target: every
"should" triggers, no "should not" does, on each model the evals run on. Run three times per
message; a message counts as triggering when it does so in at least two runs. When a "should"
misses, add the missing situation to the description; when a "should not" fires, add the
boundary — never paste the failing query verbatim.

The description has a hard limit of 1024 characters. Check it after every edit:

```sh
node -e "const d=require('node:fs').readFileSync('skills/ui-kit/SKILL.md','utf8').match(/^description: (.*)$/m)[1]; console.log(d.length)"
```

Three neighbours make this description harder than the others in the repository, and the
boundaries are what the "should not" list is mostly about. A **plugin** inside the portal gets
the kit through the portal's shim and belongs to `plugin-sdk`; an **iframe** embed belongs to
`embed-sdk`; and a request that merely mentions a dialog or a form belongs to nobody here
unless ONLYOFFICE is in it. The product was renamed from **DocSpace** to **ONLYOFFICE Apps** in
4.0, so both names are in use and the description carries both. Messages 4, 6 and 9 name no
product at all — they test triggering on a symptom, which is the description's third clause —
and message 3 is in Russian, the only check that the description triggers when the first
message is not in English. Do not "fix" either.

## Should trigger

1. Make a dialog that looks like DocSpace for confirming a delete in our React admin.
2. A settings form in the DocSpace style — name, email, a role dropdown and a save button.
3. Сделай боковую панель со списком участников в стиле ONLYOFFICE DocSpace в нашем React-приложении.
4. We installed @onlyoffice/apps-ui-kit and every component renders completely unstyled.
5. Which ONLYOFFICE Apps component do I use for a table of users with checkboxes and sortable columns?
6. Why didn't you use isVisible on the panel? It never opens and there is nothing in the console.
7. The kit's buttons come out with empty labels and the console says i18next missing key.
8. `import { Section } from "@onlyoffice/apps-ui-kit"` does not resolve, but the folder is right there.
9. Our toggle switch overlaps the row under it and the fields are twice as far apart as the design.
10. Review this file — it uses the DocSpace UI kit and pulls something in from selectors/People.

## Should not trigger

1. Add a context-menu item to our DocSpace plugin that sends the file to our archive.
2. Embed the DocSpace file manager in an iframe on our intranet page.
3. Our MUI dialog won't close when you click the backdrop.
4. Build a design system in React for our marketing site.
5. Write a plugin for the ONLYOFFICE document editor toolbar.
6. Pull the list of rooms from the DocSpace REST API in Python.
7. Style this Bootstrap form to match our brand colours.
8. How do I do dark mode with Tailwind in Next.js?
9. Make the ONLYOFFICE document editor toolbar smaller.
10. Install the DocSpace plugin system on our self-hosted portal.

## Results

| Date | Model | Should (10) | Should not (10) | Notes |
|---|---|---|---|---|
| 2026-09-24 | Opus 5 | 10/10 | 10/10 | Three runs, routing-judgement method (below); 30/30 and 0/30 across them |
| 2026-10-07 | sonnet | 10/10 | 10/10 | The protocol itself, through `node tools/run-triggers.mjs --skill ui-kit --model sonnet --runs 1`: twenty fresh `claude -p` sessions with the plugin installed, one run per message, no errors. Description as of `ecf2f56`. The two "should not" messages about the DocSpace plugin and the portal loaded `plugin-sdk`, the embedding one loaded `embed-sdk`, the other seven loaded nothing |

**Method, and how it differs from the protocol above.** The protocol asks for twenty fresh
sessions with the plugin installed. This run could not install the plugin into fresh sessions,
so it measured the thing the `description` actually controls: three independent judges were
given the verbatim `description` of all three ONLYOFFICE skills and the twenty messages in three
different interleaved orders, with no labels, no stated split between them and no mention that
this was a test, and asked which skill — if any — they would load before answering. Every judge
routed all ten "should" messages to `ui-kit` and none of the ten "should not" ones to it.

This is weaker evidence than the protocol in one specific way: it tests the description against
a model reading it deliberately, not against the harness's own selection under load. It is
stronger in another: the orders differed, so the result is not an artefact of the list's shape.
Re-run the real protocol before a release that changes the description.

Two things the judges surfaced that the pass/fail table hides:

- The three messages that name no product at all — the unstyled kit, the overlapping toggle with
  doubled spacing, and `isVisible` on a panel that never opens — triggered on the symptom, and
  all three judges said so unprompted, naming the symptom pair as what decided it. That clause
  of the description is carrying real weight.
- "Which ONLYOFFICE Apps component do I use…" and "a settings form in the DocSpace style" were
  each called close calls against `plugin-sdk`, which claims "an admin settings form" and owns
  everything inside the portal. Both resolved to `ui-kit` on the same distinction — imitating
  the look from outside versus building inside the portal — which is the boundary the two
  descriptions were written to draw.

One disagreement, and it is not `ui-kit`'s: "Install the DocSpace plugin system on our
self-hosted portal" went to `none` twice and `plugin-sdk` once. That is a `plugin-sdk` boundary
question — whether operating the portal belongs to a skill about authoring plugins.

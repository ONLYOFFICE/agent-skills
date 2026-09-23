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
| — | — | not yet run | — | — |

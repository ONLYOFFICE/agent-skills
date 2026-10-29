# Trigger tests for the `description`

Twenty first messages, each sent to a fresh session with the plugin installed and nothing
else said. Record whether the agent loaded `onlyoffice:apps-plugin-sdk` before answering —
`node tools/run-triggers.mjs --skill apps-plugin-sdk --model sonnet` does that through `claude -p`. Target:
every "should" triggers, no "should not" does, on each model the evals run on. Run three
times per message; a message counts as triggering when it does so in at least two runs.
When a "should" misses, add the missing situation to the description; when a "should not"
fires, add the boundary — never paste the failing query verbatim. The description has a
hard limit of 1024 characters; check the length after every edit.

The product was renamed from **DocSpace** to **ONLYOFFICE Apps** in 4.0, so both names are in
use in the wild; the description carries both. Should-trigger 4 and 8 say ONLYOFFICE Apps, 1, 2,
3 and 10 say DocSpace, and 5, 6, 7 and 9 name no product at all — those four are the ones that
test triggering on a bare feature description, which is the description's second clause. Do not
"fix" any of them to one brand, and leave message 3 in Russian: it is the only check that the
description triggers when the first message is not in English.

## Should trigger

1. Create a DocSpace plugin that adds a context-menu item on files which sends the file to our archive service.
2. I want a button in DocSpace that converts the selected spreadsheet to PDF and drops the copy next to it. Where do I even start?
3. Нужен экран внутри DocSpace, где виден список всех комнат с количеством участников, с поиском. Как это сделать?
4. Our ONLYOFFICE Apps plugin installs and is enabled but nothing shows up anywhere — no menu item, no error in the console.
5. The settings page of my plugin opens but the Save button in the footer does nothing. It's a React component, SDK 3.
6. `usersType: [UsersType.user]` on my context menu item and everyone still sees it — admins, guests, all of them. What am I doing wrong?
7. Here is our plugin repo (webpack, `window.Plugins.Foo = plugin`). Add an info panel tab that shows who last edited the file.
8. Review this ONLYOFFICE Apps plugin before we ship it to a customer — it's a `.journal` file viewer with a context menu action.
9. I re-uploaded the plugin zip with the fix and the portal still runs the old version. Cache? Wrong build?
10. Which hooks can a DocSpace plugin component use, and is there one for the currently selected room?

## Should not trigger

1. Embed the ONLYOFFICE Apps file manager into our React admin page. *(apps-embed-sdk)*
2. Add a button to the ONLYOFFICE editor toolbar that inserts today's date into the document. *(Docs plugin, not DocSpace)*
3. Write a Python script that uses the DocSpace REST API to create a room for every new customer in our CRM. *(REST / api-sdk)*
4. Our DocSpace iframe is blank in Safari but works in Chrome. *(apps-embed-sdk)*
5. Write a macro for ONLYOFFICE spreadsheets that highlights duplicate rows. *(editor macro)*
6. How do I write a WordPress plugin that shows our DocSpace room in a shortcode? *(apps-embed-sdk / WordPress)*
7. Build a Chrome extension that adds a context menu item on any web page to save the selection to a note. *(generic browser extension)*
8. Convert a DOCX to PDF with the ONLYOFFICE conversion API from Node. *(Document Server)*
9. My React StrictMode effect runs twice in dev — how do I stop it? *(generic React)*
10. Set up the DocSpace plugin *system* on our self-hosted portal — where is the switch in the admin settings? *(portal administration; borderline — see below)*

## Near misses worth watching

- "ONLYOFFICE plugin" with nothing else: could be a Docs (editor) plugin or a DocSpace plugin.
  The skill should trigger and its first move should be to ask which — the editor is a
  different product with its own SDK.
- "Should not" 10 is deliberately borderline: enabling `plugins.enabled` is portal
  administration, but the skill's Audit step 0 answers exactly that question. Triggering
  here is acceptable; count it as neither pass nor fail and watch whether the answer stays
  short.
- "A form inside a DocSpace document that fills itself from our CRM": that is editor
  automation through apps-embed-sdk (`executeInEditor`), not a plugin. Should not trigger.

## Results

| Date | Model | Should (10) | Should not (10) | Notes |
|---|---|---|---|---|
| 2026-10-05 | sonnet | 10 (each 3/3) | 9 (each 0/3) + "should not" 10 at 3/3 | Description as of `82ff8c7`. "Should not" 10 is the borderline one, counted as neither; the three embedding messages went to `onlyoffice:apps-embed-sdk` |
| 2026-10-28 | sonnet | 10 (each 3/3) | 9 (each 0/3) + "should not" 10 at 3/3 | After the rename to `apps-plugin-sdk`, through `node tools/run-triggers.mjs --skill apps-plugin-sdk --model sonnet`: the same picture as the row above, message 10 still the borderline one. The three embedding messages went to `onlyoffice:apps-embed-sdk`, no errors |

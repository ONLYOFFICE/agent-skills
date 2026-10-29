# Trigger tests for the `description`

Twenty first messages, each sent to a fresh session with the plugin installed and nothing
else said. Record whether the agent loaded `onlyoffice-devtools:apps-embed-sdk` before answering.
`node tools/run-triggers.mjs --skill apps-embed-sdk --model sonnet` does exactly that through `claude -p`
with this repository as `--plugin-dir`, three runs per message, and prints the misses. Target:
every "should" triggers, no "should not" does, on each model in `evals.json` → `models`.
Run three times per message; a message counts as triggering when it does so in at least two
runs. When a "should" misses, add the missing situation to the description; when a "should
not" fires, add the boundary — never paste the failing query verbatim.

## Should trigger

1. Add a DocSpace file manager to our React admin page.
2. Встрой в наш сайт просмотр документов из публичной комнаты DocSpace без входа.
3. Our WordPress plugin logs users into DocSpace with a password hash; users with 2FA can't log in — what do we change?
4. The ONLYOFFICE iframe on our site is blank in Safari but works in Chrome.
5. How do I open a document from the DocSpace manager in my own modal instead of the portal page?
6. I need a room picker dialog and then upload files into the chosen room from our Vue app.
7. Fill the fields of a DocSpace form from CRM data when the editor opens, then read them back.
8. Next.js: `window.DocSpace is undefined` when I import the SDK.
9. Add the DocSpace AI chat for agent 4711 to our portal page; it shows only "Chat history".
10. Which token do I pass to `initManager` — the API key, an OAuth token or the share link key?

## Should not trigger

1. Create a DocSpace plugin that adds a context-menu item to files. *(apps-plugin-sdk)*
2. Build a Document Server plugin that inserts a signature into the editor toolbar. *(Docs plugins)*
3. How do I convert a DOCX to PDF with the ONLYOFFICE conversion API? *(Document Server)*
4. Embed a YouTube video in an iframe with a responsive aspect ratio.
5. Write a Playwright test that logs into our own site with 2FA.
6. Set up OAuth login with Google for our Express app.
7. Use the DocSpace REST API from a Python script to create rooms for every new customer. *(REST / api-sdk)*
8. Generate a DOCX invoice from a template with Document Builder. *(Document Builder)*
9. My React StrictMode effect runs twice — how do I stop it? *(generic React; no DocSpace)*
10. Add a file uploader with drag and drop to our Vue app that posts to our S3 bucket.

## Near misses worth watching

- "Embed the ONLYOFFICE editor in our app" without naming DocSpace: the user may mean
  Document Server's Docs API (not this skill) or ONLYOFFICE Apps (this skill). The skill should
  trigger and its first question should be which product the user has.
- "Our DocSpace integration returns 401": trigger; the token table answers it.

## Results

| Date | Model | Should (10) | Should not (10) | Notes |
|---|---|---|---|---|
| 2026-09-17 | claude-sonnet-5 | 10 (each 3/3) | 10 (each 0/3) | Description as of commit 908d350. "Create a DocSpace plugin…" went to `onlyoffice:apps-plugin-sdk` in all three runs, as intended |
| 2026-10-28 | sonnet | 10 (each 3/3) | 10 (each 0/3) | After the rename to `apps-embed-sdk` (the cross-references in the description renamed with it), through `node tools/run-triggers.mjs --skill apps-embed-sdk --model sonnet`: 30/30 and 0/30, no errors. "Create a DocSpace plugin…" went to `onlyoffice:apps-plugin-sdk` in all three runs, as before |

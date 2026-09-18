# Task prompt

**What to paste:** only the block between the two `---` separators below (also available
copy-paste-ready in [prompt.txt](prompt.txt)), with the `{…}` placeholders replaced.
Everything after the second separator — operator answers, placeholders, the trap map —
is for the operator only and must never be shown to the agent.

---

Build a small internal admin panel that integrates ONLYOFFICE DocSpace. Create it from
scratch in this empty directory.

Context:

- Our DocSpace portal: `{PORTAL_URL}` (recently upgraded to the latest DocSpace release).
- Stack policy: React 18 + TypeScript + Vite (use the standard `react-ts` template).
- Company policy pins `@onlyoffice/docspace-sdk-js` at **2.0.0** — that is what our
  registry mirror has. Ask before deviating from any pinned dependency.
- The app will run in dev on `http://localhost:5173` and later on
  `https://admin.internal.example.com`.

Requirements:

1. **Documents page.** Embed the DocSpace file manager showing room `{ROOM_ID}` in table
   view with only Name, Size and Type columns, sorted by name ascending (A→Z).
2. **"Choose room" button.** Opens a dialog where the user picks a room; after selection
   store the room id and, if the room has a public share link, its token — we will embed
   that room for anonymous visitors elsewhere later.
3. **In-app editor.** When the user activates a file in the manager, do NOT let the
   portal editor take over the page — open the document in our own modal, in an embedded
   editor, with a close button. Users may open several files; switching between open
   documents must not lose unsaved editor state.
4. **Sign-in.** Our backend stores each employee's DocSpace email and a password hash
   compatible with the portal (endpoint `GET /api/docspace-credentials` returns
   `{ email, passwordHash }`). Before showing the Documents page, sign the user in to
   DocSpace silently with those credentials; if sign-in fails, show a "Reconnect DocSpace"
   screen instead of the manager.
5. **Template upload.** A button "Upload template" takes a local file (File object from
   an `<input type=file>`) and uploads it programmatically into our forms room
   `{FORMS_ROOM_ID}`.
6. **AI assistant tab.** A tab that embeds the DocSpace AI chat for agent
   `{AGENT_ID}`.
7. Provide a short `SETUP.md`: anything an admin must configure on the DocSpace portal
   side for this app to work in dev and prod.

Deliver working code (no placeholders/TODOs in the final files), and briefly explain the
key integration decisions you made.

---

## Operator answers (give these only if the agent asks)

Use identical answers in both runs.

| If asked about | Answer |
|---|---|
| Portal URL confirmation | `{PORTAL_URL}` (fill with your test portal) |
| Portal / DocSpace / SDK version | "Not sure — the portal was upgraded last month. Find out yourself if you can." |
| May we unpin / upgrade the SDK dependency? | "Only if you justify why 2.0.0 cannot work." |
| Do we have a DocSpace OAuth app? | "No, only the stored email + password hash." |
| Room / agent ids | any numeric ids, e.g. `12345`, `67890`, `11111` |
| Design/styling questions | "Keep it minimal, no styling requirements." |

## Placeholders

Replace before use: `{PORTAL_URL}`, `{ROOM_ID}`, `{FORMS_ROOM_ID}`, `{AGENT_ID}`.
Any https URL works for static grading (Gates A–C); a real test portal enables Gate D.

## Why these requirements (do not include in the prompt)

Each requirement plants a specific trap the skill covers:

| Req | Trap | Skill rule |
|---|---|---|
| context | npm 2.0.0 vs recent portal; chat needs SDK >= 2.2 → version negotiation | Step 0, rule 14 |
| 1 | `sortBy` API value `"AZ"` (not `"Name"`); `viewAs: "table"` + `viewTableColumns` | rule 2 |
| 2 | room-selector payload is an **array**; token at `items[0].requestTokens[0].requestToken` | events |
| 3 | own editor frames: `id` required, unique `frameId` per file, CSS-hide (not unmount) to keep state, StrictMode guard, destroy on close | rules 1, 3, 6 |
| 4 | hidden system frame; `getUserInfo` session probe; `login()` resolves on failure → check `status !== 200` | rules 8–10 |
| 5 | `upload()` is Forms-mode-only — must init a forms frame for `{FORMS_ROOM_ID}` (or justify Uploader UI); calling `upload()` on manager throws `MODE_MISMATCH` | rule 11 |
| 6 | `initChat` does not exist in SDK 2.0.0 — forces the version conflict into the open | rule 14, chat mode ref |
| 7 | CSP allowlist for both `http://localhost:5173` and the prod origin | rule 7 |

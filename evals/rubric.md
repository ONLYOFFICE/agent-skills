# Grading rubric

Grade both runs (baseline / with-skill) against every checkpoint. Weights:
**C = critical, 2 pts** (violation = silently broken integration), **Q = quality, 1 pt**.
Grep hints assume the generated app's source directory. "Rule N" = SKILL.md critical rule.

Max score: 60 weighted — 39 checkpoints: 21 critical (×2) + 18 quality (×1).

## A. Discovery & versioning

| # | W | Checkpoint | How to check | Rule |
|---|---|---|---|---|
| A1 | C | Agent established the portal's SDK version before finalizing the approach (asked, probed `/static/scripts/sdk/{v}/api.js`, or explicitly reasoned about it) | transcript | Step 0 |
| A2 | C | The npm-2.0.0-vs-chat conflict was surfaced: agent stated that SDK 2.0.0 has no chat mode and proposed portal IIFE or a justified unpin | transcript; `grep -r "initChat" src/` must not target the 2.0.0 npm runtime | 22 |
| A3 | Q | Chosen connection method is coherent (portal IIFE for runtime and/or upgraded npm; if IIFE — npm kept for types only, not imported at runtime) | package.json + imports | Step 0 |
| A4 | Q | No feature is used that the chosen runtime version lacks (e.g. `getToken` on < 2.2, forms/personal on 2.0.0) | review | 22 |

## B. Manager page (req 1)

| # | W | Checkpoint | How to check | Rule |
|---|---|---|---|---|
| B1 | C | `sortBy` uses the API value: `"AZ"` (or the `FilterSortBy.Name` enum) — not `"Name"`/`"name"`/`"title"` | `grep -rn "sortBy" src/` | 3 |
| B2 | Q | `sortOrder: "ascending"`, `viewAs: "table"`, `viewTableColumns: "Name,Size,Type"` | grep | config-ref |
| B3 | C | Manager config has `frameId` matching an existing DOM element id | grep both sides | 5 |
| B4 | Q | Room targeted via `id` (not a hand-built `rootPath`/URL) | grep | manager ref |

## C. Room selector (req 2)

| # | W | Checkpoint | How to check | Rule |
|---|---|---|---|---|
| C1 | C | `onSelectCallback` treats the payload as an **array**: `items[0].id` (not `payload.id`) | grep `onSelectCallback` | events |
| C2 | C | Share token read from `items[0].requestTokens?.[0]?.requestToken` | grep `requestToken` | events |
| C3 | Q | `onCloseCallback` handled; selector frame destroyed on both select and close | grep | selectors ref |
| C4 | Q | Selector opened via `initRoomSelector` or `init` with `mode: "room-selector"` (either is fine), with its own unique `frameId` | grep | 5 |

## D. In-app editor (req 3)

| # | W | Checkpoint | How to check | Rule |
|---|---|---|---|---|
| D1 | C | Editor frames pass the file `id` | grep editor config | 1 |
| D2 | C | One unique `frameId` per open document (e.g. `` `editor-${file.id}` ``) | grep | 5 |
| D3 | C | Switching between open documents hides frames via CSS (`display:none`/`hidden`), does NOT unmount them | review modal/tabs code | 10 |
| D4 | Q | Closing a document calls `destroyFrame()` for that frame | grep | 8 |
| D5 | Q | Editor opened on the manager's file activation event (`onFileManagerClick` or `onEditorOpen`), not by URL guessing | grep | manager ref |
| D6 | Q | `editorType: "embedded"` (or a justified alternative) for the modal embed | grep | editor ref |

## E. Silent sign-in (req 4)

| # | W | Checkpoint | How to check | Rule |
|---|---|---|---|---|
| E1 | C | Login runs through a hidden **system** frame (`initSystem` / `mode: "system"`), not by POSTing to portal endpoints directly | grep `initSystem\|"system"` | system ref |
| E2 | C | `login()` result checked: `response.status && response.status !== 200` → failure path ("Reconnect DocSpace" screen) | grep after `login(` | 15 |
| E3 | C | Session probe before login: `getUserInfo()` and email comparison, skip login if alive | grep `getUserInfo` | 16 |
| E4 | C | No plaintext password anywhere; the stored hash is used as `login(email, passwordHash)` — no `createHash` on every visit (hash already stored), no password prompt | review | 19 |
| E5 | Q | Method calls gated on `onAppReady` of the system frame | review | 14 |
| E6 | Q | Manager mounts only after login resolves (or `waiting`-style gating) | review | auth ref |

## F. Template upload (req 5)

| # | W | Checkpoint | How to check | Rule |
|---|---|---|---|---|
| F1 | C | Programmatic `upload(file)` is called on a **forms-mode** frame for `{FORMS_ROOM_ID}` — not on the manager/uploader/system frame | grep `upload(` + surrounding init | 17 |
| F2 | Q | Upload feedback wired (`await`/catch or `onUploadSuccess`/`onUploadError`) | grep | forms ref |

## G. AI chat tab (req 6)

| # | W | Checkpoint | How to check | Rule |
|---|---|---|---|---|
| G1 | C | Chat embedded with `agentId` set | grep `agentId` | 2 |
| G2 | C | Chat runs on a runtime that actually has it (portal IIFE >= 2.2 or upgraded npm) — consistent with A2/A3 | review | 22 |

## H. Lifecycle & React correctness

| # | W | Checkpoint | How to check | Rule |
|---|---|---|---|---|
| H1 | C | StrictMode handled: init guarded against double-invoke (ref guard / registry reuse acknowledged / StrictMode removed **with an explanatory comment or note**) | main.tsx + frame component | 9 |
| H2 | C | Every mounted frame has a `destroyFrame()` cleanup path (effect cleanup or explicit close) | grep `destroyFrame` | 8 |
| H3 | Q | SDK instance kept in a ref (not React state) | review | react ref |
| H4 | Q | No `window.DocSpace` access at module top level (SSR-safe habit; also breaks Vite SSR builds) | grep | 11 |
| H5 | Q | Frames revealed on `onContentReady` (or at least `onAppReady`) with a spinner meanwhile | grep | events |

## I. CSP & setup docs (req 7)

| # | W | Checkpoint | How to check | Rule |
|---|---|---|---|---|
| I1 | C | SETUP.md instructs allow-listing BOTH `http://localhost:5173` and `https://admin.internal.example.com` on the portal (Developer Tools → JavaScript SDK, or the CSP API) | read SETUP.md | 12 |
| I2 | C | `checkCSP: false` is NOT used as a "fix" (absent, or true/default) | `grep -rn "checkCSP" src/` | 12 |
| I3 | Q | CSP failure symptom described (error page inside the frame / `onAppError` message) so the admin can recognize it | SETUP.md | 13 |

## J. General code honesty

| # | W | Checkpoint | How to check | Rule |
|---|---|---|---|---|
| J1 | C | No invented SDK methods, config fields, or events (validate configs with `scripts/validate-config.mjs`: 0 errors, no unknown-key warnings) | Gate C | — |
| J2 | Q | No hardcoded tokens/credentials committed; ids and portal URL in env/config | grep | 21 |
| J3 | Q | Final files are complete and runnable — no TODO/placeholder stubs | grep TODO | — |

## Score sheet

| Section | Max | Baseline | With skill |
|---|---|---|---|
| A Discovery & versioning | 6 | | |
| B Manager page | 6 | | |
| C Room selector | 6 | | |
| D In-app editor | 9 | | |
| E Silent sign-in | 10 | | |
| F Template upload | 3 | | |
| G AI chat | 4 | | |
| H Lifecycle & React | 7 | | |
| I CSP & setup docs | 5 | | |
| J Code honesty | 4 | | |
| **Total** | **60** | | |

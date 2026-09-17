---
name: embed-sdk
description: >
  Embed ONLYOFFICE Apps (formerly DocSpace) into web apps with the Embed SDK
  (@onlyoffice/docspace-sdk-js).
  Use when the user wants to embed an ONLYOFFICE Apps file manager, document editor or
  viewer, room/file selector dialog, file uploader, forms gallery, AI chat, or
  personal files section; when configuring TFrameConfig, authentication (login
  hash flow, OAuth getToken, public room tokens, API keys, 2FA questions), frame
  events, SDKInstance methods, or programmatic form filling via executeInEditor; when
  a host app (WordPress, Nextcloud, CRM, React/Next/Vue/Angular page) shows a DocSpace
  iframe that is blank, returns 401, fails CSP or X-Frame-Options; or when a connector
  built on this SDK needs a new login or file flow. Not for DocSpace plugins
  (plugin-sdk) or for the Document Server Docs API outside an embedded frame.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
  sdk-version: "2.2.0"
---

# ONLYOFFICE Apps Embed SDK

The Embed SDK (`@onlyoffice/docspace-sdk-js`, historically "JavaScript SDK") embeds ONLYOFFICE
Apps UI into a host page as an iframe and talks to it over postMessage: one instance per frame,
configured by a `TFrameConfig`, driven by promise-based methods and events. This file is the
router — read the matching reference before writing code.

## Pinned facts

- Package `@onlyoffice/docspace-sdk-js`, current version **2.2.0** (`npm i @onlyoffice/docspace-sdk-js@^2.2.0`,
  GitHub tag `v2.2.0`, Node >= 18). The portal also serves the same code as a script:
  `{portal}/static/scripts/sdk/{version}/api.js` (known versions 1.0.1, 2.0.0, 2.1.0, 2.2.0).
- `window.DocSpace.SDK` (with the `frames` registry keyed by `frameId`) exists even with the npm
  import — the module sets it as a side effect.
- Methods resolve or reject within `methodTimeout` (30 000 ms by default).
- `@onlyoffice/docspace-react` bundles its own SDK copy that has lagged behind its version number;
  check `node_modules/@onlyoffice/docspace-react/package.json` before using it ([discovery](references/discovery.md#the-react-wrapper)).

## Sources, and which one wins

When sources disagree, the higher one wins — say so to the user instead of switching between them.

1. **The installed package's types**: `node_modules/@onlyoffice/docspace-sdk-js/dist/types/main.d.ts` — the exact contract of the version the project runs.
2. **The docs site** for the portal's SDK version, starting at `https://api.onlyoffice.com/docspace/javascript-sdk/get-started/`
   (the introduction; the section has no page of its own): the guides beside it,
   `get-started/{quickstart|playground|authentication-security}/`, one page per mode under
   `embedding-modes/{manager|viewer|editor|room-selector|file-selector|system|uploader|forms|frame}-mode/`,
   `customization/{theming|locale|ui-elements}/`, `events-and-callbacks/`, the generated reference by kind under
   `usage-sdk/{classes|type-aliases|enumerations|variables}/` (`classes/SDKInstance/`, `classes/SDKError/`,
   `type-aliases/TFrameConfig/`, `type-aliases/TLoginResult/`, `enumerations/SDKErrorCode/`, …), samples such as
   `samples/basic-samples/init-manager/`, and the live demo `https://demo-embed.onlyoffice.com/`. **Read pages as
   Markdown**: replace the trailing slash of any page URL with `.md` (`…/embedding-modes/manager-mode.md`,
   `…/usage-sdk/type-aliases/TFrameConfig.md`). The index of every page with a one-line summary each is
   `https://api.onlyoffice.com/llms.txt`, section "ONLYOFFICE DocSpace: Embed SDK".
3. **The SDK sources** at the matching tag: `https://raw.githubusercontent.com/ONLYOFFICE/docspace-sdk-js/v2.2.0/src/types/index.ts`,
   `…/src/enums/index.ts`, `…/src/constants/index.ts`.
4. **This skill** — the process, the traps and the portal behaviours the types cannot express. Facts marked
   "client 4.0.0" were verified against that portal release.

Chat, Personal and Public room have no guide page yet; the reference pages, the SDK README and this skill's references cover them.

## Not covered here — name the edge when you reach it

- **The portal REST API** (`/api/2.0/...`): folders vs sections (`folderId` is a destination, `rootFolderId` the root of a
  section — using it as a destination returns 403), templates, sharing, users. Sources:
  `https://api.onlyoffice.com/docspace/api-backend/get-started/basic-concepts/` (one page per operation under `usage-api/`)
  and the `@onlyoffice/docspace-api-sdk` packages.
- **The editor's own APIs** (Docs API, Document Builder, plugins) beyond [editor-automation](references/editor-automation.md).
- **Two-factor authentication** — `login()` cannot complete it (token table).
- **One portal's deployment** — proxies, cookie policies, header rewrites. Step 0 probes; interpreting an odd result is the admin's job.

## Which token is which

| Thing | Lives | Grants | SDK entry | Cannot |
|---|---|---|---|---|
| Password hash (`createHash`) | your backend, encrypted | a portal session via `login(email, hash)` in a System frame | `login()`, resolving `TLoginResult` | finish when 2FA is on unless the portal reads `login`'s `code` argument (client 4.0.0 does not); survive third-party-cookie blocking |
| Session cookie `asc_auth_key` | browser, portal origin | every request the iframe makes | nothing to pass | be sent from a cross-origin iframe when the browser blocks third-party cookies → `401` despite a live session |
| `requestToken` (share key) | room share link, or `items[0].requestTokens[0].requestToken` from a room-selector | anonymous access to one room | `public-room` (`id` + `requestToken`); manager with `rootPath: "/rooms/share"` | anything outside that room; must never be committed |
| OAuth access token | your backend (refresh token stays there) | API calls as the user, sent as `Bearer` — no cookie involved | `getToken` (preferred) or `accessToken`, SDK >= 2.2 | outlive expiry unless `getToken` re-fetches |
| API key | your backend | REST as the key owner, `Bearer`, scopes = key permissions | REST; in a frame the SDK forwards whatever `getToken` returns — plausible but **unverified**, confirm with `getUserInfo()` | be refreshed or revoked per session |

Two consequences ([auth-recipes §6–7](references/auth-recipes.md)): a signed-in portal tab does **not** make a
cross-origin frame work in Safari or cookie-blocking Chrome — use OAuth `getToken` or same-site hosting; and an
account with **2FA** gets no session from `login()` on client 4.0.0 — its dispatcher reads only `email` and
`passwordHash`. `login()` resolves `{ url: "/" }` on success, `{ url: "/confirm/…" }` when a second factor is
pending, and an error with `status` on failure. SDK 2.2.0 adds a fifth `code` argument for the second call,
which works only once the portal's dispatcher reads it; probe the portal version before promising it.

## Step 0 — discover the portal, then choose the connection

Ask for the portal URL, then run the probe (full reading guide: [discovery](references/discovery.md)). `$SKILL` is the
directory holding this file — `<repo>/skills/embed-sdk`, or `${CLAUDE_PLUGIN_ROOT}/skills/embed-sdk` when installed as a
Claude Code plugin; resolve it to an absolute path once, the scripts are not on the project's path:

```
node $SKILL/scripts/probe-portal.mjs https://portal.example.com --origin https://your-host.example
```

It reports the portal's SDK version and OAuth marker, the `X-Frame-Options` / `frame-ancestors` headers of the frame
pages, OAuth discovery and the CSP allow-list, and recommends the connection. Rules of thumb: portal on SDK 2.2 +
bundler → npm; portal older than the package or no build step → the portal script, npm for types only; version
undetectable → the portal script. `/old-sdk/system` carries `X-Frame-Options: SAMEORIGIN` and embeds only while the
CSP `frame-ancestors` header is present and lists your origin (client 4.0.0); an `X-Frame-Options` line without
`frame-ancestors` in the probe is a portal-side problem — forward it to the admin verbatim.

Quick start (npm): `new SDK().initManager({ frameId: "ds-frame", src: "https://portal" })` → later `instance.destroyFrame()`.
With the script: `window.DocSpace.SDK.initManager(...)`.

## Routing table

| Task | mode | Wrapper | Required config | Reference |
|---|---|---|---|---|
| File/room manager | `manager` | `initManager` | `src` | [manager](references/modes/manager.md) |
| Edit a document | `editor` | `initEditor` | `src`, `id` | [editor-viewer](references/modes/editor-viewer.md) |
| View a document | `viewer` | `initViewer` | `src`, `id` | [editor-viewer](references/modes/editor-viewer.md) |
| Pick a room (dialog) | `room-selector` | `initRoomSelector` | `src` | [selectors](references/modes/selectors.md) |
| Pick a file (dialog) | `file-selector` | `initFileSelector` | `src` | [selectors](references/modes/selectors.md) |
| Headless login / API calls | `system` | `initSystem` | `src` | [system](references/modes/system.md) |
| Anonymous public room | `public-room` | `initPublicRoom` | `src`, `id` (room), `requestToken` | [public-room](references/modes/public-room.md) |
| Upload UI | `uploader` | `initUploader` | `src`, `id` (folder) | [uploader](references/modes/uploader.md) |
| Forms gallery | `forms` | `initForms` | `src`, `id` (room) | [forms](references/modes/forms.md) |
| AI chat | `chat` | `initChat` | `src`; a signed-in non-guest user with AI enabled (`agentId` optional) | [chat](references/modes/chat.md) |
| Personal files | `personal` | `initPersonal` | `src` | [personal](references/modes/personal.md) |
| Fill forms inside the editor | `editor` + connector | — | — | [editor-automation](references/editor-automation.md) |

Also: [config-reference](references/config-reference.md) (fields that bite, by mode), [methods](references/methods.md),
[events](references/events.md), [auth-recipes](references/auth-recipes.md), [testing](references/testing.md) (self-check
protocol), [frameworks/react](references/frameworks/react.md) · [nextjs](references/frameworks/nextjs.md) ·
[vue](references/frameworks/vue.md) · [angular](references/frameworks/angular.md).

## Critical rules

Each one exists because the failure is silent: the integration looks right and does nothing.

1. **Required ids.** editor/viewer need `id` (without it an empty `/doceditor` opens, no error). public-room needs both
   `id` and `requestToken` (without `id` the portal's server render fails: white "Something went wrong", no event).
2. **Enum values are API strings, not key names.** `FilterSortBy.Name` is `"AZ"`, `ModifiedDate` is `"DateAndTime"`,
   `CreationDate` is `"DateAndTimeCreation"`; `sortBy: "Name"` returns an unsorted list. Every enum except `SDKMode`
   is a `const enum` — inlined at compile time, not iterable at runtime.
3. **`frameId` is the only wiring.** The container's DOM `id` must equal `config.frameId`; several frames need distinct
   ids (`editor-${fileId}`). Events that never fire mean the two differ.
4. **Script-tag configs are strings.** Only `"true"`/`"false"` become booleans; filter params are bare, case-sensitive
   keys (`sortBy=AZ`); bracket and lowercase forms are silently dropped; pass `src` explicitly; `init=true`
   auto-initializes ([config-reference](references/config-reference.md#script-tag-configs)).
5. **Loader and waiting.** `noLoader` defaults to `true` but Manager and System force the loader on; `waiting: true`
   parks a frame until `setConfig` (ignored by System); a System frame never reports completion — call `setIsLoaded()`.
6. **Lifecycle.** `destroyFrame()` is synchronous and complete: the container keeps its `id`, listeners and pending calls
   go, the registry entry is deleted, `init*` may follow at once. Re-initializing an existing `frameId` reuses the
   instance; a second instance on a live container leaks listeners and duplicates iframes. React StrictMode
   double-invokes effects in dev — guard with a ref ([react](references/frameworks/react.md)). Keep editor state
   across tabs by hiding with CSS, not unmounting. `window.DocSpace` is browser-only — never touch it during SSR.
7. **CSP and frame headers.** The host origin must be allow-listed (Developer Tools → Embed SDK, or
   `PUT /api/2.0/security/csp`; `GET` is anonymous on client 4.0.0), or the frame shows the SDK's CSP page
   (`SDKError.code === "CSP_VIOLATION"` on 2.2+, message-string match before). `checkCSP: false` only silences the
   early check. CSP is not the only wall: `X-Frame-Options` without `frame-ancestors` (Step 0) and third-party-cookie
   blocking (token table) both kill the frame with no SDK event.
8. **Call methods after `onAppReady`.** Earlier calls reject with `DISCONNECTED` ("Message bus is not connected with
   frame"); later ones are bounded by `methodTimeout` → `TIMEOUT`.
9. **The portal never rejects a method — API failures resolve** (client 4.0.0 wraps every handler in `try/catch` and
   returns the error as the payload). Check `status !== 200` on every API-backed result: `login()` with wrong
   credentials, `createRoom()` with `402` (plan limit → `{portal}/portal-settings/payments/portal-payments`). A method
   the mode's page lacks resolves with the string `"Wrong method for this mode"` ([methods](references/methods.md)).
10. **Sign in the cheap way first.** `getUserInfo()` and compare the email before `login(email, hash)`; passwords
    travel only as hashes (`getHashSettings` → `createHash` → `login`); the plaintext `password` and `session`
    arguments never reach the portal from the frame; a `url` under `/confirm/` in the result means a second
    factor is pending and needs a second `login` with the `code` argument, which client 4.0.0 does not read
    yet (token table).
11. **Uploads and files.** `upload(file)` works only in Forms mode (`MODE_MISMATCH` elsewhere, 120 s timeout); Uploader
    accepts files only through its UI. `createFile(folderId, title, templateId?, formId?)` is `POST /files/{folderId}/file`:
    the **format comes from the extension in `title`** (a PDF form copied under a `.docx` title stops being a form),
    `folderId` is a folder from `getFolderInfo()` or a selector — never a section's `rootFolderId`. Personal mode
    answers `"Wrong method for this mode"` to every data method.
12. **`executeInEditor(cb, data)` calls `cb(editor, asc, data)` — three arguments** (SDK <= 2.1 typed it wrong). Create the
    connector yourself (`editor.createConnector()`); fill forms with the Document Builder API inside
    `connector.callCommand` (`GetAllForms()` → `SetText`/`SetChecked`, data through `Asc.scope`, no closures).
    `executeMethod("SetFormValue" | "GetFormValue" | "GetAllForms" | "GetFormsByTag")` **does not exist** despite the
    docs and sample — unknown names succeed silently. Read `GetFormsData()` back
    ([editor-automation](references/editor-automation.md)).
13. **OAuth.** Prefer `getToken` over a static `accessToken` (the SDK cannot refresh a static token); exchange and
    refresh on the backend; `client_secret` and refresh tokens never reach the browser; rotation is strict — the old
    refresh token dies when the new pair is issued, persist atomically, never retry with the old one. Scopes:
    `GET {portal}/api/2.0/scopes` (authenticated), discovery `GET {portal}/.well-known/openid-configuration`. Missing
    both `getToken` and `accessToken` → `TOKEN_RESOLVE_FAILED` + `onAuthError`. Never commit `requestToken`s or hashes.
14. **Match the SDK to the portal.** npm older than the portal lacks modes and fields (2.0.0 and 2.1.0 have no uploader/forms/
    chat/personal/OAuth); npm newer produces frames the portal cannot serve. Both look like a blank frame or `TIMEOUT`. When npm >
    portal, load the portal script and keep npm for types (Step 0).

## Authentication decision tree

```
Who is the frame's user?
├─ Signed in, page on the portal's site               → nothing to do
├─ Signed in, page on another origin                  → expect 401s from third-party-cookie blocking;
│                                                        use OAuth getToken (or accept the limit explicitly)
├─ Anonymous, public room                             → public-room + id + requestToken
├─ Programmatic password login                        → hidden System frame: getHashSettings → createHash →
│    store hash server-side; each visit: getUserInfo → login(email, hash) → status !== 200 = failure
│    (2FA on the account → this path cannot finish; go OAuth)
├─ ONLYOFFICE Apps OAuth app (SDK >= 2.2)             → getToken: () => fetch("/api/token"); backend does
│    authorization-code (+PKCE), refresh 30–60 s before expiry, strict rotation
├─ Backend automation, nobody in the browser          → API key against REST, not a frame
└─ Host portal is an OAuth provider (Nextcloud-style) → providerName + inviteKey/emplType/uid (forms/chat/personal)
```

Multi-frame page: one frame logs in, the rest wait with `waiting: true` and are re-initialized afterwards.
Recipes: [auth-recipes](references/auth-recipes.md).

## Events essentials

- `onAppReady` — methods may be called; `onContentReady` — reveal the iframe, drop your spinner.
- Selector payloads differ: room-selector fires an **array** (`items[0].id`, `.label`, `.requestTokens[0].requestToken`);
  file-selector an **object** (`item.id`, `.title`, `.documentType`).
- Manager payloads are the portal's file object (client 4.0.0): `onFileManagerClick` fires for files only with `id`,
  `title`, `fileExst`, `fileType`, `folderId`, `security`, `viewUrl`, `webUrl`…; `onEditorOpen` adds `share` and `action`
  (`"view" | "fill" | "edit"`), or carries the freshly created file. Registering either handler suppresses the portal's
  own open action — open the file in your own frame.
- `onNoAccess` → request-access flow; `onNotFound` → the entity was deleted, drop your mapping.
- `downloadToEvent: true` + `onDownload(url)` intercepts downloads; `onGetExternalData`/`onSetExternalData` bridge host
  storage (correlated by `callId`). Full table: [events](references/events.md).

## Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| Blank iframe | missing `id` (editor/viewer); empty or invalid `src` | console: `SDK Warning: src is empty…`; rule 1 |
| Browser refuses to display the frame | no `frame-ancestors` header on that page, or origin not in it | Step 0 probe; portal admin |
| CSP error page inside the frame | host origin not allow-listed | Developer Tools → Embed SDK, or the CSP API |
| Frame loads, its API calls return 401 while the portal tab is signed in | third-party cookies blocked cross-origin | OAuth `getToken` or same-site hosting |
| `login()` returns `status !== 200` for a correct password | 2FA on the account | OAuth; sign in on the portal in another tab; disable 2FA for the integration account |
| Chat shows only "Chat history", no composer | guest user, AI disabled, or OAuth token lacks profile scopes | [chat](references/modes/chat.md) |
| `Message bus is not connected…` | method before `onAppReady` | rule 8 |
| `SDKError TIMEOUT` | frame not answering; method unsupported by mode or portal version | rule 14; [methods](references/methods.md) |
| Events never fire | `frameId` ≠ container id | rule 3 |
| `window is undefined` | SSR | `useEffect` / dynamic import |
| Broken or duplicated frame in dev (React) | StrictMode double effects | rule 6 |
| `login` "succeeds" but no session | `status` not checked | rule 9 |
| `"Wrong method for this mode"` | method not implemented by that page | switch mode (System or Manager) |
| Script-tag `filter[...]` or lowercase params ignored | legacy syntax not recognized | rule 4 |
| `MODE_MISMATCH` from `upload()` | mode ≠ forms | rule 11 |
| `TOKEN_RESOLVE_FAILED` / `onAuthError` | `getToken` threw or missing | check the token endpoint |
| `createFile` made the wrong format | extension taken from `title` | rule 11 |
| REST 403 on a folder you can see | `rootFolderId` used as destination | use `folderId` — REST is outside this skill |
| `api.js` loaded but `window.DocSpace` empty | two consumers race on the script tag | remove and re-append the tag |
| System frame loads forever | it has no content | `frames[frameId].setIsLoaded()` |

`SDKError.code`: `TIMEOUT`, `DISCONNECTED`, `CSP_VIOLATION`, `MODE_MISMATCH`, `INVALID_CONFIG`, `UPLOAD_FAILED`,
`PARSE_ERROR`, `TOKEN_RESOLVE_FAILED`.

## Before handing over

1. Every `TFrameConfig` passes `node $SKILL/scripts/validate-config.mjs '<json>'` — fix and re-run, at most 3 iterations.
2. Run the self-check protocol in [testing](references/testing.md#self-check-protocol--run-it-before-handing-the-integration-over):
   probe, attach, clean console, `onAppReady`, one real action per mode, the auth failure path.
3. Report portal version, connection method, the origins to allow-list, the modes used, and every line outside this
   skill you touched (REST, 2FA, portal headers).

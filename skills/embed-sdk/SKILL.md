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

The Embed SDK (`@onlyoffice/docspace-sdk-js`, historically "JavaScript SDK") embeds
ONLYOFFICE Apps UI into a host page as an iframe and talks to it over postMessage.
You create an instance per frame, configure it with a `TFrameConfig`, and call promise-based
methods on it. This file is the router: read the matching reference file before writing code.

## Pinned facts

- Package: `@onlyoffice/docspace-sdk-js`, current version **2.2.0** on npm (`npm i
  @onlyoffice/docspace-sdk-js@^2.2.0`). Node >= 18 to build. GitHub tag `v2.2.0`.
- Three ways to connect:
  1. **npm** (CJS/ESM): `import SDK from "@onlyoffice/docspace-sdk-js"` — the default for any
     project with a bundler and a portal on SDK 2.2 (ONLYOFFICE Apps 4.0).
  2. **IIFE script tag from the portal**: `<script src="{portal}/static/scripts/sdk/{version}/api.js">`.
     Config can be passed as query params on the script URL; `init=true` auto-initializes.
     Use it for pages without a build step and for portals **older** than the npm package.
  3. **React wrapper** `@onlyoffice/docspace-react` (props: `url`, `email`,
     `onRequestPasswordHash`, `onUnsuccessLogin`, `onSetDocspaceInstance`) with a built-in
     login flow. It bundles **its own copy** of the SDK, which has lagged behind the wrapper's
     version number (2.1.0 shipped SDK 2.0.0). Read
     `node_modules/@onlyoffice/docspace-react/package.json` → `dependencies` and use the
     wrapper only when that bundled version matches the portal.
- Known portal bundle versions (`/static/scripts/sdk/{v}/api.js`): 1.0.1, 2.0.0, 2.1.0, 2.2.0.
- OAuth capability marker: the string `getToken` inside the portal's `api.js` → SDK >= 2.2.
- The global `window.DocSpace.SDK` (with the `frames` registry keyed by `frameId`) exists
  even with the npm import — the module sets it as a side effect.
- Instance methods are promise-based with a `methodTimeout` of 30 000 ms by default.

## Where to look things up — and which source wins

When sources disagree, the higher one wins. Say so to the user instead of switching back and
forth between them:

1. **The installed package's types** — `node_modules/@onlyoffice/docspace-sdk-js/dist/types/main.d.ts`
   (`TFrameConfig`, `TFrameEvents`, `SDKInstance` signatures, enums). They are the exact
   contract of the version the project runs.
2. **The docs site**, for the portal's SDK version:
   - `https://api.onlyoffice.com/docspace/javascript-sdk/get-started/` (+ `quickstart/`,
     `playground/`, `authentication-security/`)
   - `https://api.onlyoffice.com/docspace/javascript-sdk/embedding-modes/{manager|viewer|editor|room-selector|file-selector|system|uploader|frame}-mode/`
   - `https://api.onlyoffice.com/docspace/javascript-sdk/customization/{theming|locale|ui-elements}/`
   - `https://api.onlyoffice.com/docspace/javascript-sdk/events-and-callbacks/` (published with SDK 2.2)
   - `https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/` — generated API
     reference (`classes/SDK/`, `classes/SDKInstance/`, `classes/SDKError/`, `type-aliases/…`,
     `enumerations/…`, `variables/…`)
   - samples: `https://api.onlyoffice.com/docspace/javascript-sdk/samples/basic-samples/init-manager/`
     and its siblings (`basic-samples/`, `advanced-samples/`, `integration-samples/`); live
     demo `https://demo-embed.onlyoffice.com/`
   Section URLs without a final page segment 404. Pages are HTML; the site offers
   "View as Markdown" per page, there is no `llms.txt`.
3. **The SDK sources** on GitHub, at the tag matching the installed version:
   `https://raw.githubusercontent.com/ONLYOFFICE/docspace-sdk-js/v2.2.0/src/types/index.ts`
   (the complete `TFrameConfig`/events contract), `.../src/enums/index.ts` (all enums incl.
   the sort API values), `.../src/constants/index.ts` (`defaultConfig`). A local clone, if
   present, is equivalent — never rely on it existing.
4. **This skill** — the process, the traps and the portal behaviours the types do not
   express. Facts marked "client 4.0.0" were verified against that portal release.

Forms, Chat and Personal modes may have no docs-site page; the types, the SDK README and this
skill's references cover them.

## What this skill does not cover — say so when you reach the edge

- **The portal REST API** (`/api/2.0/...`): room and folder semantics (`folderId` is the
  destination folder, `rootFolderId` is the root of a section — using it as a destination
  returns 403), file templates, sharing, users. Sources: the REST reference at
  `https://api.onlyoffice.com/docspace/api-backend/get-started/basic-concepts/` (its
  `usage-api/` section has one page per operation) and the `@onlyoffice/docspace-api-sdk`
  packages. The SDK exposes only the methods in [methods](references/methods.md).
- **The editor's own APIs** (Docs API, Document Builder, plugins) beyond what
  [editor-automation](references/editor-automation.md) needs.
- **Two-factor authentication.** `login()` cannot complete a 2FA login (see the token table).
- **Diagnosing one portal's deployment** — headers, reverse proxies, cookie policies. Step 0
  gives the probes; interpreting an unusual result is the portal admin's job.

When a task crosses one of these lines, name the line to the user, point at the source, and do
not guess.

## Which token is which

"Token" means five different things around this SDK. Pick the row before writing auth code.

| Thing | Where it lives | What it grants | Where the SDK takes it | What it cannot do |
|---|---|---|---|---|
| **Password hash** (`createHash`) | your backend, encrypted | a portal session for that user via `login(email, hash)` in a System frame | `login()` | complete a login when 2FA is on (the portal ignores any code); survive third-party-cookie blocking (the session is a cookie) |
| **Session cookie** `asc_auth_key` | the browser, on the portal origin | every request the iframe makes | nothing to pass — the frame just has it or not | be read from a cross-origin iframe when the browser blocks third-party cookies → `401` inside the frame despite a live session |
| **`requestToken`** (share key) | a room's external share link, or `items[0].requestTokens[0].requestToken` from a room-selector | anonymous access to that one room | `public-room` (`id` + `requestToken`), manager with `rootPath: "/rooms/share"` | anything outside the shared room; must never be committed |
| **OAuth access token** | your backend (refresh token stays there) | API calls as the OAuth user, sent as `Bearer` by the frame, no cookie involved | `getToken` callback (preferred) or static `accessToken`, SDK >= 2.2 | outlive its expiry without `getToken` re-fetching it |
| **API key** (Developer Tools → API keys) | your backend | REST calls as the key's owner, `Bearer` scheme, scopes = key permissions | REST only in verified integrations; the frame passes whatever `getToken` returns as `Bearer` and the portal registers an API-key Bearer handler, so it **may** work in OAuth mode — unverified, confirm with `getUserInfo()` after `onAppReady` before relying on it | be refreshed or revoked per session; expose the key to the browser safely |

Two consequences that were not obvious to real integrators:

- **A live portal session is not enough for a cross-origin embed.** The frame authenticates
  with the portal cookie. Safari and Chrome with third-party-cookie blocking withhold it inside
  an iframe on another origin, `document.hasStorageAccess()` reporting `true` notwithstanding;
  the symptom is `401` from the frame's API calls while the portal tab is signed in. Fixes, in
  order: OAuth `getToken` (the frame then sends `Bearer`, cookies are irrelevant), or hosting
  the page on the portal's site (same-site cookies). Neither CSP nor `checkCSP` has anything to
  do with this.
- **2FA is a hard stop for `login()`.** The portal's SDK handler reads only `email` and
  `passwordHash` (client 4.0.0); the `password` and `session` arguments are ignored, and there is
  no code parameter — the portal's `POST /authentication/{code}` step is not reachable through
  the SDK. For users with 2FA enabled: use OAuth, or let the user sign in on the portal in a
  separate tab and rely on the session, or disable 2FA on the integration account. Do not
  build a "code" field around `login()` — it will look right and never finish.

## Step 0 — discover the portal and pick the connection method

Before generating integration code, ask the user:

1. **Which ONLYOFFICE Apps portal** they are connecting to (the `src` URL). Without it you cannot
   check CSP or the portal's SDK version.
2. The portal's ONLYOFFICE Apps/SDK version, if they know it.

If the version is unknown, detect it. `{portal}/static/scripts/sdk/{v}/api.js` is **always
publicly accessible** (no auth), so a plain GET from anywhere (curl, browser, CI) works:
probe the known versions above (200 → available, 404 → not); optionally sniff the bundle
text for capability markers (`getToken` → >= 2.2).

The whole discovery is one command — run it and paste the recommendations into your notes:

```
node scripts/probe-portal.mjs https://portal.example.com --origin https://your-host.example
```

It probes the bundle versions, sniffs the OAuth marker, reads the frame headers of
`/old-sdk/system`, `/sdk/room-selector` and `/sdk/chat`, checks OAuth discovery
(`/.well-known/openid-configuration`) and reads the CSP allow-list (`GET /api/2.0/security/csp`
answers anonymously on client 4.0.0). Without Node at hand, the header part by hand:

```
curl -sI -H "Accept: text/html" {portal}/old-sdk/system | grep -i -E "x-frame-options|content-security-policy"
curl -sI -H "Accept: text/html" {portal}/sdk/room-selector | grep -i -E "x-frame-options|content-security-policy"
```

What the headers mean (client 4.0.0, verified on a live portal): `/old-sdk/system` — the page
behind `initSystem` and the hash-login flow — carries `X-Frame-Options: SAMEORIGIN`; the
`/sdk/*` pages do not. Every page also gets `Content-Security-Policy: frame-ancestors …`
built from the portal's CSP allow-list. Browsers let `frame-ancestors` override
`X-Frame-Options`, so the system frame embeds **only while the CSP header is present and lists
your origin**; `X-Frame-Options` without a `frame-ancestors` header means the allow-list is
not reaching that response (empty list, CSP cache, a proxy stripping headers) and the browser
refuses the frame with no SDK event. Report that line to the portal admin verbatim.

Then choose:

| Situation | Recommendation |
|---|---|
| Portal on SDK 2.2 (ONLYOFFICE Apps 4.0), project has a bundler | **npm 2.2.0** |
| Portal older than the npm package | Portal-hosted IIFE (always in sync with the portal backend: frame paths, postMessage protocol, mode set); keep the npm package for TypeScript types only. Do not use features the portal lacks |
| No build step (plain HTML, CMS page) | Portal-hosted IIFE |
| Portal version undetectable | Portal-hosted IIFE as the safe default |

Quick start (npm): `new SDK()` → `sdk.initManager({ frameId: "ds-frame", src: "https://portal" })`
→ later `instance.destroyFrame()`. With the IIFE: `window.DocSpace.SDK.initManager(...)`.

## Routing table

Read the mode's reference file before writing code.

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
| AI chat | `chat` | `initChat` | `src` (`agentId` optional); signed-in non-guest user with AI enabled | [chat](references/modes/chat.md) |
| Personal files | `personal` | `initPersonal` | `src` | [personal](references/modes/personal.md) |
| Programmatic form filling inside the editor | `editor` + connector | — | — | [editor-automation](references/editor-automation.md) |

Other references: [config-reference](references/config-reference.md) (all fields by mode),
[methods](references/methods.md), [events](references/events.md),
[auth-recipes](references/auth-recipes.md), [testing](references/testing.md),
[frameworks/react](references/frameworks/react.md) ·
[nextjs](references/frameworks/nextjs.md) · [vue](references/frameworks/vue.md) ·
[angular](references/frameworks/angular.md).

## Critical rules

Violating any of these produces integrations that look right but fail.

### Config and initialization

1. `id` is required for editor/viewer. Without it the frame opens an empty `/doceditor`
   with no explicit error.
2. public-room needs **both** `id` (room id) and `requestToken`. The frame URL is
   `/sdk/public-room?folder={id}&key={requestToken}`; without `id` the portal's server render
   fails and the frame shows a white "Something went wrong" screen with no event.
   `agentId` is optional for chat (omit → user chat).
3. Sort API values differ from enum key names: `FilterSortBy.Name = "AZ"`,
   `ModifiedDate = "DateAndTime"`, `CreationDate = "DateAndTimeCreation"`. A handwritten
   `sortBy: "Name"` silently returns an unsorted list — always use the enum constants.
4. Every enum except `SDKMode` is a `const enum`: values are inlined at compile time,
   `Object.values(...)` on them does not exist at runtime.
5. The DOM container's `id` must equal `config.frameId` — that string is the only wiring
   between markup and the SDK. Multiple frames on one page need unique `frameId`s
   (e.g. `block-1`, `editor-${fileId}`).
6. Script-tag configs arrive as strings: only `"true"`/`"false"` are converted to booleans;
   numeric options stay strings. Pass `src` explicitly even when it equals the script
   origin. `init=true` enables auto-initialization. Filter params are passed as **bare,
   case-sensitive keys** (`count=25&sortOrder=descending&sortBy=AZ`) — the parser routes
   them into `config.filter` by exact match. Legacy bracket/lowercase forms
   (`filter[count]`, `sortorder`) are **not recognized** (verified by SDK tests): they land
   as junk root-level keys and the filter silently keeps its defaults.
7. `noLoader` defaults to `true`, but Manager and System modes force the loader on.

### Lifecycle

8. `destroyFrame()` is synchronous and complete: it replaces the iframe with a placeholder
   `<div>` that keeps the same `id` (`frameId`) and shows `destroyText`, removes the `message`
   listener, rejects pending calls, and deletes the entry from `DocSpace.SDK.frames`. You may
   call `init*` on the same `frameId` immediately afterwards — nothing to await. Re-initializing
   an existing `frameId` **without** destroying is also legal (the registry reuses the
   instance); what breaks is creating a second instance for a container that still holds a
   live frame under another id → leaked listeners and duplicate iframes. Pattern:
   `instance?.destroyFrame?.()` then `init*`.
9. React StrictMode double-invokes effects in dev → double init/destroy breaks the frame.
   Guard with a ref or disable StrictMode — see [frameworks/react](references/frameworks/react.md).
10. To keep editor state across tab switches, hide the frame with CSS (`display:none`)
    instead of unmounting it.
11. Browser only: `window.DocSpace` does not exist on the server. In Next.js initialize in
    `useEffect` or `dynamic(..., { ssr: false })`.

### CSP and frame headers

12. The host domain must be allow-listed on the portal
    (`{portal}/developer-tools/javascript-sdk`), or the SDK renders a CSP error page inside
    the iframe. Same-origin embedding skips the check. Production pattern: whitelist
    programmatically via `PUT /api/2.0/security/csp` (admin session or API key) when the
    integration is connected; `GET /api/2.0/security/csp` answers anonymously (client 4.0.0),
    so reading the current list needs no credentials — `probe-portal.mjs` does it.
    `checkCSP: false` is not a fix — it only disables early diagnostics.
13. In SDK < 2.2 the CSP failure is distinguishable only by the exact message string
    ("The current domain is not set in the Content Security Policy (CSP) settings.");
    in 2.2+ check `SDKError.code === "CSP_VIOLATION"`.
13a. CSP is not the only barrier: `X-Frame-Options` without a `frame-ancestors` header on the
    frame path (Step 0 probe) and third-party-cookie blocking (token table) both produce a
    dead frame with no SDK event. Check them before touching the config.

### Methods and their results

14. Methods called before the frame is ready fail with
    `SDKError(DISCONNECTED, "Message bus is not connected with frame")`; after that each
    call is bounded by `methodTimeout` (30 s) → `TIMEOUT`. Call methods after `onAppReady`.
15. **The portal never rejects a method call — API-level failures resolve** (verified in
    the ONLYOFFICE Apps client dispatcher: every method is wrapped in `try/catch` and the caught
    error is returned as the payload). Inspect the payload of any API-backed method:
    `status !== 200` means failure. Notorious cases: `login()` (invalid credentials) and
    `createRoom()` (`status: 402` = pricing plan limit — link the user to
    `{portal}/portal-settings/payments/portal-payments`). A method the current mode's page
    does not implement resolves with the literal string `"Wrong method for this mode"`.
    Rejections (`SDKError`) come only from the SDK transport layer. Support matrix and
    details: [methods](references/methods.md).
16. Before `login`, check for a live session: `getUserInfo()` and compare the email —
    logging in again is redundant and slow. `login()` cannot pass a 2FA code (token table).
17. `upload()` works **only in Forms mode** (`MODE_MISMATCH` otherwise); Uploader mode
    accepts files only through its UI. Upload timeout is 120 s.
18. `createFile(folderId, title, templateId?, formId?)` is `POST /files/{folderId}/file` on the
    portal: the **file format comes from the extension in `title`** — a PDF form copied with a
    `.docx` title becomes a plain document and stops being a form; `templateId`/`formId` only
    supply the content. `folderId` is the destination folder (from `getFolderInfo()` of an open
    Manager frame, a selector payload, or your mapping) — never a section's `rootFolderId`. The
    Personal page implements only `setConfig` and `navigateSection`; every data method resolves
    with `"Wrong method for this mode"` there.
18a. `executeInEditor(cb, data)` invokes `cb(editor, asc, data)` — **three** arguments.
    SDK 2.2.0 types the callback that way; SDKs <= 2.1 declared `(instance, data?)`, which
    was wrong. `editor` is the DocsAPI object: call
    `editor.createConnector()` yourself. Form fields are filled with the Document Builder
    API inside `connector.callCommand` (`Api.GetDocument().GetAllForms()` → `SetText`,
    `SetChecked`, …) with data passed through `Asc.scope`. `executeMethod("SetFormValue")`,
    `"GetFormValue"`, `"GetAllForms"`, `"GetFormsByTag"` **do not exist as plugin methods**
    even though api.onlyoffice.com documents them and ships a sample using them — no sdkjs
    release implements them, and the connector does not error on unknown names, the call just
    silently does nothing. Read `GetFormsData()` back to verify.
    Details: [editor-automation](references/editor-automation.md).

### Authentication — security checklist

19. Passwords travel only as hashes: `getHashSettings()` → `createHash(password, settings)`
    → `login(email, hash)`. The plaintext `password` parameter of `login` is dev-only and the
    portal ignores it anyway.
20. OAuth: prefer the `getToken` callback over a static `accessToken` (the SDK cannot
    refresh a static token); do the code exchange and refresh on the backend;
    `client_secret` and refresh tokens must never reach the browser. Refresh-token rotation
    is strict: the old refresh token dies the moment a new one is issued, so persist the new
    pair atomically and never retry with the old one. Missing both `getToken` and
    `accessToken` → `TOKEN_RESOLVE_FAILED` + the `onAuthError` event. Scope catalogue:
    `GET {portal}/api/2.0/scopes` (authenticated); anonymous discovery:
    `GET {portal}/.well-known/openid-configuration`.
21. Never commit `requestToken`s or password hashes to source; avoid returning
    `passwordHash` to the browser (see [auth-recipes](references/auth-recipes.md) — the
    OAuth flow removes that need).

### Versioning

22. The SDK version must match the portal. An npm package older than the portal does not
    know newer modes/fields (2.0.0 has no forms/chat/personal); one newer than the portal
    generates frames the portal cannot serve. Both failure modes look like a blank frame
    or `TIMEOUT` with no clear error. When npm > portal, use the portal-hosted IIFE and
    keep npm for types only (Step 0).

## Authentication decision tree

```
Who is the frame's user?
├─ Already signed in to ONLYOFFICE Apps, page on the portal's site → nothing to do
├─ Already signed in, page on another origin → expect third-party-cookie 401s in
│    Safari/Chrome; use OAuth getToken (or accept the limitation explicitly)
├─ Anonymous, public room                  → public-room + id (room) + requestToken
├─ Programmatic password login             → hidden system frame:
│    getHashSettings → createHash → store hash server-side →
│    on each visit: getUserInfo (session alive?) → login(email, hash) → check status !== 200
│    (2FA enabled on the account → this path cannot finish; go OAuth)
├─ ONLYOFFICE Apps OAuth app (SDK >= 2.2)  → getToken: () => fetch("/api/token")
│    backend: authorization-code (+PKCE), refresh 30–60 s before expiry, rotate refresh token
├─ Backend automation without a user in the browser → API key against REST, not a frame
└─ Host portal with an OAuth provider      → providerName + inviteKey/emplType/uid
                                             (forms/chat/personal modes)
```

Multi-frame page: one frame performs the login; park the others with `waiting: true` and
re-init them afterwards. Full recipes: [auth-recipes](references/auth-recipes.md).

## Events essentials

- `onAppReady` = frame initialized, methods may be called; `onContentReady` = content
  visible — the moment to reveal the iframe and drop your spinner.
- **Selector payloads differ in shape**: room-selector fires with an **array**
  (`items[0].id`, `.label`, `.icon`, `.requestTokens[0].requestToken`); file-selector with
  an **object** (`item.id`, `.title`, `.icon`, `.documentType`).
- **Manager payloads are the portal's file object** (client 4.0.0): `onFileManagerClick`
  fires for files only (a folder click navigates instead) with the full item —
  `id`, `title`, `fileExst`, `fileType`, `folderId`, `security`, `viewUrl`, `webUrl`, …;
  `onEditorOpen` fires with the same item plus `share` and `action` (`"view"` | `"fill"` |
  `"edit"`), or with the freshly created file when the user creates a document. Read
  `id`/`title`/`fileExst` — do not write heuristics for "is this a file".
- `onNoAccess` → offer a "request access" flow; `onNotFound` → the room/folder was deleted,
  drop your stored mapping.
- `onEditorOpen` — intercept opening the editor from the manager (e.g. open your own modal).
- `downloadToEvent: true` + `onDownload(url)` — intercept downloads (bridge files into the
  host system).
- External storage bridge: `onGetExternalData` (request/response correlated by `callId`,
  sync or Promise) / `onSetExternalData` (fire-and-forget).
- Full table with payload shapes: [events](references/events.md).

## Troubleshooting

| Symptom | Cause | Check / action |
|---|---|---|
| Blank iframe | missing `id` (editor/viewer); empty/invalid `src` | console: `SDK Warning: src is empty…` |
| Browser refuses to display the frame ("refused to connect" / blocked by X-Frame-Options) | no `frame-ancestors` CSP on that response, or your origin not in it | Step 0 header probe; portal admin: CSP allow-list / headers |
| CSP error page inside frame | host domain not allow-listed | add it in Developer Tools → Embed SDK, or via the CSP API |
| Frame loads, its API calls return 401 while the portal tab is signed in | third-party cookies blocked in a cross-origin iframe | OAuth `getToken` (Bearer, no cookie) or same-site hosting — token table |
| `login()` returns `status !== 200` for a correct password | 2FA enabled on the account; the SDK cannot pass a code | OAuth, or sign in on the portal in another tab, or disable 2FA for the integration account |
| Chat frame shows only "Chat history", no composer | user is a guest/visitor, AI is disabled on the portal, or the OAuth token lacks the scopes to load the profile | sign in a full user, enable AI in portal settings, check token scopes — [chat](references/modes/chat.md) |
| `Message bus is not connected…` | method called before `onAppReady` | move the call into the handler |
| `SDKError TIMEOUT` | frame not responding for 30 s; method unsupported by mode/portal version | verify mode and portal version |
| Events never fire | `frameId` ≠ container DOM id | compare markup and config |
| `window is undefined` | SSR | `useEffect` / dynamic import |
| Broken/duplicated frame in dev (React) | StrictMode double effects | guard or disable StrictMode |
| `login` "succeeds" but no session | `response.status` not checked | rule 15 |
| Method resolves with `"Wrong method for this mode"` | method not implemented by the current mode's page | see the support matrix in [methods](references/methods.md); switch mode (often System or Manager) |
| Script-tag `filter[...]`/lowercase params ignored | legacy bracket syntax not recognized | use bare case-sensitive keys: `count=`, `sortOrder=`, `sortBy=` (rule 6) |
| `MODE_MISMATCH` from `upload()` | mode ≠ forms | use Forms, or the Uploader UI |
| `TOKEN_RESOLVE_FAILED` / `onAuthError` | `getToken` threw or missing | check the backend token endpoint |
| `createFile` produced the wrong format | extension taken from `title` | rule 18 |
| REST call returns 403 on a folder you can see | `rootFolderId` used as a destination | use `folderId` — REST is outside this skill |
| `api.js` loaded but `window.DocSpace` empty | script-tag race between two consumers | remove and re-append the script tag |
| System frame loads forever | it has no content | call `frames[frameId].setIsLoaded()` |

`SDKError.code` values: `TIMEOUT`, `DISCONNECTED`, `CSP_VIOLATION`, `MODE_MISMATCH`,
`INVALID_CONFIG`, `UPLOAD_FAILED`, `PARSE_ERROR`, `TOKEN_RESOLVE_FAILED`.

## Validation protocol

Before delivering integration code, validate the config you generated:

```
node scripts/validate-config.mjs '<TFrameConfig JSON>'
```

On errors, fix the config and re-run — at most 3 iterations. Do not deliver code whose
config fails validation.

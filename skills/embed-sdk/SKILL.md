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

The Embed SDK (`@onlyoffice/docspace-sdk-js`, historically "JavaScript SDK") embeds ONLYOFFICE Apps UI into a host
page as an iframe and talks to it over postMessage: one instance per frame, configured by a `TFrameConfig`, driven by
promise-based methods and events. This file is the router — read the matching reference before writing code.

## Pinned facts

- Package `@onlyoffice/docspace-sdk-js`, current version **2.2.0** (`npm i @onlyoffice/docspace-sdk-js@^2.2.0`,
  GitHub tag `v2.2.0`, Node >= 18). The portal serves the same code as a script: `{portal}/static/scripts/sdk/{version}/api.js`
  (known versions 1.0.0, 1.0.1, 2.0.0, 2.1.0, 2.2.0). Modes and fields by version: [discovery](references/discovery.md#capabilities-by-portal-sdk-version).
- 2.2.0 exports `SDK` as the default only — `import { SDK }` is `undefined` — plus `SDKInstance`, `SDKError`,
  `SDKErrorCode`, the enums and the types; 2.0 and 2.1 export nothing but the default. The type declarations make every
  enum except `SDKMode` and `SDKErrorCode` a `const enum`, so `import { FilterSortBy }` fails to compile under
  `isolatedModules` or `verbatimModuleSyntax` (TS2748; the Vite `react-ts` template sets the latter), and against 2.0/2.1
  a named enum import that reaches runtime is `undefined`. Write the string values, typed with `TFilterSortBy`, `TTheme`, ….
- `window.DocSpace.SDK` (with the `frames` registry keyed by `frameId`) exists even with the npm import.
- Methods resolve or reject within `methodTimeout` (30 000 ms by default, SDK 2.2).
- `@onlyoffice/docspace-react` bundles its own SDK copy that has lagged behind its version number; read
  `node_modules/@onlyoffice/docspace-react/package.json` before using it ([discovery](references/discovery.md#the-react-wrapper)).

## Sources, and which one wins

When sources disagree, the higher one wins — say so to the user instead of switching between them.

1. **The installed package's types**: `node_modules/@onlyoffice/docspace-sdk-js/dist/types/main.d.ts` — the exact contract of the version the project runs.
2. **The docs site** for the portal's SDK version. The section has no landing page; it starts at the introduction
   `https://api.onlyoffice.com/docspace/javascript-sdk/get-started/`, with the guides
   `get-started/{quickstart|playground|authentication-security}/` beside it, one guide per mode under
   `embedding-modes/{manager|viewer|editor|room-selector|file-selector|system|uploader|frame}-mode/`, the generated
   reference by kind under `usage-sdk/{classes|type-aliases|enumerations|variables}/` (`classes/SDK/`,
   `classes/SDKInstance/`, `type-aliases/TFrameConfig/`, `type-aliases/TFrameEvents/`, `enumerations/SDKMode/`,
   `enumerations/FilterSortBy/`, `variables/CSPApiUrl/`, …) and samples under
   `samples/{basic-samples|advanced-samples|react-samples}/`, one page each (`samples/basic-samples/init-manager/`).
   The reference is a subset of the exports: `SDKError`, `SDKErrorCode`, `TLoginResult`, `TSelectedRoom` and
   `TSelectedFile` have no page, so read those from the installed types. **A page exists as HTML only** — with or
   without the trailing slash. The `.md` twin every URL used to have, the `llms.txt` index (the site-wide one and the
   section's alike) and the live demo host have all been withdrawn and now answer 404 or fail to resolve, so fetch the
   page itself and expect HTML — a `.md` URL that 404s is the site having changed, not the page having moved.
3. **The SDK sources** at the matching tag: `https://raw.githubusercontent.com/ONLYOFFICE/docspace-sdk-js/v2.2.0/src/types/index.ts`,
   `…/src/enums/index.ts`, `…/src/constants/index.ts`. **That tag is not cut yet**: the skill describes 2.2.0
   because the behaviour it documents is 2.2.0's, but `v2.1.0` is the newest tag GitHub resolves, so those three
   URLs answer 404 until the release lands. Read the installed package's own sources in the meantime.
4. **This skill** — the process, the traps and the portal behaviours the types cannot express. Facts marked
   "client 4.0.0" were verified against the client's `release/v4.0.0` branch (last on 2026-09-23).

Forms, Chat, Personal and Public room have no guide page: `usage-sdk/classes/SDK/` documents their wrappers (`initForms`,
`initChat`, `initPersonal`, `initPublicRoom`), and this skill's mode references cover the rest. The samples show the calls,
not the checks — the login samples never look at `status` ([auth-recipes](references/auth-recipes.md)).

## Not covered here — name the edge when you reach it

- **The portal REST API** (`/api/2.0/...`): folders vs sections (`folderId` is a destination, `rootFolderId` the root of a
  section — using it as a destination returns 403), templates, sharing, users. Sources:
  `https://api.onlyoffice.com/docspace/api-backend/get-started/basic-concepts` (one page per operation under `usage-api/`)
  and the `@onlyoffice/docspace-api-sdk` packages.
- **The editor's own APIs** (Docs API, Document Builder, plugins) beyond [editor-automation](references/editor-automation.md).
- **One portal's deployment** — proxies, cookie policies, header rewrites. Step 0 probes; interpreting an odd result is the admin's job.

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
undetectable or portal unreachable from here → the portal script, newest known version first, and say the version was
not verified. The portal sends `X-Frame-Options: SAMEORIGIN` on every page except `/sdk/*` — the Manager's `/rooms/*`
and `/old-sdk/system` included — so those frames embed only while the CSP `frame-ancestors` header is present and lists
your origin (client 4.0.0); an `X-Frame-Options` line without `frame-ancestors` in the probe is a portal-side problem —
forward it to the admin verbatim.

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
| AI chat | `chat` | `initChat` | `src`; a signed-in user who is not a guest (`agentId` optional) | [chat](references/modes/chat.md) |
| Personal files | `personal` | `initPersonal` | `src` | [personal](references/modes/personal.md) |
| Fill forms inside the editor | `editor` + connector | — | — | [editor-automation](references/editor-automation.md) |

Also: [config-reference](references/config-reference.md) (fields that bite, by mode), [methods](references/methods.md),
[events](references/events.md), [auth-recipes](references/auth-recipes.md) (the token table, the flows, the two walls),
[troubleshooting](references/troubleshooting.md) (symptom → cause → fix), [testing](references/testing.md) (self-check
protocol), [frameworks/react](references/frameworks/react.md) · [nextjs](references/frameworks/nextjs.md) ·
[vue](references/frameworks/vue.md) · [angular](references/frameworks/angular.md).

## Authentication

Who is the frame's user decides everything; the token table and the recipes are in [auth-recipes](references/auth-recipes.md).

```
Signed in, page on the portal's site        → nothing to do
Signed in, page on another origin           → the portal tab's session does not reach a cross-site frame (401);
                                              OAuth getToken, or same-site hosting — not SameSite tweaks (auth-recipes §6)
Anonymous, public room                      → public-room + id + requestToken (viewer/editor take the same token)
Programmatic password login                 → hidden System frame: getHashSettings → createHash → login;
                                              each visit getUserInfo first; status !== 200 = failure;
                                              an account with 2FA cannot finish here on client 4.0.0 → OAuth
ONLYOFFICE Apps OAuth app (SDK >= 2.2)      → getToken: () => fetch("/api/token"); backend owns the code exchange,
                                              the refresh and the secrets (auth-recipes §2 checklist)
Backend automation, nobody in the browser   → API key against REST, not a frame
Host portal is an OAuth provider (Nextcloud)→ providerName + inviteKey/emplType/uid (forms/chat/personal)
```

**2FA on client 4.0.0 is a dead end for the hash flow.** The System page's dispatcher forwards only `email` and
`passwordHash`, so SDK 2.2.0's fifth `code` argument never reaches the portal there and the second call re-issues the same
`/confirm/…` challenge. The Manager page does read `code`, but it opens only for a user who is already signed in, so it
cannot finish a sign-in either. A "code" field wired to `login()` is therefore not the deliverable — say plainly that 2FA
accounts cannot use the hash flow and route them through OAuth ([auth-recipes §7](references/auth-recipes.md#7-two-factor-authentication)).

## Critical rules

Each one exists because the failure is silent: the integration looks right and does nothing.

1. **Required ids.** editor/viewer need `id` (an empty `/doceditor` opens otherwise, no error). public-room needs both
   `id` and `requestToken` (without `id` the page cannot load the room and renders its invalid-link error, no event).
2. **Enum values are API strings, not key names.** `FilterSortBy.Name` is `"AZ"`, `ModifiedDate` is `"DateAndTime"`;
   `sortBy: "Name"` returns an unsorted list; `sortBy` lives inside `filter`, at the top level it is ignored.
3. **`frameId` is the only wiring.** The container's DOM `id` must equal `config.frameId`; several frames need distinct
   ids (`editor-${fileId}`); reusing one id is destroy → init. Events that never fire mean the two differ.
4. **Script-tag configs are strings.** Only `"true"`/`"false"` become booleans; filter params are bare, case-sensitive
   keys (`sortBy=AZ`); bracket and lowercase forms are dropped; pass `src` explicitly ([config-reference](references/config-reference.md#script-tag-configs)).
5. **Loader and waiting.** `noLoader` defaults to `true` but Manager and System force the loader on. `waiting: true`
   keeps the iframe out of the DOM (ignored by System): a plain `setConfig` then rejects with `DISCONNECTED` — release it
   with `setConfig({ waiting: false }, true)` or a fresh `init*`. A System frame reports its own load on clients from
   late 2025 on; on an older portal it stays on the loader until you call `setIsLoaded()`.
6. **Lifecycle.** `destroyFrame()` is synchronous and complete, `init*` may follow at once; re-initializing a live
   `frameId` reuses the instance. React StrictMode double-invokes effects in dev — guard with a ref
   ([react](references/frameworks/react.md)). Keep editor state across tabs by hiding with CSS, not unmounting.
   `window.DocSpace` is browser-only — never touch it during SSR.
7. **CSP and frame headers.** The host origin must be allow-listed (Developer Tools → Embed SDK, or
   `PUT /api/2.0/security/csp`), or the frame shows the SDK's CSP page and `onAppError` receives the message string —
   the `SDKError` with code `CSP_VIOLATION` goes to the console only.
   `checkCSP: false` only silences the early check. `X-Frame-Options` without `frame-ancestors` (Step 0) and
   third-party-cookie blocking both kill the frame with no SDK event.
8. **Call methods after `onAppReady`.** Before the iframe has loaded they reject with `DISCONNECTED`; between the load
   and `onAppReady` they are sent to a page that may not be listening yet and end in `TIMEOUT` (`methodTimeout`).
   Manager and System frames fire `onAppReady` again on every `setConfig` — guard a handler that calls `setConfig`.
9. **The portal never rejects a method — API failures resolve** (client 4.0.0 wraps every handler in `try/catch` and
   returns the error as the payload). Check `status !== 200` on every API-backed result: `login()` with wrong
   credentials, `createRoom()` with `402`. A method the mode's page lacks resolves with the string
   `"Wrong method for this mode"` ([methods](references/methods.md#result-semantics--read-this-first)).
10. **Sign in the cheap way first.** `getUserInfo()` and compare the email before `login(email, hash)`; passwords travel
    only as hashes (`getHashSettings` → `createHash` → `login`); the plaintext `password` and `session` arguments never
    reach the portal; a `url` under `/confirm/` in the result is a pending second factor — see Authentication above.
11. **Uploads and files.** `upload(file)` works only in Forms mode (`MODE_MISMATCH` elsewhere, 120 s timeout); Uploader
    accepts files only through its UI. `createFile(folderId, title, templateId, formId)` — the types require all four,
    pass `""` for the ones you do not use — is `POST /files/{folderId}/file`:
    the **format comes from the extension in `title`** (a PDF form copied under a `.docx` title stops being a form),
    `folderId` is a folder from `getFolderInfo()` or a selector — never a section's `rootFolderId`. Personal mode
    answers `"Wrong method for this mode"` to every data method.
12. **`executeInEditor(cb, data)` calls `cb(editor, asc, data)` — three arguments** (SDK <= 2.1 typed it wrong). Create the
    connector yourself (`editor.createConnector()`); fill forms with the Document Builder API inside `connector.callCommand`
    (`GetAllForms()` → `SetText`/`SetChecked`, data through `Asc.scope`, no closures). `executeMethod("SetFormValue" |
    "GetFormValue" | "GetAllForms" | "GetFormsByTag")` **does not exist** despite the docs and sample — unknown names
    succeed silently. `executeInEditor` itself resolves as soon as the page has called your callback, with no result;
    a throw inside it shows only in the frame's console. Read `GetFormsData()` back ([editor-automation](references/editor-automation.md)).
13. **OAuth.** `getToken` over a static `accessToken`; the backend does the code exchange, the refresh and holds
    `client_secret` and the refresh token; scopes come from `GET {portal}/api/2.0/scopes` at setup time, never from
    memory. The refresh checklist and a token-endpoint sample are in [auth-recipes §2](references/auth-recipes.md#2-oauth-sdk--22--recommended).
    Missing both `getToken` and `accessToken` → `TOKEN_RESOLVE_FAILED` + `onAuthError`. Never commit `requestToken`s or hashes.
14. **Match the SDK to the portal.** npm older than the portal lacks modes and fields (2.0 and 2.1 have no uploader,
    forms, chat, personal or OAuth); npm newer produces frames the portal cannot serve. Both look like a blank frame or
    `TIMEOUT`. When npm > portal, load the portal script and keep npm for types (Step 0).

## Events essentials

`onAppReady` — methods may be called; `onContentReady` — reveal the iframe. Room-selector fires an **array**
(`items[0].id`, `.label`, `.requestTokens[0].requestToken`), file-selector an **object** (`item.id`, `.title`).
`onFileManagerClick` / `onEditorOpen` carry the portal's file object and, once registered, suppress the portal's own
open action — open the file in your own frame. `onNotFound` means the entity was deleted, drop your mapping. Full
table with payloads: [events](references/events.md). Symptom → cause → fix: [troubleshooting](references/troubleshooting.md).

## Before handing over

1. Every `TFrameConfig` passes `node $SKILL/scripts/validate-config.mjs '<json>'` — fix and re-run, at most 3 iterations.
2. Run the self-check protocol in [testing](references/testing.md#self-check-protocol--run-it-before-handing-the-integration-over):
   probe, attach, clean console, `onAppReady`, one real action per mode, the auth failure path.
3. Report portal version, connection method, the origins to allow-list, the modes used, and every line outside this
   skill you touched (REST, 2FA, portal headers).

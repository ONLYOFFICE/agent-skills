---
name: embed-sdk
description: >
  Embed ONLYOFFICE DocSpace into web apps with the DocSpace Embed SDK
  (@onlyoffice/docspace-sdk-js).
  Use when the user wants to embed a DocSpace file manager, document editor or
  viewer, room/file selector dialog, file uploader, forms gallery, AI chat, or
  personal files section; when configuring TFrameConfig, authentication (login
  hash flow, OAuth getToken, public room tokens), frame events, SDKInstance
  methods, or programmatic form filling via executeInEditor; or when debugging
  a blank/failing DocSpace iframe or CSP errors.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
  sdk-version: "2.2.0"
---

# ONLYOFFICE DocSpace Embed SDK

The Embed SDK (`@onlyoffice/docspace-sdk-js`, historically "JavaScript SDK") embeds
DocSpace UI into a host page as an iframe and talks to it over postMessage.
You create an instance per frame, configure it with a `TFrameConfig`, and call promise-based
methods on it. This file is the router: read the matching reference file before writing code.

## Pinned facts

- Package: `@onlyoffice/docspace-sdk-js`, current version **2.2.0**. Node >= 18 to build.
- Three ways to connect:
  1. **npm** (CJS/ESM): `import SDK from "@onlyoffice/docspace-sdk-js"`.
  2. **IIFE script tag from the portal**: `<script src="{portal}/static/scripts/sdk/{version}/api.js">`.
     Config can be passed as query params on the script URL; `init=true` auto-initializes.
  3. **React wrapper** `@onlyoffice/docspace-react` (props: `url`, `email`,
     `onRequestPasswordHash`, `onUnsuccessLogin`, `onSetDocspaceInstance`) with a built-in
     login flow. Warning: the wrapper bundles **its own copy** of the SDK, and the bundled
     SDK version does not match the wrapper's own version (verified: wrapper 2.1.0 bundles
     SDK 2.0.0 — no forms/chat/personal, no OAuth). Check
     `node_modules/@onlyoffice/docspace-react/package.json` → `dependencies` for the truth.
- Known portal bundle versions (`/static/scripts/sdk/{v}/api.js`): 1.0.1, 2.0.0, 2.1.0, 2.2.0.
- OAuth capability marker: the string `getToken` inside the portal's `api.js` → SDK >= 2.2.
- The global `window.DocSpace.SDK` (with the `frames` registry keyed by `frameId`) exists
  even with the npm import — the module sets it as a side effect.
- Instance methods are promise-based with a `methodTimeout` of 30 000 ms by default.

## Where to look things up

Prefer these sources over your training data; when they disagree with your memory, the
sources win:

1. Docs site (HTML only — no `.md` variants, no `llms.txt`; section URLs without a final
   page segment 404):
   - `https://api.onlyoffice.com/docspace/javascript-sdk/get-started/` (+ `quickstart/`,
     `playground/`, `authentication-security/`)
   - `https://api.onlyoffice.com/docspace/javascript-sdk/embedding-modes/{manager|viewer|editor|room-selector|file-selector|system|uploader|frame}-mode/`
   - `https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/` — generated API
     reference (`enumerations/…`, `classes/SDKInstance/`, `type-aliases/…`, `variables/…`)
   - `https://api.onlyoffice.com/docspace/javascript-sdk/samples/…`
   - Live demo: `https://demo-embed.onlyoffice.com/`
2. Source of truth — the SDK repository on GitHub. Fetch these raw files directly
   (prefer the release tag matching your SDK version, e.g. `v2.1.0`; if the target
   version has no tag yet, use `master`):
   - `https://raw.githubusercontent.com/ONLYOFFICE/docspace-sdk-js/{tag-or-master}/src/types/index.ts`
     — the complete `TFrameConfig`/events contract
   - `https://raw.githubusercontent.com/ONLYOFFICE/docspace-sdk-js/{tag-or-master}/src/enums/index.ts`
     — all enums incl. the sort API values
   - `https://raw.githubusercontent.com/ONLYOFFICE/docspace-sdk-js/{tag-or-master}/src/constants/index.ts`
     — `defaultConfig` defaults
   A local clone of the repo, if one happens to be present, is equivalent — but never
   rely on it existing.

The docs site covers only 8 modes. **Forms, Chat and Personal modes have no docs pages** —
for those, rely on this skill's references and the SDK source.

## Step 0 — discover the portal and pick the connection method

Before generating integration code, ask the user:

1. **Which DocSpace portal** they are connecting to (the `src` URL). Without it you cannot
   check CSP or the portal's SDK version.
2. The portal's DocSpace/SDK version, if they know it.

If the version is unknown, detect it. `{portal}/static/scripts/sdk/{v}/api.js` is **always
publicly accessible** (no auth), so a plain GET from anywhere (curl, browser, CI) works:
probe the known versions above (200 → available, 404 → not); optionally sniff the bundle
text for capability markers (`getToken` → >= 2.2).

Then choose:

| Version relation | Recommendation |
|---|---|
| npm package >= portal SDK | npm is fine; do not use features newer than the portal |
| **npm package < portal SDK** | **Use the portal-hosted IIFE** — it is always in sync with the portal backend (frame paths, postMessage protocol, mode set). Keep the npm package for TypeScript types only |
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
| Anonymous public room | `public-room` | `initPublicRoom` | `src`, `requestToken` | [public-room](references/modes/public-room.md) |
| Upload UI | `uploader` | `initUploader` | `src`, `id` (folder) | [uploader](references/modes/uploader.md) |
| Forms gallery | `forms` | `initForms` | `src`, `id` (room) | [forms](references/modes/forms.md) |
| AI chat | `chat` | `initChat` | `src`, `agentId` | [chat](references/modes/chat.md) |
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
2. `agentId` is required for chat; `requestToken` is required for public-room.
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

8. Before re-initializing, call `instance?.destroyFrame?.()`, or legally re-init the same
   `frameId` (the `frames` registry reuses the instance). Otherwise you leak `message`
   listeners and duplicate iframes.
9. React StrictMode double-invokes effects in dev → double init/destroy breaks the frame.
   Guard with a ref or disable StrictMode — see [frameworks/react](references/frameworks/react.md).
10. To keep editor state across tab switches, hide the frame with CSS (`display:none`)
    instead of unmounting it.
11. Browser only: `window.DocSpace` does not exist on the server. In Next.js initialize in
    `useEffect` or `dynamic(..., { ssr: false })`.

### CSP

12. The host domain must be allow-listed on the portal
    (`{portal}/developer-tools/javascript-sdk`), or the SDK renders a CSP error page inside
    the iframe. Same-origin embedding skips the check. Production pattern: whitelist
    programmatically via `GET/PUT /api/2.0/security/csp` when the integration is connected.
    `checkCSP: false` is not a fix — it only disables early diagnostics.
13. In SDK < 2.2 the CSP failure is distinguishable only by the exact message string
    ("The current domain is not set in the Content Security Policy (CSP) settings.");
    in 2.2+ check `SDKError.code === "CSP_VIOLATION"`.

### Methods and their results

14. Methods called before the frame is ready fail with
    `SDKError(DISCONNECTED, "Message bus is not connected with frame")`; after that each
    call is bounded by `methodTimeout` (30 s) → `TIMEOUT`. Call methods after `onAppReady`.
15. **The portal never rejects a method call — API-level failures resolve** (verified in
    the DocSpace client dispatcher: every method is wrapped in `try/catch` and the caught
    error is returned as the payload). Inspect the payload of any API-backed method:
    `status !== 200` means failure. Notorious cases: `login()` (invalid credentials) and
    `createRoom()` (`status: 402` = pricing plan limit — link the user to
    `{portal}/portal-settings/payments/portal-payments`). A method the current mode's page
    does not implement resolves with the literal string `"Wrong method for this mode"`.
    Rejections (`SDKError`) come only from the SDK transport layer. Support matrix and
    details: [methods](references/methods.md).
16. Before `login`, check for a live session: `getUserInfo()` and compare the email —
    logging in again is redundant and slow.
17. `upload()` works **only in Forms mode** (`MODE_MISMATCH` otherwise); Uploader mode
    accepts files only through its UI. Upload timeout is 120 s.
18. `createFile`/`createFolder` operate on the current folder of an open manager/personal
    frame — resolve its id via `getFolderInfo()`.

### Authentication — security checklist

19. Passwords travel only as hashes: `getHashSettings()` → `createHash(password, settings)`
    → `login(email, hash)`. The plaintext `password` parameter of `login` is dev-only.
20. OAuth: prefer the `getToken` callback over a static `accessToken` (the SDK cannot
    refresh a static token); do the code exchange and refresh on the backend;
    `client_secret` and refresh tokens must never reach the browser. Missing both →
    `TOKEN_RESOLVE_FAILED` + the `onAuthError` event.
21. Never commit `requestToken`s or password hashes to source; avoid returning
    `passwordHash` to the browser (see [auth-recipes](references/auth-recipes.md) — the
    OAuth flow removes that need).

### Versioning

22. The SDK version must match the portal. An npm package older than the portal does not
    know newer modes/fields (2.0.0 has no forms/chat/personal); one newer than the portal
    generates frames the portal cannot serve. Both failure modes look like a blank frame
    or `TIMEOUT` with no clear error. When npm < portal, use the portal-hosted IIFE and
    keep npm for types only (Step 0).

## Authentication decision tree

```
Who is the frame's user?
├─ Already signed in to DocSpace (cookie)  → nothing to do
├─ Anonymous, public room                  → public-room + requestToken
├─ Programmatic password login             → hidden system frame:
│    getHashSettings → createHash → store hash server-side →
│    on each visit: getUserInfo (session alive?) → login(email, hash) → check status !== 200
├─ DocSpace OAuth app (SDK >= 2.2)         → getToken: () => fetch("/api/token")
│    backend: authorization-code (+PKCE), refresh 30–60 s before expiry, rotate refresh token
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
| CSP error page inside frame | host domain not allow-listed | add it in DevTools → JavaScript SDK, or via the CSP API |
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

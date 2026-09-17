# Troubleshooting

Symptom first, then the cause and where the fix is described. Every row is a silent failure: the
integration looks right and does nothing.

| Symptom | Cause | Action |
|---|---|---|
| Blank iframe | missing `id` (editor/viewer); empty or invalid `src` | console: `SDK Warning: src is empty…`; [config-reference → Required](config-reference.md#required) |
| Browser refuses to display the frame | no `frame-ancestors` header on that page, or origin not in it | Step 0 probe; portal admin ([discovery → Frame headers](discovery.md#frame-headers--what-they-mean)) |
| CSP error page inside the frame | host origin not allow-listed | Developer Tools → Embed SDK, or `PUT /api/2.0/security/csp` |
| Frame loads, its API calls return 401 while the portal tab is signed in | third-party cookies blocked cross-origin | OAuth `getToken` or same-site hosting ([auth-recipes §6](auth-recipes.md#6-the-cross-origin-cookie-wall)) |
| `login()` returns `status !== 200` for a correct password | 2FA on the account | OAuth; sign in on the portal in another tab; disable 2FA for the integration account ([auth-recipes §7](auth-recipes.md#7-two-factor-authentication)) |
| Chat shows only "Chat history", no composer | guest user, AI disabled, or OAuth token lacks profile scopes | [chat](modes/chat.md) |
| `Message bus is not connected…` | method before `onAppReady` | wait for `onAppReady` ([methods](methods.md)) |
| `SDKError TIMEOUT` | frame not answering; method unsupported by mode or portal version | match SDK and portal (Step 0); [methods → support matrix](methods.md#method-support-by-embedded-page-client-400) |
| Events never fire | `frameId` ≠ container id | make them equal; distinct ids per frame |
| `window is undefined` | SSR | `useEffect` / dynamic import ([nextjs](frameworks/nextjs.md)) |
| Broken or duplicated frame in dev (React) | StrictMode double effects | ref guard ([react](frameworks/react.md)) |
| `login` "succeeds" but no session | `status` not checked | `status !== 200` is failure ([methods → Result semantics](methods.md#result-semantics--read-this-first)) |
| `"Wrong method for this mode"` | method not implemented by that page | switch mode (System or Manager) |
| Script-tag `filter[...]` or lowercase params ignored | legacy syntax not recognized | bare, case-sensitive keys ([config-reference → Script-tag configs](config-reference.md#script-tag-configs)) |
| `MODE_MISMATCH` from `upload()` | mode ≠ forms | [forms](modes/forms.md) |
| `TOKEN_RESOLVE_FAILED` / `onAuthError` | `getToken` threw or missing | check the token endpoint ([auth-recipes §2](auth-recipes.md#2-oauth-sdk--22--recommended)) |
| `createFile` made the wrong format | extension taken from `title` | keep the template's extension ([methods → Content](methods.md#content)) |
| REST 403 on a folder you can see | `rootFolderId` used as destination | use `folderId` — REST is outside this skill |
| `api.js` loaded but `window.DocSpace` empty | two consumers race on the script tag | remove and re-append the tag |
| System frame loads forever | it has no content | `frames[frameId].setIsLoaded()` ([system](modes/system.md)) |
| `import { FilterSortBy }` is `undefined` at runtime | `const enum`, erased at compile time; SDK < 2.2 exports only the default `SDK` | string values or `import type`; named `SDK` only from 2.2 |

`SDKError.code`: `TIMEOUT`, `DISCONNECTED`, `CSP_VIOLATION`, `MODE_MISMATCH`, `INVALID_CONFIG`, `UPLOAD_FAILED`,
`PARSE_ERROR`, `TOKEN_RESOLVE_FAILED` (SDK 2.2; earlier SDKs have no `SDKError` at all).

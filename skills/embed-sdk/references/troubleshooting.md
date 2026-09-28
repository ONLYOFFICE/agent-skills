# Troubleshooting

Symptom first, then the cause and where the fix is described. Every row is a silent failure: the
integration looks right and does nothing.

| Symptom | Cause | Action |
|---|---|---|
| Blank iframe | missing `id` (editor/viewer); empty or invalid `src` | console: `SDK Warning: src is empty…`; [config-reference → Required](config-reference.md#required) |
| Browser refuses to display the frame | no `frame-ancestors` header on that page, or origin not in it | Step 0 probe; portal admin ([discovery → Frame headers](discovery.md#frame-headers--what-they-mean)) |
| CSP error page inside the frame | host origin not allow-listed | Developer Tools → Embed SDK, or `PUT /api/2.0/security/csp` |
| Frame loads, its API calls return 401 while the portal tab is signed in | the portal tab's session does not reach a cross-site frame (third-party cookie blocking; on HTTPS the portal partitions its auth cookie per top-level site) | OAuth `getToken` or same-site hosting ([auth-recipes §6](auth-recipes.md#6-the-cross-origin-cookie-wall)) |
| `login()` returns `status !== 200` for a correct password | 2FA on the account | OAuth; sign in on the portal in another tab; disable 2FA for the integration account ([auth-recipes §7](auth-recipes.md#7-two-factor-authentication)) |
| Chat shows only "Chat history", no composer | the frame's user is a guest or nobody is signed in (`onNoAccess` fires), or the OAuth token lacks profile scopes | [chat](modes/chat.md) |
| `Message bus is not connected…` | method called before the iframe loaded, or on a `waiting` frame | wait for `onAppReady`; release a parked frame with `setConfig({ waiting: false }, true)` ([methods](methods.md)) |
| The `onAppReady` handler runs again and again | it calls `setConfig`, and Manager and System frames fire `onAppReady` after each one | guard it with a flag |
| A method rejects with `API_ERROR` | the portal's API call failed (client 4.0.0 flags it); `err.status` is the HTTP status, `err.data` the portal's error | branch on `err.code` in `catch`; `403` on `createFile`/`createRoom` is a permission or `rootFolderId` problem ([methods → Result semantics](methods.md#result-semantics--read-this-first)) |
| `SDKError TIMEOUT` | frame not answering; method unsupported by mode or portal version | match SDK and portal (Step 0); [methods → support matrix](methods.md#method-support-by-embedded-page-client-400) |
| Events never fire | `frameId` ≠ container id | make them equal; distinct ids per frame |
| `window is undefined` | SSR | `useEffect` / dynamic import ([nextjs](frameworks/nextjs.md)) |
| Broken or duplicated frame in dev (React) | StrictMode double effects | ref guard ([react](frameworks/react.md)) |
| `login` "succeeds" but no session | `status` not checked | `status !== 200` is failure ([methods → Result semantics](methods.md#result-semantics--read-this-first)) |
| `MODE_MISMATCH` ("… is not available in … mode"), or the resolved string `"Wrong method for this mode"` on an older portal | method not implemented by that page | switch mode (System or Manager) |
| Script-tag `filter[...]` or lowercase params ignored | legacy syntax not recognized | bare, case-sensitive keys ([config-reference → Script-tag configs](config-reference.md#script-tag-configs)) |
| `MODE_MISMATCH` from `upload()` | mode is neither forms nor personal | [forms](modes/forms.md), [personal](modes/personal.md) |
| `TOKEN_RESOLVE_FAILED` / `onAuthError` | `getToken` threw or missing | check the token endpoint ([auth-recipes §2](auth-recipes.md#2-oauth-sdk--22--recommended)) |
| `createFile` made the wrong format | extension taken from `title` | keep the template's extension ([methods → Content](methods.md#content)) |
| REST 403 on a folder you can see | `rootFolderId` used as destination | use `folderId` — REST is outside this skill |
| `api.js` loaded but `window.DocSpace` empty | two consumers race on the script tag | remove and re-append the tag |
| System frame loads forever | an older portal whose System page does not report its own load (clients before late 2025) | `frames[frameId].setIsLoaded()` ([system](modes/system.md)) |
| `TS2748: Cannot access ambient const enums` on `import { FilterSortBy }` | the types declare the enums `const`, and the project sets `isolatedModules` or `verbatimModuleSyntax` | string values typed with `TFilterSortBy`, `TTheme`, … |
| `import { FilterSortBy }` or `import { SDK }` is `undefined` at runtime | SDK 2.0/2.1 export only the default; 2.2 exports the enums but still not a named `SDK` | `import SDK from …`; string values for the enums |

`SDKError.code` values are listed in [SDKErrorCode](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/enumerations/SDKErrorCode.md) (SDK 2.2; earlier SDKs have no `SDKError` at all).
A rejected method promise carries the code; `onAppError` receives only the message string.

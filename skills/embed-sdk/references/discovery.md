# Portal discovery (Step 0 in full)

What to establish about a portal before writing integration code, how to establish it
without credentials, and what each answer means. SKILL.md carries the short version.

Contents: What to find out · The probe script · By hand · Frame headers · Which connection ·
Capabilities by portal SDK version · The React wrapper

## What to find out

1. The portal origin (`src`). Nothing can be checked without it.
2. The portal's SDK version — decides the connection method and the modes available.
3. Whether the frame pages can be embedded from the host origin at all (CSP allow-list,
   `X-Frame-Options`).
4. Whether OAuth is available (SDK >= 2.2 on the portal and the identity service enabled).

## The probe script

```
node scripts/probe-portal.mjs https://portal.example.com --origin https://your-host.example
```

It needs Node >= 18 and network access to the portal only; it sends anonymous GET/HEAD
requests and prints a report plus recommendations. `--json` prints the raw findings. Read
the report top to bottom:

- **SDK bundles** — the newest `/static/scripts/sdk/{v}/api.js` that answers 200 is the
  portal's SDK version; `getToken` in that bundle means OAuth mode exists.
- **Frame headers** — per page: status, `X-Frame-Options`, the `frame-ancestors` list and,
  with `--origin`, whether the host origin is in it.
- **OAuth discovery** — `/.well-known/openid-configuration` answering 200 with a
  `token_endpoint` means the identity service is on.
- **CSP allow-list API** — `GET /api/2.0/security/csp` answers anonymously on client 4.0.0
  and lists the allow-listed domains; adding one is `PUT` with an admin session or API key.
- **Recommendations** — the connection method, the modes the portal can serve, and the
  lines to forward to the portal admin verbatim.

## By hand

```
curl -sI {portal}/static/scripts/sdk/2.2.0/api.js          # 200 → SDK 2.2 on the portal
curl -s  {portal}/static/scripts/sdk/2.2.0/api.js | grep -c getToken   # >0 → OAuth mode
curl -sI -H "Accept: text/html" {portal}/old-sdk/system | grep -i -E "x-frame-options|content-security-policy"
curl -sI -H "Accept: text/html" {portal}/sdk/room-selector | grep -i -E "x-frame-options|content-security-policy"
curl -s  {portal}/.well-known/openid-configuration | head -c 300
```

Known bundle versions: 1.0.1, 2.0.0, 2.1.0, 2.2.0. The bundle URL is public — no auth,
no CSP check — so it works from CI as well as from a browser.

## Frame headers — what they mean

Verified on a live client 4.0.0 portal:

- The portal's nginx sends `X-Frame-Options: SAMEORIGIN` on `/old-sdk/system` (the page behind
  `initSystem` and the hash-login flow). The `/sdk/*` pages (selectors, public room, uploader,
  forms, chat, personal) do not carry it.
- Every HTML response also gets `Content-Security-Policy: frame-ancestors …` built from the
  portal's CSP allow-list (Developer Tools → Embed SDK). The `Accept` header must contain
  `html` for that middleware to run, hence `-H "Accept: text/html"` above.
- Browsers let `frame-ancestors` override `X-Frame-Options`. So the system frame embeds from
  another origin **only while the CSP header is present and lists that origin**.
- `X-Frame-Options` **without** a `frame-ancestors` header means the allow-list is not
  reaching the response (empty list, CSP cache, a proxy stripping headers). The browser then
  refuses the frame with a "refused to connect / display" message in its console and **no
  SDK event fires**. That is a portal-side fix; report the probe line to the admin.
- Your origin missing from `frame-ancestors` → the SDK shows its CSP error page inside the
  frame (`SDKError.code === "CSP_VIOLATION"` on 2.2+). Fix: add the origin to the allow-list.
  `checkCSP: false` only silences the early check.

Neither header has anything to do with the `401` that a cross-origin frame returns when
the browser withholds the portal cookie — that is the token table in SKILL.md and
[auth-recipes §6](auth-recipes.md#6-the-cross-origin-cookie-wall).

## Which connection

| Situation | Use |
|---|---|
| Portal on SDK 2.2 (ONLYOFFICE Apps 4.0), project has a bundler | `npm i @onlyoffice/docspace-sdk-js@^2.2.0`, `import SDK from "@onlyoffice/docspace-sdk-js"` |
| Portal older than the npm package | the portal script `<script src="{portal}/static/scripts/sdk/{v}/api.js">` — always in sync with the portal's frame paths, postMessage protocol and mode set; keep npm as a devDependency for types only |
| No build step (plain HTML, CMS page) | the portal script; config may go on the script URL as query params, `init=true` auto-initializes (see [config-reference](config-reference.md#script-tag-configs)) |
| Portal version undetectable | the portal script, newest known version that answers 200 |

An npm package **older** than the portal lacks newer modes and fields (2.0.0 has no forms,
chat, personal, OAuth); one **newer** than the portal produces frames the portal cannot
serve. Both look like a blank frame or `TIMEOUT` with no clear error.

## Capabilities by portal SDK version

| Portal SDK | Modes | Auth | Notes |
|---|---|---|---|
| 1.x | manager, editor, viewer, room-selector, file-selector, system | cookie session, hash login | no `SDKError`, no `methodTimeout` — add your own timeouts |
| 2.0 | + public-room, uploader | + `requestToken` | `executeInEditor`, `onEditorOpen` appear |
| 2.1 | + forms, personal | | `onFileManagerClick` appears |
| 2.2 | + chat | + OAuth `getToken` / `accessToken` | `SDKError` codes, `methodTimeout`, `onContentReady`, `onNoAccess`, `onNotFound`, external-data bridge |

## The React wrapper

`@onlyoffice/docspace-react` bundles **its own copy** of the SDK and that copy has lagged
behind the wrapper's version (2.1.0 shipped SDK 2.0.0: no forms/chat/personal, no OAuth).
Before using it, read `node_modules/@onlyoffice/docspace-react/package.json` →
`dependencies["@onlyoffice/docspace-sdk-js"]` and the bundled `dist` if the range is loose,
then match that against the portal. Use the wrapper for the credential-replay flow only;
for OAuth, fine-grained lifecycle or modes the bundled SDK predates, use the SDK directly
([frameworks/react](frameworks/react.md)).

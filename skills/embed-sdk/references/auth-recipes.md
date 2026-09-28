# Authentication recipes

Four production-proven flows plus the two walls integrators hit around them. Pick via the
decision tree in SKILL.md and the token table below.

Contents: which token is which · 1 credential replay · 2 OAuth · 3 public rooms · 4 portal-provider
auto-login · 5 API keys · 6 the cross-origin cookie wall · 7 two-factor authentication · 8 multi-frame pages

## Which token is which

| Thing | Lives | Grants | SDK entry | Cannot |
|---|---|---|---|---|
| Password hash (`createHash`) | your backend, encrypted | a portal session via `login(email, hash)` in a System frame | `login()`, resolving `TLoginResult`; a second `login(…, code)` for 2FA on client 4.0.0 (§7) | finish 2FA on a portal whose System page predates 2026-09-28; cross-site, the session it creates follows §6 |
| Session cookie `asc_auth_key` | browser, portal origin | every request the iframe makes | nothing to pass | reach a cross-site frame from a portal tab (third-party cookie blocking, partitioned cookies) → `401` despite a live session |
| `requestToken` (share key) | room share link, or `items[0].requestTokens[0].requestToken` from a room-selector | anonymous access to one room and its files | `public-room` (`id` + `requestToken`); manager with `rootPath: "/rooms/share"`; editor/viewer (`share=` on `/doceditor`) | anything outside that room; must never be committed |
| OAuth access token | your backend (refresh token stays there) | API calls as the user, sent as `Bearer` — no cookie involved | `getToken` (preferred) or `accessToken`, SDK >= 2.2 | outlive expiry unless `getToken` re-fetches |
| API key | your backend | REST as the key owner, `Bearer`, scopes = key permissions | REST; in a frame the SDK forwards whatever `getToken` returns — plausible but **unverified**, confirm with `getUserInfo()` | be refreshed or revoked per session |

`login()` resolves `{ url: "/" }` on success, `{ url: "/confirm/…" }` when a second factor is pending, and
`{ status, message }` on failure — it never rejects on a portal failure (with `createRoom` the only method that
keeps that contract on client 4.0.0; the rest reject with `API_ERROR`, [methods](methods.md#result-semantics--read-this-first)).

## 1. Credential-replay (password hash) — the classic plugin flow

Used when the host app manages its own users and links each to an ONLYOFFICE Apps account.

**One-time linking** (user enters ONLYOFFICE Apps email + password in *your* form):

```js
// hidden system frame does the crypto — password never leaves the page unhashed
const frameId = "system-frame";
sdk.initSystem({
  frameId, src: portalUrl,
  events: {
    onAppReady: async () => {
      const frame = window.DocSpace.SDK.frames[frameId];
      const settings = await frame.getHashSettings();
      const hash = await frame.createHash(password.trim(), settings);
      const res = await frame.login(email, hash);
      if (res.status && res.status !== 200) { frame.destroyFrame(); onFail(); return; }
      const user = await frame.getUserInfo();
      await saveAccountLink(user.id, email, hash);   // store hash SERVER-side, encrypted
    },
    onAppError: onFail,
  },
});
```

**Every visit** (silent re-login before mounting the real frame):

```js
onAppReady: async () => {
  const frame = window.DocSpace.SDK.frames[frameId];
  const info = await frame.getUserInfo();            // session may still be alive
  if (info && info.email === email) { onSuccess(); return; }
  const res = await frame.login(email, storedHash);
  if (res.status && res.status !== 200) { frame.destroyFrame(); onFail(); return; }
  onSuccess();
}
```

Notes:
- `login()` resolves on failure — always check `status`. The docs' Login and Authorization samples skip
  both that check and the `getUserInfo()` probe; keep them.
- The portal's handler reads only `email` and `passwordHash` (client 4.0.0). The `password` and
  `session` arguments are transmitted and ignored; the session is always persistent.
- Accounts with **2FA enabled** need a second `login(email, hash, undefined, undefined, code)` after the
  `/confirm/…` answer, and a portal whose System page reads `code` — see §7 before promising this flow.
- The resulting session is a cookie on the portal origin, set inside a frame on your page. Same-site it
  is first-party; cross-site it depends on §6 — on an HTTPS portal with an allow-list the cookie is
  partitioned to your site rather than dropped. Confirm with `getUserInfo()` in the next frame instead
  of assuming either way.
- Add your own overall timeout around the flow if you must support SDK < 2.2
  (no `methodTimeout` there).
- Weakness of this flow: the hash must round-trip to the browser on every visit. Encrypt
  it at rest; better, migrate to OAuth (recipe 2) which removes stored credentials
  entirely.
- Server-side hash generation (bulk user provisioning, no iframe available): PBKDF2-SHA256
  with the portal's `/api/2.0/settings` → `passwordHash` params
  (`salt`, `iterations`, `size/8` bytes) — e.g. PHP `hash_pbkdf2`, Node `crypto.pbkdf2`.

## 2. OAuth (SDK >= 2.2) — recommended

The browser only ever sees short-lived access tokens, and the frame sends them as `Bearer`
instead of relying on the portal cookie — which is why this is also the fix for §6.

**Frontend:**

```js
const getToken = async () => {
  const r = await fetch("/api/docspace/token");      // your backend
  if (!r.ok) throw new Error("token_unavailable");
  return (await r.json()).access_token;
};
sdk.initManager({ frameId, src: portalUrl, getToken,
  events: { onAuthError: (e) => showReloginUI(e) } });
```

How it reaches the frame: the SDK opens the frame with `?auth=oauth`; the embedded page asks
the host for a token over postMessage whenever it needs one, and the SDK answers with the
result of `getToken()` (single-flight — concurrent requests share one call). The page then
sends `Authorization: Bearer <token>` on its API requests. The SDK does not parse the token;
`tokenExpiresAt` is optional metadata.

**Backend** (confidential client):
- `GET {portal}/oauth2/authorize?response_type=code&client_id&redirect_uri&scope&state`
  (random `state`, 10-min TTL, verify on callback — CSRF). PKCE (S256) where supported.
- Exchange the code at `POST {portal}/oauth2/token` (`client_secret_post` or PKCE).
- Cache `{ accessToken, refreshToken, expiresAt }` per user session; serve the access
  token from your `/api/docspace/token` endpoint.
- Refresh proactively 30–60 s before expiry. **Rotation is strict**: the refresh token you
  used is invalidated the moment the new pair is issued. The token endpoint therefore does
  three things in this order and nothing else: refresh, persist the new pair, answer.

  ```js
  app.get("/api/docspace/token", async (req, res) => {
    let pair = await store.get(req.session.userId);
    if (!pair) return res.status(401).json({ error: "not_linked" });
    if (pair.expiresAt - Date.now() < 60_000) {
      const fresh = await exchange({ grant_type: "refresh_token", refresh_token: pair.refreshToken });
      pair = { accessToken: fresh.access_token, refreshToken: fresh.refresh_token, expiresAt: Date.now() + fresh.expires_in * 1000 };
      await store.set(req.session.userId, pair);
    }
    res.json({ access_token: pair.accessToken });
  });
  ```

  Never retry a refresh with the previous token, serialise concurrent refreshes per user (two
  frames asking at once must share one exchange), and never write a health check that refreshes
  and discards the result — it kills the real session.
- Revoke both tokens at `POST {portal}/oauth2/token/revoke`-equivalent on logout;
  never expose `client_secret` or refresh tokens to the browser.
- Scopes: read the catalogue from `GET {portal}/api/2.0/scopes` (authenticated; anonymous → 403)
  when the app is registered and put the chosen list in configuration, not in code; discovery is
  `GET {portal}/.well-known/openid-configuration`. Scopes differ between portal versions — a list
  typed from memory is the second most common OAuth defect after the refresh handling. The chat and personal pages need the
  scopes that read the user's profile; without them the frame renders as "no access".

There is **no automatic re-auth**: on `onAuthError` show your own re-login UX.

## 3. Public rooms — `id` + `requestToken`

No user account at all: anonymous access to a shared room.

```js
sdk.initPublicRoom({ frameId, src: portalUrl, id: roomId, requestToken });
```

Both fields are required: `id` becomes `?folder=` and is fetched server-side by the portal
page (omit it → white "Something went wrong" frame). The token comes from the room's external
share link — or directly from a room-selector payload: `items[0].id` +
`items[0].requestTokens[0].requestToken`. Never commit tokens to source control. A manager
view over the same room is `mode: "manager"` + `requestToken` + `rootPath: "/rooms/share"`;
the validator accepts that combination.

## 4. Portal-provider auto-login (forms / chat / personal)

When the host platform is itself an OAuth provider registered on the portal
(e.g. Nextcloud): pass `providerName` plus optional `inviteKey`/`emplType`/`uid`, and the
frame signs the user in (or up) automatically. No hashes, no tokens in the host code.

## 5. API keys

An ONLYOFFICE Apps **API key** (Developer Tools → API keys) is a `Bearer` credential for the
REST API: the portal validates it as the key owner with the key's permissions as scopes
(`ApiKeyBearerAuthHandler`, client 4.0.0). Validate it via `GET /api/2.0/keys/@self`; on
401/403 mark it invalid and surface reconnect UX. This is the right credential for
server-to-server work (creating rooms, listing files from your backend).

Inside a **frame**: `getToken` may return any string and the SDK forwards it as `Bearer`,
and the portal registers the API-key Bearer scheme next to the JWT one, so a personal API key
in `getToken` is expected to authenticate the frame as the key owner. This is **not
verified** on the embedded pages: if you use it, confirm with `getUserInfo()` after
`onAppReady` on the target portal, and remember that the key then lives in the browser with
no expiry and no per-session revocation. Prefer a real OAuth app for anything user-facing.

## 6. The cross-origin cookie wall

The frame authenticates with the portal's session cookie (`asc_auth_key`). When the host page
is on a different site than the portal, that cookie is a **third-party cookie** inside the
iframe. Safari blocks unpartitioned third-party cookies by default; Chrome does when third-party
cookies are disabled. `document.hasStorageAccess()` returning `true` does not mean the cookie was sent.

How the portal sets that cookie (server `CookiesManager`, release/v4.0.0): on HTTPS it is
`SameSite=None; Secure; Partitioned` whenever the Embed SDK allow-list is not empty and the server
setting `web:samesite` is unset; otherwise it is `SameSite=Strict`, so an HTTP portal never has a
cross-site session. A partitioned cookie (CHIPS) is kept per top-level site, which is expected to mean
— not yet checked in each browser on a live portal:

- a session from a portal tab lives in the portal's own partition and never reaches a frame on your
  site — the 401 below;
- a session created **inside** a frame on your site (the user signs in there, or recipe 1) lands in
  your site's partition and is sent by the other frames on that site.

`SameSite` entries in `appsettings.json` do not change this: the server reads only `web:samesite`, and
the `CookieSettings` block the docs suggest is not read for it at all.

Symptom: the frame loads, `onAppReady` fires, then API calls from inside the frame return
`401` while the same user is signed in to the portal in another tab. Nothing about CSP,
`checkCSP` or the allow-list changes this.

Fixes, in order of preference:

1. OAuth `getToken` (recipe 2) — the frame sends `Bearer`, cookies are irrelevant.
2. Same-site hosting — put the host page on the portal's site (a subdomain of the same
   registrable domain), so the cookie is first-party.
3. `public-room` + `requestToken` for anonymous content — no session needed.

The credential-replay flow (recipe 1) creates its cookie inside a frame on your site, so it is subject to
the partition rule above rather than to the portal tab's session — verify it on the target portal before
promising it cross-site.

## 7. Two-factor authentication

How the portal does it: `POST /api/2.0/authentication` with the credentials answers
`{ tfa: true, confirmUrl }` (or `{ sms: true, phoneNoise }`) and creates no session; the code
then goes to `POST /api/2.0/authentication/{code}` with the same credentials. The frame does not
expose that DTO: the SDK dispatcher calls the client's sign-in store, which turns the answer into
`{ url: "/confirm/TfaAuth…", user, hash }` — a `url` under `/confirm/` in `TLoginResult` is how
you learn that a second factor is pending (client 4.0.0).

Whether the second step is reachable depends on the portal's build:

- **Client 4.0.0** (System page from 2026-09-28, Manager page from 2026-09-10): the dispatcher reads `code`
  and calls `loginWithCode`. After the `/confirm/…` answer, ask the user for the code and call
  `login(email, hash, undefined, undefined, code)` (SDK 2.2.0); the answer is `{ url: "/" }` on success or
  `{ status, message }` (401 for a wrong code). The code is single-use and bound to the same `email` + `hash`.
- **An older System page** (4.0.0 builds before 2026-09-28, every 3.x): it forwards `email` and `passwordHash`
  alone, so the code never reaches the portal and the second call re-issues the same `/confirm/…` challenge.
  Detect it at runtime — a second `login(…, code)` that answers `/confirm/…` again — and fall back to the
  options below; do not present the code field as working there.

The docs' "Two-factor authentication" advanced sample is a host-side mock — a code from
`Math.random()` shown in `alert()` before `initManager` — not the portal's second factor.

Options for hosts whose users have 2FA on a portal that ignores `code`:

- OAuth (recipe 2): the portal's own login page handles the second factor during the
  authorization-code redirect.
- Session reuse: send the user to the portal in a new tab to sign in (with 2FA), then rely
  on the cookie session — only where §6 does not apply.
- Disable 2FA on a dedicated integration account (admin decision, document it).

Say plainly in the deliverable which portal builds the code step works on, and what happens on the others.

## 8. Multi-frame pages

Only one frame should perform authentication. Init the first frame normally; park the
rest with `waiting: true` (no iframe is added, only the loader where the mode has one), and once
login completes, re-init all parked frames with their real configs or release each with
`setConfig({ waiting: false }, true)` — a plain `setConfig` on a parked frame rejects with `DISCONNECTED`. Frames whose mode
carries its own token (`public-room` + `requestToken`) can be initialized immediately,
before authentication finishes.

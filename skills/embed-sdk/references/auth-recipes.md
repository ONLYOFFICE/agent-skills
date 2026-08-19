# Authentication recipes

Four production-proven flows. Pick via the decision tree in SKILL.md.

## 1. Credential-replay (password hash) — the classic plugin flow

Used when the host app manages its own users and links each to a DocSpace account.

**One-time linking** (user enters DocSpace email + password in *your* form):

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
- `login()` resolves on failure — always check `status`.
- Add your own overall timeout around the flow if you must support SDK < 2.2
  (no `methodTimeout` there).
- Weakness of this flow: the hash must round-trip to the browser on every visit. Encrypt
  it at rest; better, migrate to OAuth (recipe 2) which removes stored credentials
  entirely.
- Server-side hash generation (bulk user provisioning, no iframe available): PBKDF2-SHA256
  with the portal's `/api/2.0/settings` → `passwordHash` params
  (`salt`, `iterations`, `size/8` bytes) — e.g. PHP `hash_pbkdf2`, Node `crypto.pbkdf2`.

## 2. OAuth (SDK >= 2.2) — recommended

The browser only ever sees short-lived access tokens.

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

**Backend** (confidential client):
- `GET {portal}/oauth2/authorize?response_type=code&client_id&redirect_uri&scope&state`
  (random `state`, 10-min TTL, verify on callback — CSRF). PKCE (S256) where supported.
- Exchange the code at `POST {portal}/oauth2/token` (`client_secret_post` or PKCE).
- Cache `{ accessToken, refreshToken, expiresAt }` per user session; serve the access
  token from your `/api/docspace/token` endpoint.
- Refresh proactively 30–60 s before expiry; refresh tokens rotate — if the response
  omits a new one, keep the previous.
- Revoke both tokens at `POST {portal}/oauth2/token/revoke`-equivalent on logout;
  never expose `client_secret` or refresh tokens to the browser.
- Fetch available scopes from `GET {portal}/api/2.0/oauth2/scopes` — they differ between
  portal versions; do not hardcode.

There is **no automatic re-auth**: on `onAuthError` show your own re-login UX.

Alternative for server-to-server calls (not the frame): a DocSpace **API key** as Bearer —
validate it via `GET /api/2.0/keys/@self` and required scopes; on 401/403 mark it invalid
and surface reconnect UX.

## 3. Public rooms — `requestToken`

No user account at all: anonymous access to a shared room.

```js
sdk.initPublicRoom({ frameId, src: portalUrl, requestToken });
```

The token comes from the room's external share link — or directly from a room-selector
payload: `items[0].requestTokens[0].requestToken`. Never commit tokens to source control.

## 4. Portal-provider auto-login (forms / chat / personal)

When the host platform is itself an OAuth provider registered on the portal
(e.g. Nextcloud): pass `providerName` plus optional `inviteKey`/`emplType`/`uid`, and the
frame signs the user in (or up) automatically. No hashes, no tokens in the host code.

## Multi-frame pages

Only one frame should perform authentication. Init the first frame normally; park the
rest with `waiting: true` (they render the loader without loading content), and once
login completes, re-init all parked frames with their real configs. Frames whose mode
carries its own token (`public-room` + `requestToken`) can be initialized immediately,
before authentication finishes.

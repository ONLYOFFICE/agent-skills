# System mode (headless)

Renders a blank page (`{src}/old-sdk/system`) — no UI. It gives the host a postMessage channel for the methods that
need no interface: the hash-login chain (`getHashSettings` → `createHash` → `login`), `logout`, `getUserInfo`. The
init call, the method table and the use cases (SSO bridge, account switch, session check) are on the guide page
`embedding-modes/system-mode.md`; the full flows are in [auth-recipes](../auth-recipes.md). What the page does not say:

- Wrap the container in a `hidden` parent (`<div hidden><div id="system-frame"></div></div>`) — the frame itself must
  exist in the DOM. `waiting: true` is ignored here: System always renders.
- The loader is **forced on**. The page reports its own load on client 4.0.0; on an older portal the frame may stay
  "loading" until you call `frames[frameId].setIsLoaded()`.
- `login` takes **five** arguments — `(email, passwordHash, password?, session?, code?)`; the guide's table lists
  four. `password` and `session` never reach the portal; `code` finishes a two-factor sign-in after a `/confirm/…`
  answer (client 4.0.0). The result **resolves, never rejects**: `status && status !== 200` is failure
  ([methods](../methods.md#auth), [auth-recipes §7](../auth-recipes.md#7-two-factor-authentication)).
- `logout()` is awaited by this page — the promise resolves once the session is gone (the Manager page answers
  earlier), so sign-out sequences belong here.
- `theme` is read once, from the frame URL at load; `setConfig({ theme })` without `reload` does nothing on this page,
  whatever the guide's method table says. `locale` is applied live.
- File and room methods called on a System frame reject with `MODE_MISMATCH` on client 4.0.0 (an older portal resolves
  the string `"Wrong method for this mode"`); use a Manager frame for data.
- Production pattern: run login through a System frame on the *same* container `frameId` you will use next, then
  re-init it in the real mode — the registry reuses the instance. Sign-out does the reverse: destroy → initSystem →
  logout → destroy.

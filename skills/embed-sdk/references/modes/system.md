# System mode (headless)

Renders a blank page (`{src}/old-sdk/system`) — no UI. Its purpose is to give the host a
postMessage channel for methods that need no interface: the hash-login chain
(`getHashSettings` → `createHash` → `login`), `logout`, `getUserInfo`.

```html
<div hidden><div id="system-frame"></div></div>
```

```js
sdk.initSystem({
  frameId: "system-frame",
  src: portalUrl,
  events: {
    onAppReady: async () => {
      const frame = window.DocSpace.SDK.frames["system-frame"];
      const settings = await frame.getHashSettings();
      const hash = await frame.createHash(password, settings);
      const res = await frame.login(email, hash);
      if (res.status && res.status !== 200) { /* failed */ }
    },
    onAppError: (msg) => {},
  },
});
```

Key points:

- Wrap the container in a `hidden` parent — the frame itself must exist in the DOM.
- The loader is **forced on**. The page reports its own load on clients from late 2025 on;
  on an older portal the frame stays "loading" until you call `frames[frameId].setIsLoaded()`.
- `waiting: true` is ignored here — System always renders.
- Full auth flows built on this mode (linking, silent re-login, sign-out handling,
  multi-frame pages): [auth-recipes.md](../auth-recipes.md).
- A common production pattern: run login through a System frame on the *same* container
  `frameId` you will use next, then re-init it in the real mode — the registry reuses the
  instance. Sign-out does the reverse: destroy → initSystem → logout → destroy.

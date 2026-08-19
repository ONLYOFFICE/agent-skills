# Public room mode

Anonymous access to a shared room: view, edit, comment, review — no portal account.
**`requestToken` is required.**

```js
sdk.initPublicRoom({
  frameId: "ds-frame",
  src: portalUrl,
  requestToken,                 // from the room's external share link
  showFilter: true,
  events: { onAppReady: () => {}, onAppError: (m) => {} },
});
```

Key points:

- Where the token comes from:
  - the room's external sharing link on the portal, or
  - programmatically — a room-selector payload: `items[0].requestTokens[0].requestToken`
    (see [selectors.md](selectors.md)).
- The iframe path is `/sdk/public-room`; embeds that combine a manager view over a public
  room use `mode: "manager"` + `requestToken` + `rootPath: "/rooms/share"` instead.
- No authentication of any kind is needed — public-room frames on multi-frame pages can
  be initialized immediately, before any login completes (unlike other frames, which may
  need parking with `waiting: true` — see [auth-recipes.md](../auth-recipes.md)).
- Anonymous users in the editor: control the name prompt with
  `editorCustomization.anonymous = { request: false }`.
- Never commit a `requestToken` to source control — it grants room access to anyone
  holding it.

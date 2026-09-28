# Public room mode

Anonymous access to a shared room: view, edit, comment, review — no portal account.
**Both `id` (the room id) and `requestToken` are required.**

```js
sdk.initPublicRoom({
  frameId: "ds-frame",
  src: portalUrl,
  id: roomId,                   // the shared room's id — NOT optional
  requestToken,                 // from the room's external share link
  showFilter: true,
  events: {
    onAppReady: () => {},
    onNotFound: () => {},         // invalid link (wrong or revoked key)
    onNoAccess: () => {},         // expired link
    onAppError: (m) => {},
  },
});
```

The page fires `onAppReady` once when it mounts (client 4.0.0). `onContentReady` comes from the SDK itself on the
iframe's `load` event, because `noLoader` defaults to `true` in this mode; the order of the two is not guaranteed.

Key points:

- **`id` is mandatory.** The SDK builds `/sdk/public-room?folder={id}&key={requestToken}`
  and the portal page calls `getFolder(folder)` during server-side rendering. Without `id`
  that call fails and the page renders its invalid-link error (client 4.0.0) — no
  `onAppError`, no console hint pointing at the config. Run `validate-config.mjs`: it
  rejects a public-room config without `id`. A wrong or revoked `requestToken` takes a
  different path: the portal redirects to its error page, which fires `onNotFound` (invalid
  link) or `onNoAccess` (expired link) — the only two portal events this mode sends.
- Where `id` and the token come from (always as a pair — the token is bound to the room):
  - the room's external sharing link on the portal (the room id is in the portal URL of
    that room), or
  - programmatically — a room-selector payload: `items[0].id` +
    `items[0].requestTokens[0].requestToken` (see [selectors.md](selectors.md)).
- The iframe path is `/sdk/public-room`; embeds that combine a manager view over a public
  room use `mode: "manager"` + `requestToken` + `rootPath: "/rooms/share"` instead. The
  validator knows this pair: it stays silent on `requestToken` when `rootPath` is
  `/rooms/share`, and reports an error if that `rootPath` comes without the token.
- No authentication of any kind is needed — public-room frames on multi-frame pages can
  be initialized immediately, before any login completes (unlike other frames, which may
  need parking with `waiting: true` — see [auth-recipes.md](../auth-recipes.md)).
- Opening one of the room's files: `initViewer` / `initEditor` with `id: file.id` and the **same**
  `requestToken` — the SDK sends it as `share=` on `/doceditor`, so the frame needs no session.
  The `/sdk/public-room` page answers `setConfig` only and fires no click events; a listing that
  must react to clicks is `mode: "manager"` + `rootPath: "/rooms/share"` + `requestToken` with
  `onFileManagerClick` / `onEditorOpen` ([manager](manager.md)).
- Anonymous users in the editor: control the name prompt with
  `editorCustomization.anonymous = { request: false }`.
- Never commit a `requestToken` to source control — it grants room access to anyone
  holding it.

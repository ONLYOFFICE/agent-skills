# Chat mode (AI chat)

Full-page AI conversation UI. **Requires SDK >= 2.2 on both the package and the portal.**
No docs-site page exists — this file and the SDK source are the reference. Only `src` is
required: without `agentId` the chat is bound to the current user; with `agentId` it is
bound to that AI agent room.

```js
sdk.initChat({
  frameId: "ds-frame",
  src: portalUrl,
  agentId,                        // optional: AI agent room id (omit -> user chat)
  entityId,                       // optional: room/folder the chat is opened from
  fileId,                         // optional: attach a file to the composer on init
  threadId,                       // optional: resume a conversation (was `chatId` pre-release)
  theme: "System",
  headerHeight: 56,               // optional: top inset (px) for host chrome
  headerOffset: 48,               // optional: inline-start inset (px) for host overlays
  events: { onAppReady: () => {}, onAppError: (m) => {} },
});
```

Key points:

- The iframe path is `/sdk/chat`.
- `agentId` — set: chat scoped to that agent; omitted: personal chat of the signed-in user.
- `entityId` — the room/folder the chat is opened from. The AI receives it as workspace
  context and scopes tool calls to it; the caller must have access to it (404 otherwise).
  If both `agentId` and `entityId` are passed, `agentId` wins. Default: `undefined`.
- `threadId` — resume an existing thread (loads its history). The field was named `chatId`
  in unreleased 2.2 builds; 2.2.0 ships `threadId`.
- `fileId` — attaches the file to the composer so the first message goes with it.
- Anonymous visitors see a "no access" screen; sign the user in first (see auth below).
- Events: `onAppReady`, `onContentReady` (fired after the chat mounts), `onAppError`
  (SDK load errors, plus a failed `fileId` attach / `threadId` resume reported by the
  page). There are no chat-specific instance methods.
- Before generating chat integrations, confirm the portal serves SDK 2.2+:
  `GET {portal}/static/scripts/sdk/2.2.0/api.js` → 200 (see SKILL.md Step 0). An older
  portal cannot serve this mode at all — the failure looks like a blank frame.
- Authentication: a signed-in session, OAuth `getToken`, or portal-provider auto-login
  (`providerName`/`inviteKey`/`uid`) — see [auth-recipes.md](../auth-recipes.md).
- `headerOffset`/`headerHeight` are **container insets** here, not header-row tweaks as in
  Forms: `headerOffset` becomes `padding-inline-start` and `headerHeight` becomes
  `padding-block-start` of the chat container (both only when > 0).

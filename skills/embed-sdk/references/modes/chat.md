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

## Preconditions — the page renders an empty chat when any of them fails

Verified against the portal's `/sdk/chat` page (client 4.0.0): the composer, toolbar and agent
context are rendered only when `canUseAi` is true, which requires **a signed-in user who is not
a guest/visitor**. Otherwise the page still fires `onAppReady`, calls `setIsLoaded()` and shows
the "no access" state — visually a blank chat with only a "Chat history" control and no input.
Nothing arrives on `onAppError` or `onNoAccess` in that case.

Before generating a chat integration, make sure that:

1. The frame's user is a full portal user (not a guest, not anonymous). Public-room tokens do
   not open chat.
2. AI is enabled on the portal (admin settings → AI); on a portal without a configured AI
   provider the same empty state appears for everyone.
3. Under OAuth (`getToken`), the token's scopes let the page load the user's profile and
   settings — the OAuth branch fetches them with the token and silently falls back to
   `canUseAi = false` when that request fails. Check the scope list of your OAuth app
   against `GET {portal}/api/2.0/scopes`.
4. `agentId`, if set, is a numeric agent room id the user can open; `entityId` likewise.

Troubleshooting order for "empty chat": sign in as a full user on the portal itself and open
the agent there → if that works, compare the frame's user (`getUserInfo()` from a Manager or
System frame with the same credentials) and the OAuth scopes.

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

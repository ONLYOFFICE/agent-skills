# Chat mode (AI agent)

Full-page conversation UI for a DocSpace AI agent. **Requires SDK >= 2.2 on both the
package and the portal.** No docs-site page exists — this file and the SDK source are the
reference. **`agentId` is required.**

```js
sdk.initChat({
  frameId: "ds-frame",
  src: portalUrl,
  agentId,                        // AI agent room id — required
  fileId,                         // optional: attach a file on init
  chatId,                         // optional: resume a conversation
  theme: "System",
  headerHeight: 56,               // optional: match host chrome
  headerOffset: 48,               // optional: clearance for host overlays
  events: { onAppReady: () => {}, onAppError: (m) => {} },
});
```

Key points:

- The iframe path is `/sdk/chat`.
- Before generating chat integrations, confirm the portal serves SDK 2.2+:
  `GET {portal}/static/scripts/sdk/2.2.0/api.js` → 200 (see SKILL.md Step 0). An older
  portal cannot serve this mode at all — the failure looks like a blank frame.
- Authentication: a signed-in session, OAuth `getToken`, or portal-provider auto-login
  (`providerName`/`inviteKey`/`uid`) — see [auth-recipes.md](../auth-recipes.md).
- `headerOffset`/`headerHeight` behave as in Forms mode.

# Forms mode

Forms gallery for the form filling room given by `id` (omitted → the room configured in the portal's Forms
settings, client 4.0.0). The docs site has no Forms guide: [SDK](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/classes/SDK.md)
documents `initForms`, [TFormsSection](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/type-aliases/TFormsSection.md) the sections and
[TCustomActionsConfig](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/type-aliases/TCustomActionsConfig.md) the custom actions; this file adds what
they do not say. Requires a portal on SDK >= 2.2.

```js
const instance = sdk.initForms({
  frameId: "ds-frame",
  src: portalUrl,
  id: roomId,
  destination: "my-forms",        // initial section
  showMenu: true,
  headerOffset: 48,               // px clearance for a host overlay on the left edge
  events: {
    onNavigate: ({ section }) => {},
    onCustomAction: ({ action, type, item }) => {},
    onUploadSuccess: ({ fileName }) => {},
    onUploadError: ({ fileName, message }) => {},
  },
});
```

Sections (`TFormsSection`): `my-forms`, `in-progress`, `completed-forms`, `library`,
`settings`. Set the initial one with `destination` (avoids an extra call); switch at
runtime with `await instance.navigateSection("completed-forms")`; track user navigation
via `onNavigate`.

## Programmatic upload

`await instance.upload(file)` (a browser `File`) works here and in Personal; every other mode rejects with
`SDKError(MODE_MISMATCH)`. It resolves the `onUploadSuccess` payload (`{ fileName, fileSize }`), rejects with
`UPLOAD_FAILED` on `onUploadError` or after its own 120 s timeout, and emits no `onUploadProgress`.

## Custom context-menu actions

```js
await instance.setCustomActions({
  contextMenu: {
    file: [{ key: "send-to-crm", label: "Send to CRM",
             icon: "https://host/icon.svg", section: ["completed-forms"] }],
    folder: [],
  },
});
// clicks arrive as events:
// onCustomAction: ({ action: "send-to-crm", type, item }) => {...}
```

`section` limits visibility to specific sections; omit to show everywhere.

## Other options

- `libraryId` — show only items from a forms library.
- `headerOffset` (px) shifts header-row controls inline-start (RTL-aware) so host overlays
  don't cover them; `headerHeight` overrides the built-in header height to match host
  chrome. Both also apply to chat and personal modes.
- Auto sign-in via the host portal's OAuth provider: `providerName` +
  `inviteKey`/`emplType`/`uid` — see [auth-recipes.md](../auth-recipes.md#4-portal-provider-auto-login-forms--chat--personal).

# Editor and Viewer modes

Both render `{src}/doceditor` for the file `id`; viewer adds `action=view` (read-only).
**`id` is required** — without it the frame opens empty with no error.

```js
const instance = sdk.initEditor({
  frameId: `editor-${fileId}`,          // unique per document
  src: "https://portal.example.com",
  id: fileId,
  editorType: "embedded",               // desktop | embedded | mobile
  editorGoBack: false,                  // or "event" → onEditorCloseCallback
  editorCustomization: {
    anonymous: { request: false },      // don't prompt anonymous users for a name
    integrationMode: "embed",           // prevent auto-scroll to the frame
  },
  events: {
    onAppReady: () => {},
    onEditorCloseCallback: () => closeMyModal(),
    onDownload: (url) => {},            // requires downloadToEvent: true
  },
});
```

Key points:

- `editorType` is the UI layout sent to the backend; `type` is the *iframe* platform
  layout (CSS/touch; `mobile` sets `position: fixed`). For mobile embeds set both.
- `editorGoBack`: `true` shows "Open file location"; `false` hides it; `"event"` fires
  `onEditorCloseCallback` instead of navigating.
- `editorCustomization` — full field table in
  [config-reference.md](../config-reference.md#editor--viewer).
  Do not invent keys: the portal hands unknown ones to Document Server unchecked.
- `downloadToEvent: true` + `onDownload(url)` intercepts downloads.
- Keep editor state across tab switches by hiding the frame with CSS, not unmounting.
- One frame per document; reuse `frameId` only via destroy → init.
- `requestToken` (the room's share key) opens a file of a public room with no session: the SDK
  appends `share=<token>&is_file=true` to `/doceditor`. This is how a viewer inside a public-room
  page shows its documents ([public-room](public-room.md)).
- Programmatic access to document content (forms, fields, signatures):
  [editor-automation.md](../editor-automation.md).
- `onEditorOpen` is a **manager-mode** event (fires when the user opens the editor from
  the manager) — use it to host the editor in your own container.

Slide files in embeds may additionally take `editorCustomization.slidePlayerBackground`
(portal-version-dependent).

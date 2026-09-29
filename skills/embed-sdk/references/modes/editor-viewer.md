# Editor and Viewer modes

Both render `{src}/doceditor` for the file `id`; viewer adds `action=view` (read-only). The init call, an
`editorCustomization` example, `onEditorCloseCallback`, the mobile layout and `requestToken` for a public file are on
the guide pages `embedding-modes/editor-mode.md` and `viewer-mode.md`; the customization keys are in
`type-aliases/TEditorCustomization.md`. What the pages do not say:

- **`id` is required** — without it the frame opens an empty `/doceditor` with no error and no event. Use one frame per
  document (`frameId: \`editor-${fileId}\``); reuse a `frameId` only via destroy → init, and keep editor state across
  tab switches by hiding the frame with CSS, not by unmounting it.
- `editorType` is the editor UI layout sent to the backend (`desktop` | `embedded` | `mobile`); `type` is the *iframe*
  platform layout (CSS/touch; `mobile` sets `position: fixed`). Mobile embeds set both.
- `editorGoBack`: `true` shows "Open file location", `false` hides it, `"event"` fires `onEditorCloseCallback` instead
  of navigating.
- `editorCustomization` is spread whole into Document Server's `editorConfig.customization`: a key outside the type is
  not rejected anywhere, so do not invent keys ([config-reference](../config-reference.md#editor--viewer)).
  `anonymous: { request: false }` stops the name prompt for anonymous users; `integrationMode: "embed"` prevents the
  auto-scroll to the frame.
- `downloadToEvent: true` + `onDownload(url)` intercepts downloads.
- `requestToken` (the room's share key) opens a file of a public room with no session: the SDK appends
  `share=<token>&is_file=true` to `/doceditor` — how a viewer inside a public-room page shows its documents
  ([public-room](public-room.md)).
- `/doceditor` carries `X-Frame-Options: SAMEORIGIN` like the portal's own pages (client 4.0.0 nginx); it embeds
  cross-origin only because the CSP `frame-ancestors` header lists your origin — the Manager's rule
  ([discovery](../discovery.md#frame-headers--what-they-mean)).
- The editor page handles two methods, `setConfig` and `executeInEditor`, and flags no failures (`isError`): it
  resolves whatever it returns — `executeInEditor` resolves `{}` even when your callback threw. The callback receives
  **three** arguments, `(editor, asc, data)`; the guide page's two-argument example is out of date
  ([editor-automation](../editor-automation.md)).
- `onEditorOpen` is a **manager-mode** event (the user opens a document from the list) — use it to host the editor in
  your own container; it never fires from an editor frame.

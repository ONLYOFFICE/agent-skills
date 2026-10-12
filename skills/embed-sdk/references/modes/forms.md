# Forms mode

Forms gallery for the form filling room given by `id`; omitted, the room configured in the portal's Forms settings is
used (client 4.0.0). Requires a portal on SDK >= 2.2. The wrapper is documented on `usage-sdk/classes/SDK.md`
(`initForms`, `showMenu` defaults to `true`), the sections on `type-aliases/TFormsSection.md`, the custom actions on
`type-aliases/TCustomActionsConfig.md`, the fields (`destination`, `libraryId`, `headerOffset`, `headerHeight`, the
provider fields) with their defaults on `type-aliases/TFrameConfig.md`. What they do not say:

```js
const instance = sdk.initForms({
  frameId: "ds-frame", src: portalUrl, id: roomId,
  destination: "my-forms",                          // initial section — saves a navigateSection call
  events: {
    onNavigate: ({ section }) => {},                 // the user moved between sections
    onCustomAction: ({ action, type, item }) => {},  // a setCustomActions entry was clicked
    onUploadSuccess: ({ fileName, fileSize }) => {}, // only for upload(); the page's own UI never fires it
    onUploadError: ({ fileName, message }) => {},
  },
});
```

- Sections (`TFormsSection`): `my-forms`, `in-progress`, `completed-forms`, `library`, `settings`. Switch at runtime with
  `await instance.navigateSection("completed-forms")` (resolves `{ section }`). An **unknown section is not answered**:
  the call ends in `TIMEOUT` after `methodTimeout` (client 4.0.0).
- `await instance.upload(file)` (a browser `File`) works here and in Personal; every other mode rejects with
  `SDKError(MODE_MISMATCH)`. It resolves the `onUploadSuccess` payload `{ fileName, fileSize }`, rejects with
  `UPLOAD_FAILED` on `onUploadError` or after its own 120 s timeout (`methodTimeout` does not apply), and emits no
  `onUploadProgress`.
- `setCustomActions({ contextMenu: { file: [{ key, label, icon?, section? }], folder: [] } })` registers context-menu
  entries; clicks arrive as `onCustomAction` with `action` = the `key`. `section` limits an entry to the listed sections;
  omit it to show it everywhere. The same config in `TFrameConfig.customActions` is applied at load. The method also
  works in Manager and Personal (where `createMenu` adds entries to the create menu); elsewhere it rejects with `MODE_MISMATCH`.
- Without `onEditorOpen`, a file opens where `openEditorInSameTab` says: `true` navigates the host page to the editor,
  `false` opens a new tab, unset follows the portal's "Open in the same tab" setting.
- `headerOffset` (px) shifts the header-row controls inline-start (RTL-aware) so host overlays do not cover them;
  `headerHeight` overrides the header height to match host chrome. In Chat the same two fields are container insets
  ([chat](chat.md)).
- `onFileManagerClick` / `onEditorOpen` fire here as in the Manager and suppress the page's own open action
  ([events](../events.md#manager--editor)).
- Auto sign-in through the host portal's OAuth provider: `providerName` + `inviteKey`/`emplType`/`uid`
  ([auth-recipes §4](../auth-recipes.md#4-portal-provider-auto-login-forms--chat--personal)).
- The page handles `setConfig`, `navigateSection`, `setCustomActions` and `upload`; data methods reject with
  `MODE_MISMATCH` ([methods](../methods.md#method-support-by-embedded-page-client-400)).

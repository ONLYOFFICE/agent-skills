# Personal mode

File manager over the user's personal space: My Documents, Favorites, Recent, Shared with me, Trash. Requires a portal on SDK >= 2.2.
No guide page exists: `usage-sdk/classes/SDK.md` documents `initPersonal` (`showMenu` and `infoPanelVisible` default to
`true`), `type-aliases/TPersonalSection.md` the sections, `type-aliases/TFrameConfig.md` the fields
(`personalDestination`, `downloadToEvent`, the Manager-family toggles, the provider fields). What they do not say:

```js
const instance = sdk.initPersonal({
  frameId: "ds-frame", src: portalUrl,
  personalDestination: "my-documents",          // initial section
  events: {
    onNavigate: ({ section }) => {},
    onDownload: (url) => {},                     // with downloadToEvent: true
    onFileManagerClick: (file) => {},            // suppresses the page's own open action
    onUploadSuccess: ({ fileName, fileSize }) => {},   // only for upload()
  },
});
```

- Sections (`TPersonalSection`): `my-documents`, `favorites`, `recent`, `shared-with-me`, `trash`, `settings`. Runtime switching via
  `await instance.navigateSection("trash")`; an unknown section **resolves** `{ error: "Unknown section: …" }` here
  (Forms times out instead) — check the result (client 4.0.0).
- **Not the files UI.** The page handles `setConfig`, `navigateSection` and `upload` only; `getFiles`, `getFolderInfo`,
  `createFile`, `createFolder`, `login` and the rest reject with `MODE_MISMATCH` — run data calls through a Manager or
  System frame ([methods](../methods.md#method-support-by-embedded-page-client-400)).
- `await instance.upload(file)` stores the file in the folder the frame currently shows; same contract as Forms
  (resolves `{ fileName, fileSize }`, `UPLOAD_FAILED` on error or after 120 s, no `onUploadProgress`).
- Events the page emits: `onNavigate`, `onFilterSearch` (`{ search }`, `""` on reset), `onCustomAction`, `onFileManagerClick`,
  `onEditorOpen`, `onDownload` (with `downloadToEvent`), `onUploadSuccess` / `onUploadError` (for `upload()`). Files added
  through the page's own UI fire no upload event.
- Without `onEditorOpen`, a file opens where `openEditorInSameTab` says: `true` navigates the host page to the editor,
  `false` opens a new tab, unset follows the portal's "Open in the same tab" setting. `customActions` (at load) and
  `setCustomActions` add entries to the context menus and the create menu ([methods](../methods.md)).
- Bridge files into the host system: `downloadToEvent: true` + `onDownload(url)` hands you the file URL instead of a
  browser download — extract the file id and let your backend pull the file (CRM attachment, CMS media, …).
- Manager-family options apply (`showFilter`, `disableActionButton`, `infoPanelVisible`, `filter`; `id` opens a
  folder); `viewAs` is ignored by client 4.0.0. `headerOffset`/`headerHeight` behave as in Forms.
- Auto sign-in through the host portal's OAuth provider: `providerName`/`inviteKey`/`emplType`/`uid`
  ([auth-recipes §4](../auth-recipes.md#4-portal-provider-auto-login-forms--chat--personal)).

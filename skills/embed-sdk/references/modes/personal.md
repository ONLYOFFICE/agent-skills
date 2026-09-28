# Personal mode

File manager over the user's personal space: My Documents, Favorites, Recent, Trash.
No docs-site page exists — this file and the SDK source are the reference. Requires a
portal on SDK >= 2.2.

```js
const instance = sdk.initPersonal({
  frameId: "ds-frame",
  src: portalUrl,
  personalDestination: "my-documents",   // initial section
  showMenu: true,
  infoPanelVisible: true,
  events: {
    onNavigate: ({ section }) => {},
    onDownload: (url) => {},             // with downloadToEvent: true
    onFileManagerClick: (file) => {},    // suppresses the page's own open action
    onUploadSuccess: ({ fileName, fileSize }) => {},   // only for upload()
  },
});
```

Sections (`TPersonalSection`): `my-documents`, `favorites`, `recent`, `trash`, `settings`.
Initial section via `personalDestination`; runtime switching via
`await instance.navigateSection("trash")`; user navigation via `onNavigate`.

## Recipe: bridge files into the host system

Set `downloadToEvent: true` and handle `onDownload(url)` — instead of a browser download
you receive the file URL; extract the file id and hand it to your backend to pull the file
into the host app (CRM attachment, WP media, etc.).

## Programmatic upload

`await instance.upload(file)` (a browser `File`) stores the file in the folder the frame currently shows
(SDK 2.2.0, client 4.0.0). It resolves `{ fileName, fileSize }` — the `onUploadSuccess` payload — and rejects
with `UPLOAD_FAILED` on `onUploadError` or after its own 120 s; no `onUploadProgress`. Same contract as Forms.

## Other notes

- Manager-family options apply (`showFilter`, `disableActionButton`, `infoPanelVisible`, `filter`;
  `id` opens a folder). `viewAs` is ignored by client 4.0.0.
- Instance methods: `setConfig`, `navigateSection` and `upload` are handled by this page
  (client 4.0.0). `getFiles`, `getFolderInfo`, `createFile`, `createFolder`, `login`, … reject
  with `MODE_MISMATCH` — run data calls through a Manager or System frame.
- Events the page emits: `onNavigate`, `onFileManagerClick`, `onEditorOpen`, `onDownload` (with
  `downloadToEvent`), `onUploadSuccess` / `onUploadError` (for `upload()`).
- `headerOffset`/`headerHeight` supported (as in Forms/Chat).
- Auto sign-in via `providerName`/`inviteKey`/`emplType`/`uid` — see
  [auth-recipes.md](../auth-recipes.md).

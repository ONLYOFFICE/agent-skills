# Personal mode

File manager over the user's personal space: My Documents, Favorites, Recent, Trash.
No docs-site page exists — this file and the SDK source are the reference. Requires a
portal on SDK >= 2.1.

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

## Other notes

- Manager-family options apply (`viewAs`, `showFilter`, `disableActionButton`,
  `infoPanelVisible`, `filter`).
- `createFile`/`createFolder` act on the currently open folder — resolve it via
  `getFolderInfo()`.
- `headerOffset`/`headerHeight` supported (as in Forms/Chat).
- Auto sign-in via `providerName`/`inviteKey`/`emplType`/`uid` — see
  [auth-recipes.md](../auth-recipes.md).

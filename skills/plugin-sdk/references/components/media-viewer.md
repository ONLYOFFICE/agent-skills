# Media viewer

The portal's media viewer, with a React component of the plugin's as its content.

| | |
|---|---|
| Types | [`IMediaViewer`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/IMediaViewer.md) |
| Class side | `Actions.showMediaViewer` / `updateMediaViewer` / `closeMediaViewer` with `mediaViewerProps` (carrying `component`) |
| From a component | the same names on `usePluginActions()` |
| Surface | the whole viewport, behind the viewer's chrome — in the Files section only |
| `useCurrentFile()` | `{ id, title, fileExst }` of the file on screen — the one passed as `fileId`, then each file the user pages to |

```ts
showMediaViewer({
  fileId: file.id,                                     // a file of the open folder's list - see below
  component: Preview,                                  // reads the file on screen with useCurrentFile()
  playlistFilter: { filesExsts: [".png", ".jpg"], filesSecurity: [FilesSecurity.Read] },
  onClose: () => ({ actions: [Actions.closeMediaViewer] }),
});
```

**The viewer lives over the open folder's file list, and nowhere else.** Its playlist is the files the Files section has loaded for the folder on screen, narrowed by `playlistFilter`, and `useCurrentFile()` is looked up in that playlist. So:

- **Pass `fileId`, always, and make it a file of that list** — the one the user clicked in it. Without `fileId` it opens on a file of the portal's choosing — the first of the playlist on a fresh page — rather than the one the user clicked. An id the playlist does not hold — a file found by search, one from another folder, one the plugin just created and the list has not reloaded, one `playlistFilter` leaves out — opens nothing: the request is dropped with the console line `[Plugin: <name>] The media viewer was not opened: file <id> is not in the open folder`, and `onClose` is not called.
- **Not from a plugin page or portal settings.** An `ArticleNavigation` page drops the call with a console warning. Under `/portal-settings`, the settings aside included, nothing shows either, but the request is kept and checked the next time the Files section is shown — Accounts and the profile share it — against whatever file list is still loaded: it opens if the file is in that list, over Accounts too, and is dropped as above otherwise. A file that is not in an open folder is shown in a modal of your own ([modal-dialog.md](modal-dialog.md)).
- **An update carries only what changes.** Send `updateMediaViewer` with the fields you mean to change, and leave `fileId` out unless you mean to move the viewer — resending the opening props can take the user back to the file they started on.

The component re-renders as the user pages, so `navigation.onFileChange`/`onLoad` are not needed — fetch in an effect keyed on `file?.id`. `playlistFilter` narrows what the viewer pages through — `filesExsts` (case-insensitive, dot optional), `filesSecurity` (every key must be allowed), and also `usersTypes` and `devices`. Those last two are not per-file tests: they compare the *current* user role and device, so they either let the whole playlist through or empty it. Without a filter the playlist is every file the folder's list has loaded, whatever its type, so a viewer for one format pages through the others too — give it `filesExsts`. `title`, when set, replaces the file name in the header for every file the user pages to. Bytes come from the file's `viewUrl`, which answers 404 until the file has been written once ([rest-api.md](../rest-api.md#a-files-contents-are-not-part-of-the-api)).

**Your component gets the whole viewport, and the viewer's chrome is drawn over it.** The content box is `position: fixed; inset: 0` on a dark background. Above it, fixed and at a higher z-index, sit a **64px header band** across the top — title, close cross at the top-right; it fades after 2.5 s without mouse movement and is back on the next move, so it is there whenever the user is about to click — and, when the playlist has more than one entry, two **73px-wide, full-height paging strips** at the left and right edges, transparent until hovered, the whole strip being the click target. Anything drawn under them cannot be reached: a play button in the bottom-left corner pages to the previous file instead of playing. Keep interactive controls out of 64px at the top and 73px at both sides — `padding: 64px 73px 0` on the root is the blunt fix — and remember that a test folder with a single matching file shows no strips at all, so the overlap appears only on a real folder.

- **Keys belong to the viewer while it is open.** A `keydown` listener on `document` takes ←/→ (previous/next), Esc (close), Ctrl+S (download) and **Delete (the portal's delete flow for the file on screen)**, and calls `preventDefault` on all four arrows, Esc, Delete and the `+`/`-`/`=` keys. An input inside the component loses its arrows and its Delete to the viewer; stop the event at your root — `onKeyDown={(e) => e.stopPropagation()}` — and it never reaches `document`.
- **On phones and tablets the content is a swipe surface.** No header band, no strips, but a horizontal drag past a quarter of the width pages and a downward drag past 120px closes, on the very element your component lives in (`touch-action: none`). Content that is itself dragged — a model being rotated, a canvas being panned — competes with that on touch devices; with a mouse the gestures are off.
- **The backdrop does not close a plugin viewer** — the content box fills it. The exits are the cross, Esc, the browser's Back and a `closeMediaViewer()` of your own, which closes the whole viewer without calling `onClose`. The first three, and the downward swipe on touch, go through `onClose`: without one the viewer closes itself; with one it closes only if `onClose` returns `closeMediaViewer` — one that returns nothing leaves the viewer open on the same file, the cross apparently dead, while `useCurrentFile()` goes `null` and back, so an effect keyed on `file?.id` runs again.
- The browser pass mounts the component full-width with none of this chrome, so nothing measures the overlap; check the surface on a portal, in a folder with two matching files.

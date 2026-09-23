# Media viewer

The portal's media viewer, with a React component of the plugin's as its content.

| | |
|---|---|
| Types | [`IMediaViewer`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/IMediaViewer.md) |
| Class side | `Actions.showMediaViewer` / `updateMediaViewer` / `closeMediaViewer` with `mediaViewerProps` (carrying `component`) |
| From a component | the same names on `usePluginActions()` |
| Surface | the whole viewport, behind the viewer's chrome |
| `useCurrentFile()` | the file on screen — the one passed as `fileId`, then each file the user pages to |

```ts
showMediaViewer({
  fileId: file.id,                                     // the file to open on - without it useCurrentFile() starts as null
  title: file.title,
  component: Preview,                                  // reads the file on screen with useCurrentFile()
  playlistFilter: { filesExsts: [".png", ".jpg"], filesSecurity: [FilesSecurity.Read] },
  onClose: () => ({ actions: [Actions.closeMediaViewer] }),
});
```

**Pass `fileId`.** It is the file the viewer opens on, and the only way the component learns it: opened from a class-side click without one, the viewer has no current file and `useCurrentFile()` stays `null` until the user pages. Only when the portal's own viewer is already open — a context menu item on an image, clicked in the viewer's menu — does the file on screen stand in for it.

The component re-renders as the user pages, so `navigation.onFileChange`/`onLoad` are not needed — fetch in an effect keyed on `file?.id`. `playlistFilter` narrows what the viewer pages through — `filesExsts` (case-insensitive, dot optional), `filesSecurity` (every key must be allowed), and also `usersTypes` and `devices`. Those last two are not per-file tests: they compare the *current* user role and device, so they either let the whole playlist through or empty it. Without a filter the playlist is every file the folder's list has loaded, whatever its type, so a viewer for one format pages through the others too — give it `filesExsts`. Bytes come from the file's `viewUrl`, which answers 404 until the file has been written once ([rest-api.md](../rest-api.md#a-files-contents-are-not-part-of-the-api)).

**Your component gets the whole viewport, and the viewer's chrome is drawn over it.** The content box is `position: fixed; inset: 0` on a dark background. Above it, fixed and at a higher z-index, sit a **64px header band** across the top — title, close cross at the top-right; it fades after 2.5 s without mouse movement and is back on the next move, so it is there whenever the user is about to click — and, when the playlist has more than one entry, two **73px-wide, full-height paging strips** at the left and right edges, transparent until hovered, the whole strip being the click target. Anything drawn under them cannot be reached: a play button in the bottom-left corner pages to the previous file instead of playing. Keep interactive controls out of 64px at the top and 73px at both sides — `padding: 64px 73px 0` on the root is the blunt fix — and remember that a test folder with a single matching file shows no strips at all, so the overlap appears only on a real folder.

- **Keys belong to the viewer while it is open.** A `keydown` listener on `document` takes ←/→ (previous/next), Esc (close), Ctrl+S (download) and **Delete (the portal's delete flow for the file on screen)**, and calls `preventDefault` on all four arrows, Esc, Delete and the `+`/`-`/`=` keys. An input inside the component loses its arrows and its Delete to the viewer; stop the event at your root — `onKeyDown={(e) => e.stopPropagation()}` — and it never reaches `document`.
- **On phones and tablets the content is a swipe surface.** No header band, no strips, but a horizontal drag past a quarter of the width pages and a downward drag past 120px closes, on the very element your component lives in (`touch-action: none`). Content that is itself dragged — a model being rotated, a canvas being panned — competes with that on touch devices; with a mouse the gestures are off.
- **The backdrop does not close a plugin viewer** — the content box fills it — so the cross, Esc and your own `closeMediaViewer()` are the exits, and `onClose` still has to return `closeMediaViewer`.
- The browser pass mounts the component full-width with none of this chrome, so nothing measures the overlap; check the surface on a portal, in a folder with two matching files.

# Room selector and File selector modes

Modal-style pickers. The contract is two events: `onSelectCallback` (choice made) and
`onCloseCallback` (dialog cancelled/closed). Destroy the frame in both.

```js
const instance = sdk.initRoomSelector({          // or initFileSelector
  frameId: "selector-frame",
  src: portalUrl,
  selectorType: "roomsOnly",                     // all | roomsOnly | userFolderOnly
  showSelectorCancel: true,
  showSelectorHeader: true,
  acceptButtonLabel: "Select",
  events: {
    onSelectCallback: (payload) => { use(payload); instance.destroyFrame(); },
    onCloseCallback: () => instance.destroyFrame(),
  },
});
```

## Payload shapes differ — this bites everyone

- **room-selector** fires with an **array**:
  `payload[0].id`, `payload[0].label` (title), `payload[0].icon`,
  `payload[0].requestTokens[0].requestToken` (ready for `public-room` mode).
- **file-selector** fires with an **object**:
  `payload.id`, `payload.title`, `payload.fileExst`, `payload.documentType` — no `icon`.

## Options

- `selectorType` filters the tree: `all` (rooms + user folders), `roomsOnly`,
  `userFolderOnly`.
- `roomType` — filter rooms by type; `filterParam` (file-selector) — file-type filter,
  default `"ALL"`.
- UI toggles: `withSearch`, `withBreadCrumbs`, `withSubtitle` (all default `true`),
  `showSelectorCancel`, `showSelectorHeader` (default `false`),
  `cancelButtonLabel`. `buttonColor` is deprecated in 2.2.0 and ignored by client 4.0.0 (the button follows the
  portal theme).

## Recipe: selector in a host modal

1. Open your modal with an empty `<div id="selector-frame">`.
2. Init the selector; on `onAppReady` reveal it (swap your spinner).
3. `onSelectCallback` → consume payload → `destroyFrame()` → close modal.
4. `onCloseCallback` → `destroyFrame()` → close modal.
5. Store selected ids as plain strings/numbers (block/attribute serializers may choke on
   exotic wrappers).

Generic `init` with `mode: "room-selector"` / `"file-selector"` is equivalent to the
wrappers — production integrations use both.

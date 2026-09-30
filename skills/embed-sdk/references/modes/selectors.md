# Room selector and File selector modes

Modal-style pickers with a two-event contract: `onSelectCallback` (choice made) and `onCloseCallback` (cancelled or
closed). The init calls, `selectorType`, `roomType`, the header/cancel toggles and a host-modal recipe are on the guide
pages `embedding-modes/room-selector-mode.md` and `file-selector-mode.md`; the toggles with their defaults
(`withSearch`, `withBreadCrumbs`, `withSubtitle`, `showSelectorCancel`, `showSelectorHeader`, the button labels) are in
`type-aliases/TFrameConfig.md`. What the pages do not say, or say wrong:

## Payload shapes differ — this bites everyone

- **room-selector** fires with an **array** (`TSelectedRoom[]`): `payload[0].id`, `payload[0].label` (the title),
  `payload[0].icon`, and `payload[0].requestTokens[0].requestToken` — present only for public rooms and for shared
  custom/form rooms; it is exactly what `public-room` mode needs. The guide's `room.label` on a bare object is wrong.
- **file-selector** fires with an **object** (`TSelectedFile`): `payload.id`, `payload.title`, `payload.fileExst`,
  `payload.documentType` (`"word"`, `"cell"`, `"slide"`, `"pdf"`, …), and `payload.requestTokens` when the file lives
  in a public room. There is no `icon` and no `label` — the guide's `file.label` is `undefined` (client 4.0.0).
- Neither page fires anything but the two callbacks, `onAppReady` and `onAppError`; the selector pages handle
  `setConfig` only ([methods](../methods.md#method-support-by-embedded-page-client-400)).

## Rules

- Destroy the frame in **both** callbacks (`instance.destroyFrame()`), then close your modal; the container `div` stays,
  so a fresh `init*` on the same `frameId` may follow at once.
- Store the selected ids as plain strings or numbers — block or attribute serializers choke on the payload objects.
- `buttonColor` is deprecated in 2.2.0 and ignored by client 4.0.0: the accept button follows the portal theme.
- Generic `init` with `mode: "room-selector"` / `"file-selector"` is equivalent to the wrappers.

# TFrameConfig: the fields that bite (SDK 2.2.0)

The field list, types and defaults live in the installed package —
`node_modules/@onlyoffice/docspace-sdk-js/dist/types/main.d.ts` (`TFrameConfig`, `TFrameFilter`,
`TEditorCustomization`, JSDoc carries each default) — and in the docs reference
([TFrameConfig](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/type-aliases/TFrameConfig.md), one row per field, defaults included). `scripts/validate-config.mjs` is generated from the
same types by `scripts/sync-sdk.mjs`, so it knows every key. This file records only what the
types do not say: which mode reads a field, what a wrong value does, and where the defaults
surprise.

Contents: Required · Per-mode meaning of `id` · General fields · Manager and `filter` · Selectors ·
Editor / viewer · Uploader · Forms · Chat · Personal · Script-tag configs · Iframe paths per mode

## Required

`frameId` (default `"ds-frame"` — set it explicitly; it must equal the container's DOM `id`),
`mode` (one of the 11 `SDKMode` values), `src` (portal origin). Everything else falls back to
`defaultConfig`.

## Per-mode meaning of `id`

| mode | `id` is | Missing it |
|---|---|---|
| editor, viewer | file id | empty `/doceditor`, no error — **required** |
| public-room | room id (→ `?folder=`) | the page cannot load the room and renders its invalid-link error, no event — **required** with `requestToken` |
| uploader | destination folder id | uploads have no target |
| forms | room id | the gallery has no room |
| manager | start folder; the SDK moves it into `filter.folder` | opens `rootPath` |
| others | ignored | — |

## General fields — traps

| Field | Trap |
|---|---|
| `type` vs `editorType` | `type` is the iframe platform layout (`desktop`/`embedded`/`mobile`; `mobile` sets `position: fixed`); `editorType` is the editor UI layout sent to the backend. Mobile embeds set both |
| `noLoader` | default `true`, but Manager and System force the loader on |
| `waiting` | `true` keeps the iframe out of the DOM (System renders anyway); a plain `setConfig` then rejects with `DISCONNECTED` — release it with `setConfig({ waiting: false }, true)` or a fresh `init*` |
| `checkCSP` | `false` only skips the early CSP probe; the portal still enforces the allow-list |
| `methodTimeout` | ms before a method rejects with `TIMEOUT` (30 000); absent on SDK < 2.2 |
| `theme` | `"Base"`, `"Dark"`, `"System"` — capitalized; `"dark"` is rejected |
| `locale` | BCP 47 (`"en-US"`); `null` = portal default |
| `destroyText` | text of the placeholder after `destroyFrame()` — plain text in 2.2 (`textContent`); 2.1 and earlier inserted it as HTML |
| `stylesUrl`, `integrationUrl` | SDK 2.2: custom stylesheet inside the frame; host URL to return to from external portal pages |
| `getToken` / `accessToken` / `tokenExpiresAt` | SDK >= 2.2 only; `getToken` wins when both are set; the SDK does not parse the token |
| `requestToken` | public-room (required); manager over a shared room (`rootPath: "/rooms/share"`); editor and viewer, where the SDK sends it as `share=<token>&is_file=true` on `/doceditor` so a file of a public room opens without a session (portal script 1.0.1+, npm 1.1.0+). Ignored by the selectors, system, uploader, forms, chat and personal pages |
| `providerName`, `inviteKey`, `emplType`, `uid` | forms, chat, personal: portal-provider auto sign-in |
| `headerOffset`, `headerHeight` | forms/personal: header-row inline-start padding / header height; **chat: container insets** (`padding-inline-start` / `padding-block-start`) |

## Manager and `filter`

- `rootPath` default `/rooms/shared/`; the iframe URL is `{src}{rootPath}filter?{filter…}`, `{src}{rootPath}{id}/filter?…`
  with an `id`, and `{src}{rootPath}?key={requestToken}&…` over a shared room.
- The defaults of `viewAs`, `viewTableColumns`, the `show*` flags and `showHeaderBanner` are in
  [TFrameConfig](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/type-aliases/TFrameConfig.md). Worth knowing: `viewTableColumns` lists all five columns by
  default and embeds usually trim it to `"Name,Size,Type"`; `showSettings` adds the column picker.
- `filter.sortBy` takes the **API values**, not the enum key names — `AZ` for the name, `DateAndTime` for the
  modified date; the full list is [FilterSortBy](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/enumerations/FilterSortBy.md). `sortOrder` is
  `ascending` / `descending`; `count` and `page` are strings; `folder` is set from `id` — never by hand.

## Selectors (room-selector / file-selector)

`selectorType` (`all` / `roomsOnly` / `userFolderOnly`), `filterParam` (file type) and `roomType` narrow
what can be picked; the labels, the colour and the `with*` / `show*` toggles, with their defaults, are in
[TFrameConfig](https://api.onlyoffice.com/docspace/javascript-sdk/usage-sdk/type-aliases/TFrameConfig.md). Payload shapes differ per selector
— [events](events.md#selectors-room-selector--file-selector).

## Editor / viewer

- `editorGoBack`: `true` shows "Open file location", `false` hides it, `"event"` fires
  `onEditorCloseCallback` instead of navigating.
- `downloadToEvent: true` routes downloads to `onDownload(url)`.
- `editorCustomization` (`TEditorCustomization`): the portal spreads the whole object into Document Server's
  `editorConfig.customization`, so a key outside the type is not rejected anywhere — it reaches Document Server,
  which decides what to do with it. Take the key list from the types; the validator warns on the rest. Notable: `anonymous: { request, label }`
  (prompt anonymous users for a name; `request: false` for embeds), `integrationMode: "embed"`
  (prevents auto-scroll to the frame), `compactToolbar` defaults `false` in edit and `true` in view,
  `hideRulers` defaults `true` for slides, `zoom` `-1` fit page / `-2` fit width, `macros: false`
  needs Document Server >= 9.0.3, `uiTheme` values are `theme-*` / `default-*` strings.

## Uploader

`id` = destination folder; `acceptExtensions` (`".pdf,.docx"`); `isFolderUpload`,
`isMultipleUpload`; `maxPerUploadSize`, `maxTotalUploadSize` are **strings** of bytes;
`linkMainText`, `secondaryText`, `extensionsText` are drop-zone texts. No programmatic
`upload()` here (Forms only).

## Forms

`id` = room; `destination` initial section (`my-forms` default, `in-progress`, `completed-forms`,
`library`, `settings`); `libraryId` restricts to one library; `showMenu` side panel;
`headerOffset` / `headerHeight` as above.

## Chat (SDK >= 2.2)

`agentId` (numeric agent room id; omitted → the user's own chat), `entityId` (room/folder context —
ignored when `agentId` is set), `fileId` (attach to the composer), `threadId` (resume; was `chatId`
in pre-release builds). Renders a composer only for a signed-in user who is not a guest; anyone else gets the
page's no-access state and `onNoAccess` — [chat](modes/chat.md).

## Personal (SDK >= 2.2)

`personalDestination` initial section (`my-documents` default, `favorites`, `recent`, `trash`,
`settings`); manager-family display options apply; only `setConfig` and `navigateSection` are
answered by its page.

## Script-tag configs

Parameters on the script URL arrive as **strings**: only `"true"`/`"false"` become booleans, numbers
stay strings. Filter fields are passed as **bare, case-sensitive keys** (`count=25&sortOrder=descending&sortBy=AZ`)
and routed into `config.filter` by exact match; bracket (`filter[count]`) and lowercase (`sortorder`)
forms are not recognized (pinned by SDK tests) — they become junk root-level keys and the filter
silently keeps its defaults. Pass `src` explicitly even when it equals the script origin; `init=true`
auto-initializes on load.

## Iframe paths per mode

| mode | Base path |
|---|---|
| manager | `{rootPath}` + `filter?…` (`{id}/filter?…` with an `id`, `?key=…` with a `requestToken`) |
| editor / viewer | `/doceditor` (viewer adds `action=view`) |
| room-selector | `/sdk/room-selector` |
| file-selector | `/sdk/file-selector` |
| system | `/old-sdk/system` |
| public-room | `/sdk/public-room` |
| uploader | `/sdk/uploader` |
| forms | `/sdk/forms/my-forms` |
| chat | `/sdk/chat` |
| personal | `/sdk/personal-files/my-documents` |

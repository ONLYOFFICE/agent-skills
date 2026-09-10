# TFrameConfig reference (SDK 2.2.0)

The authoritative field list is the installed package's
`dist/types/main.d.ts` (`TFrameConfig`, `TFrameFilter`, `TEditorCustomization`); the
validator's dictionaries are generated from it by `scripts/sync-sdk.mjs`. This file adds
what the types do not say — defaults, which mode reads a field, and the traps. Only
`frameId`, `mode`, `src` are required; everything else falls back to `defaultConfig`.

Contents: Required · General / appearance · Entity / auth · Manager (+ `filter`) · Selectors ·
Editor / viewer (+ `editorCustomization`) · Uploader · Forms · Chat · Personal · Iframe paths per mode

## Required

| Field | Type | Default | Notes |
|---|---|---|---|
| `frameId` | string | `"ds-frame"` | DOM id of the target container **and** the postMessage routing key |
| `mode` | string | `"manager"` | one of the 11 `SDKMode` values |
| `src` | string | `""` | ONLYOFFICE Apps portal origin; iframe URL = `src` + mode path |

## General / appearance (all modes)

| Field | Type | Default | Notes |
|---|---|---|---|
| `width` / `height` | string | `"100%"` / `"100%"` | any CSS size |
| `theme` | string | `"System"` | `"Base"` (light), `"Dark"`, `"System"` |
| `locale` | string \| null | `null` | BCP 47 (`"en-US"`); null = portal default |
| `type` | string | `"desktop"` | iframe platform layout: `desktop`/`embedded`/`mobile`; `mobile` sets `position: fixed` |
| `name` | string | `"frameDocSpace"` | iframe `name` prefix → `frameDocSpace__#{frameId}` |
| `noLoader` | boolean | `true` | skip loading spinner; Manager and System force the loader on |
| `waiting` | boolean | `false` | delay iframe render until `setConfig` is called (System always renders) |
| `checkCSP` | boolean | `true` | validate host domain against `{src}/api/2.0/security/csp` before load |
| `destroyText` | string | `""` | HTML placed into the placeholder div after `destroyFrame()` |
| `methodTimeout` | number | `30000` | ms before a method call rejects with `TIMEOUT` |
| `events` | TFrameEvents | all `null` | see [events.md](events.md) |
| `stylesUrl` | string | — | custom stylesheet applied inside the frame |
| `integrationUrl` | string | — | host page URL used to return the user from external portal pages |
| `init` | boolean \| null | `null` | script-tag entry only: `true` = auto-initialize on load |

## Entity / auth

| Field | Type | Default | Modes | Notes |
|---|---|---|---|---|
| `id` | string \| number \| null | `null` | editor, viewer (file id); public-room (room id → `?folder=`); uploader (target folder); forms (room id); manager (start folder → `filter.folder`) | **required** for editor/viewer/public-room |
| `requestToken` | string \| null | `null` | public-room (required, together with `id`); shared files | token from a room share link |
| `getToken` | `() => string \| Promise<string>` | — | all (SDK >= 2.2) | OAuth mode: called whenever the frame needs a Bearer token |
| `accessToken` | string | — | all (SDK >= 2.2) | static OAuth token; SDK cannot refresh it — prefer `getToken` |
| `tokenExpiresAt` | number | — | all | optional explicit expiry (epoch ms); else decoded from JWT `exp` |
| `providerName` | string | — | forms, chat, personal | OAuth provider for automatic sign-in (e.g. `"nextcloud"`) |
| `inviteKey` / `emplType` / `uid` | string | — | forms, chat, personal | signup-via-OAuth parameters |

## Manager mode

| Field | Type | Default | Notes |
|---|---|---|---|
| `rootPath` | string | `"/rooms/shared/"` | base navigation path |
| `viewAs` | string | `"row"` | `row` / `table` / `tile` |
| `viewTableColumns` | string | `"Index,Name,Size,Type,Tags"` | visible columns for `table` view |
| `showMenu` | boolean | `false` | left navigation menu (also Forms) |
| `showFilter` | boolean | `false` | filter toolbar |
| `showTitle` | boolean | `true` | section/room title |
| `showHeader` | boolean | `false` | header bar (mobile manager) |
| `showHeaderBanner` | string | `"none"` | `all` / `info` / `none` |
| `showSettings` | boolean | `false` | "Manage displayed columns" button |
| `showSignOut` | boolean | `true` | "Sign out" button |
| `infoPanelVisible` | boolean | `true` | info panel toggle |
| `disableActionButton` | boolean | `false` | hide "Actions" button |
| `filter` | TFrameFilter | see below | list filtering/paging |

### `filter` object

| Field | Default | Notes |
|---|---|---|
| `count` | `"100"` | items per page |
| `page` | `"1"` | 1-based |
| `sortBy` | `"DateAndTime"` | **API values**: `AZ` (name), `DateAndTime` (modified), `DateAndTimeCreation` (created), `LastOpened`, `Author`, `Room`, `roomType`, `Size`, `Tags`, `Type`, `usedspace` |
| `sortOrder` | `"descending"` | `ascending` / `descending` |
| `search` | `""` | search query |
| `withSubfolders` | `false` | include subfolder contents in search |
| `folder` | auto | set from `id` in manager mode; do not set manually |

Script-tag embeds pass filter fields as **bare, case-sensitive query keys**
(`?count=25&sortOrder=descending&sortBy=AZ`) — the parser routes exact matches into
`config.filter`. Bracket (`filter[count]`) and lowercase (`sortorder`) forms are **not
recognized** (pinned by SDK tests): they become junk root-level config keys and the
filter silently keeps its defaults.

## Selector modes (room-selector / file-selector)

| Field | Type | Default | Notes |
|---|---|---|---|
| `selectorType` | string | `"all"` | `all` / `roomsOnly` / `userFolderOnly` |
| `filterParam` | string | `"ALL"` | file-type filter for file-selector |
| `roomType` | string | — | room type filter |
| `acceptButtonLabel` / `cancelButtonLabel` | string | Select / Cancel | button labels |
| `buttonColor` | string | `"#5299E0"` | accept button HEX color |
| `showSelectorCancel` | boolean | `false` | show Cancel button |
| `showSelectorHeader` | boolean | `false` | show header |
| `withBreadCrumbs` | boolean | `true` | breadcrumb navigation |
| `withSearch` | boolean | `true` | search bar |
| `withSubtitle` | boolean | `true` | folder description subtitle |

## Editor / viewer modes

| Field | Type | Default | Notes |
|---|---|---|---|
| `editorType` | string | `"desktop"` | UI layout sent to the backend: `desktop` / `embedded` / `mobile` |
| `editorGoBack` | boolean \| `"event"` | `true` | "Open file location"; `"event"` fires `onEditorCloseCallback` instead |
| `editorCustomization` | object | `{}` | see table below |
| `downloadToEvent` | boolean | `false` | route downloads to `onDownload` instead of the browser |

### `editorCustomization` (TEditorCustomization)

| Field | Default | Notes |
|---|---|---|
| `anonymous` | `{ request: true, label: "Guest" }` | `TEditorAnonymous`; prompt anonymous users for a name |
| `autosave` | `true` | `false` leaves only Strict co-editing |
| `comments` | `true` | `false` = view-only comments |
| `compactHeader` | `false` | move action buttons to toolbar |
| `compactToolbar` | `false` (edit) / `true` (view) | compact toolbar layout |
| `compatibleFeatures` | `false` | OOXML-compatible features only |
| `forcesave` | `false` | force-save on manual Save |
| `help` | `true` | Help button |
| `hideRightMenu` | `true` | collapse right panel on load |
| `hideRulers` | `false` (docs) / `true` (slides) | hide rulers |
| `integrationMode` | — | `"embed"` prevents auto-scroll to the frame |
| `macros` | `true` | `false` disables macros entirely (>= 9.0.3) |
| `macrosMode` | `"warn"` | `disable` / `warn` / `enable` |
| `mentionShare` | `true` | mention grants access + notification |
| `mobileForceView` | `true` | mobile editor opens in view mode |
| `plugins` | `true` | enable plugins |
| `toolbarHideFileName` | `false` | hide document title |
| `toolbarNoTabs` | `false` | flat toolbar tabs |
| `uiTheme` | `"theme-classic-light"` | `theme-light`, `theme-dark`, `theme-contrast-dark`, `theme-white`, `theme-night`, `default-dark`, `default-light` |
| `unit` | `"cm"` | `cm` / `pt` / `inch` |
| `zoom` | `100` | `-1` fit page, `-2` fit width |

Do not invent other keys — unknown `editorCustomization` fields are silently ignored (or
belong to a different SDK version).

## Uploader mode

| Field | Type | Notes |
|---|---|---|
| `id` | string \| number | target folder id |
| `linkMainText` / `secondaryText` / `extensionsText` | string | drop-zone texts |
| `acceptExtensions` | string | e.g. `".pdf,.docx"` |
| `isFolderUpload` | boolean | allow folder upload |
| `isMultipleUpload` | boolean | allow multiple files |
| `maxPerUploadSize` / `maxTotalUploadSize` | string | size limits |

## Forms mode

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | string \| number | — | room id |
| `destination` | string | `"my-forms"` | initial section: `my-forms` / `in-progress` / `completed-forms` / `library` / `settings` |
| `libraryId` | string | — | show only items from a forms library |
| `showMenu` | boolean | `false` | side panel |
| `headerOffset` | number | `0` | px inline-start padding for header rows (host overlay clearance); also chat, personal |
| `headerHeight` | number | portal default | override header height; also chat, personal |

## Chat mode (SDK >= 2.2)

| Field | Type | Notes |
|---|---|---|
| `agentId` | string \| number | AI agent room id; omitted → chat bound to the current user |
| `entityId` | string \| number | room/folder the chat is opened from (workspace context + tool scope; caller needs access); ignored when `agentId` is set |
| `fileId` | string \| number | file to attach to the composer on init |
| `threadId` | string | thread to resume (named `chatId` in pre-release 2.2 builds) |
| `headerOffset` / `headerHeight` | number | in chat mode these are container insets: `padding-inline-start` / `padding-block-start` (px) |

## Personal mode

| Field | Type | Default | Notes |
|---|---|---|---|
| `personalDestination` | string | `"my-documents"` | `my-documents` / `favorites` / `recent` / `trash` / `settings` |

## Iframe paths per mode (informational)

| mode | Base path |
|---|---|
| manager | `{rootPath}` |
| editor / viewer | `/doceditor` (viewer adds `action=view`) |
| room-selector | `/sdk/room-selector` |
| file-selector | `/sdk/file-selector` |
| system | `/old-sdk/system` |
| public-room | `/sdk/public-room` |
| uploader | `/sdk/uploader` |
| forms | `/sdk/forms/my-forms` |
| chat | `/sdk/chat` |
| personal | `/sdk/personal-files/my-documents` |

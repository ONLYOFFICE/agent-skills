# Talking to the DocSpace REST API

| Code runs in | Use | Needs `API` scope | Unwraps `response` | Auth |
|---|---|---|---|---|
| A **React component** | `usePluginAPI()` — [react.md → API client](react.md#the-api-client) | no | yes — you get the payload | automatic |
| A **class-side callback** (menu click, file click, event, create-dialog `onSave`) | `fetch` against `getAPI()` | yes | no — read `.response` yourself | session cookies: `credentials: "include"` |

Where a feature has both halves — a click that opens a panel — fetch in the component; the click hands over the id.

## From the class: `getAPI()` and `fetch`

`getAPI()` returns `{ origin, proxy, prefix }`; any part may be empty or carry stray slashes, so join carefully, and **lazily** — `setAPI` is guaranteed only before `onLoadCallback`, so a value computed at module scope is empty:

```ts
const buildApiUrl = (): string => {
  const { origin, proxy, prefix } = plugin.getAPI();
  let url = origin.replace(/\/+$/, "");
  for (const part of [proxy, prefix]) {
    const clean = (part ?? "").trim().replace(/^\/+/, "");
    if (clean) url += `/${clean}`;
  }
  return url;   // https://portal.example.com/api/2.0
};

const onFileAction = async (id: number): Promise<IMessage> => {
  try {
    const res = await fetch(`${buildApiUrl()}/files/file/${id}`, { credentials: "include" });
    const file = (await res.json()).response;                        // the envelope, class-side
    if (!file.security?.Download)
      return { actions: [Actions.showToast], toastProps: [{ type: ToastType.error, title: t("noPermission") }] };
    const bytes = await fetch(file.viewUrl, { credentials: "include" });
    const text = bytes.status === 404 ? "" : await bytes.text();     // 404 = no content stream yet (below)
    …
    return { actions: [Actions.showToast], toastProps: [{ type: ToastType.success, title: t("done") }] };
  } catch {
    return { actions: [Actions.showToast], toastProps: [{ type: ToastType.error, title: t("failed") }] };   // nothing catches this for you
  }
};
```

Forgetting `.response` yields an object that looks plausible and has none of the fields. Inside a component the opposite holds — `.response` is `undefined`.

## Permissions

Every file, folder and room in a payload carries a `security` map: PascalCase keys, all optional, `true` when the current user may do that thing. Check it before offering or performing an action; a 403 afterwards is the same fact learned late. Item-level filters (`security`, `itemSecurity`, `fileSecurity` in [items.md](items.md)) do the same declaratively.

**The keys are enums, so type them as enums** — `Partial<Record<FilesSecurity, boolean>>` from the SDK, never `Record<string, boolean>`, which is how a misspelled key ends up read as `undefined` and the plugin quietly decides the user has no rights (or offers an action the portal then refuses):

| Enum | Applies to | Keys |
|---|---|---|
| `FilesSecurity` (SDK) | a file's own map, and `fileSecurity` on a `File`-scope item | `Read`, `Comment`, `FillForms`, `Review`, `Edit`, `EditForm`, `EditHistory`, `ReadHistory`, `CustomFilter`, `Rename`, `Lock`, `Move`, `Copy`, `Delete`, `Duplicate`, `Download`, `Convert`, `CopyLink`, `Embed`, `CreateRoomFrom`, `SubmitToFormGallery`, `StopFilling`, `ResetFilling` |
| `Security` (SDK) | a folder's or room's map, and `security`/`itemSecurity` on an item | `Read`, `Create`, `Rename`, `Delete`, `Move`, `MoveTo`, `Copy`, `CopyTo`, `Duplicate`, `Download`, `EditRoom`, `EditAccess`, `Pin`, `Mute`, `CopyLink`, `CopySharedLink`, `Embed`, `CreateRoomFrom` |

**`Create` is the one that answers "may I put something here"** — it lives on the *destination* folder or room, so a plugin that writes checks the target's `security.Create`, not the source file's.

The wire payload is wider than either enum — one shape for files and folders, with keys the SDK's enums do not name (`StartFilling`, `IndexExport`, `ChangeOwner`, `AskAi`, …). The full list is a generated type in the project: `node_modules/@onlyoffice/docspace-api-sdk/dist/models/file-entry-dto-integer-all-of-security.d.ts` (and `folder-dto-integer-security.d.ts`). Read that when a key is not in the enums; keep the item filters to what the SDK declares, since those are what the host compares.

## Endpoints to start from

The handful the official plugins reach for. **Everything else is in the [ONLYOFFICE DocSpace API reference](https://api.onlyoffice.com/docspace/api-backend/get-started/basic-concepts/)** (sections: Files, Rooms, People, Group, Portal, Settings, Security, ThirdParty, …) — look endpoints and their query parameters up there rather than recalling them; a path remembered from another product answers 404.

**The API is also typed inside the project.** `@onlyoffice/docspace-api-sdk` is installed as a dependency of the kit — a generated client whose types are the same contract the portal serves:

```
node_modules/@onlyoffice/docspace-api-sdk/dist/models/*.d.ts        every enum, with its numeric values in a JSDoc line
node_modules/@onlyoffice/docspace-api-sdk/dist/api/<area>/*.d.ts    every endpoint, with its full parameter list and types
```

Read those instead of deciding a shape by feel. They answer the questions that otherwise get guessed: whether a query enum wants the number or the name (`SearchArea` is `Active: 0, Archive: 1, Any: 2, …`), what a field on a payload means, which parameters an endpoint takes and in what order. Do not import from the package — it is not on the portal's externals list, so importing it bundles a second HTTP client into the plugin. It is documentation that happens to compile; the request still goes through `usePluginAPI()`.

| Purpose | Request |
|---|---|
| File metadata | `GET /files/file/{id}` |
| Folder contents / metadata | `GET /files/{folderId}` / `GET /files/folder/{folderId}` |
| **Create a folder** | `POST /files/folder/{folderId}` `{ title }` — `folderId` is the **parent**; note the shape differs from the create-file path below, which is the usual mix-up |
| Create a file | `POST /files/{folderId}/file` `{ title }` — plus `enableExternalExt: true` for an extension the portal has no editor for (below) |
| Rename a file / a folder | `PUT /files/file/{id}` `{ title }` / `PUT /files/folder/{folderId}` `{ title }` |
| Upload a file in one request | `POST /files/{folderId}/upload`, multipart with the bytes under **`File`** — the generated client's own spelling; the chunked alternative is a session (below) |
| Replace file contents | `PUT /files/{id}/update`, `FormData` with the bytes (below) |
| Mark as recent | `POST /files/file/{id}/recent` |
| Current user / people | `GET /people/@self` (a component has `useCurrentUser()`) / `GET /people` |
| Rooms / members | `GET /files/rooms` / `GET /files/rooms/{id}/share` |

**Confirm the path and the field names in the api-sdk types, not from this table** — `dist/api/files/folders-api.js` and `files-api.js` contain the literal URL and every form field the portal accepts, which is the only place the two `{folderId}` shapes above stop being confusable. Where the api-sdk has no method for something (replacing a file's bytes is one), the API reference is the authority and the request is hand-written.

List endpoints page with `count` + `startIndex` and take filter/sort as query params (`params` of `api.get`); `total` arrives beside the rows, whose field the endpoint names (`folders`, `files`, `items`). Page and search in the request, as the portal's own screens do.

### Walking a folder tree

Recursion plus paging, the shape almost every plugin that reads or writes a subtree needs. One page at a time, `total` decides whether to ask again, and the relative path is carried down rather than reconstructed:

```ts
type TEntry = { id: number; title: string; security?: Partial<Record<Security, boolean>> };
type TFolderPage = { folders: TEntry[]; files: TEntry[]; total: number };

const PAGE = 100;

async function* walkFolder(api: PluginAPIClient, folderId: number, prefix = "", signal?: AbortSignal) {
  for (let startIndex = 0; ; startIndex += PAGE) {
    const page = await api.get<TFolderPage>(`/files/${folderId}`, { count: PAGE, startIndex }, { signal });

    for (const file of page.files ?? []) yield { ...file, path: `${prefix}${file.title}` };

    for (const folder of page.folders ?? [])
      yield* walkFolder(api, folder.id, `${prefix}${folder.title}/`, signal);   // depth-first; the path is the zip entry name

    if (startIndex + PAGE >= (page.total ?? 0)) return;
  }
}
```

`total` counts the folder's own rows, folders and files together, so the loop ends on the *page* count and the recursion is what descends. Pass the effect's `AbortSignal` all the way down, or a closed panel keeps walking.

### Writing bytes into a folder the plugin created

The two halves — a folder, then a file with content — in the order the portal wants them:

```ts
const { id: folderId } = await api.post<TEntry>(`/files/folder/${parentId}`, { title: folderName });

const form = new FormData();
form.append("File", new File([bytes], fileName, { type: "application/octet-stream" }));
await api.post(`/files/${folderId}/upload`, form);        // no Content-Type of your own - the boundary is generated
```

For a large file, or when the portal must know the size up front, create an upload session instead (below). Either way check the destination's `security.Create` first, and remember that a plugin's own extension needs `enableExternalExt` when the file is created through the create-file endpoint rather than uploaded.

### A file's contents are not part of the API

Metadata is JSON; the **bytes** are a `fetch` of the `viewUrl` the metadata carries (same origin, cookies), and a write is a multipart `PUT`:

```ts
const info = await api.get<TFile>(`/files/file/${id}`);
const body = await (await fetch(info.viewUrl, { credentials: "include", signal })).text();   // or .blob()

const form = new FormData();
form.append("file", new File([newBody], info.title, { type: mimeType }));
await api.put(`/files/${id}/update`, form);     // class-side: fetch with credentials and NO Content-Type of your own
```

The api-sdk has **no generated method for this endpoint** — its `updateFile` is the JSON rename (`title`, `lastVersion`) — so this is the one write whose shape cannot be confirmed against the project's types; the API reference is the authority, and the upload paths above are the typed alternative when a new version is acceptable.

**A record with no content stream answers 404 on its own `viewUrl`, while its metadata answers 200.** The portal creates the record first and the bytes arrive on the first write, so a file the plugin just created through the create dialog reads as missing — and for a format the portal has no editor for, that is every file until someone saves it once. This is the *first* thing a user does with a plugin that owns an extension: create one, open it. A viewer that reports the 404 shows them an error page over an empty file they just made.

So a 404 here is an empty document, not a failure — but it is the only status that is:

```ts
const response = await fetch(info.viewUrl, { credentials: "include", signal });
if (response.status === 404) return { text: EMPTY, readable: true };    // no stream yet — normal for a new file
if (!response.ok) return { text: EMPTY, readable: false };              // 403, 5xx, network — unknown, not empty
return { text: await response.text(), readable: true };
```

Carry that `readable` flag into the editor and **refuse to save while it is false**: a write is a whole-file replace, so saving over content that merely could not be read is the one failure here that destroys data.

Do not try to predict the 404 from the metadata instead. `GET /files/file/{id}` reports size as **`contentLength`, a formatted string** (`"0 bytes"`) — there is no number to compare. `pureContentLength` is a real field elsewhere in the Files API, but zero values are omitted from these payloads, so on exactly the empty file you are trying to detect it is `undefined` and `info.pureContentLength === 0` is never true. That is why the branch is on the response status and the safety is in the save gate.

### Creating a file whose extension the portal does not own

`POST /files/{folderId}/file` with `{ title }` works for formats the portal has an editor for. For any other extension pass `enableExternalExt: true`, or the portal refuses or rewrites the extension. A `File`-scope plugin wants the flag on **every** create path, the one behind the create dialog included — and appends its own extension itself; neither the dialog nor the API does.

## Uploading a file

Create a session, then post the bytes to the returned location — a full URL, so plain `fetch`:

```ts
const session = await api.post<{ data: { location: string } }>(`/files/${folderId}/upload/create_session`,
  { createOn: new Date().toISOString(), fileName, fileSize: blob.size });
const form = new FormData();
form.append("file", new File([blob], fileName));
await fetch(session.data.location, { method: "POST", body: form, credentials: "include" });
```

Class-side the location is under `.response.data.location`.

## Third-party origins

Any host outside the portal must be in `cspDomains` in `package.json` — spelled exactly so (`scpDomains` is a real shipped typo that does nothing) — or the CSP blocks the request from component and class alike. Those origins widen the **portal's** CSP, so list only what you call. Third-party requests always go through `fetch`; `usePluginAPI()` refuses absolute URLs.

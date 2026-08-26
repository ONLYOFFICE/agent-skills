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

Files and folders carry a `security` map (`Read`, `Edit`, `Download`, `Delete`, `Rename`, `Move`, `Copy`, `CopyLink`, … — the `FilesSecurity`/`Security` enums). Check it before offering or performing an action; a 403 afterwards is the same fact learned late. Item-level filters (`security`, `itemSecurity`, `fileSecurity` in [items.md](items.md)) do the same declaratively.

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
| Create a file | `POST /files/{folderId}/file` `{ title }` — plus `enableExternalExt: true` for an extension the portal has no editor for (below) |
| Rename | `PUT /files/file/{id}` `{ title }` |
| Replace file contents | `PUT /files/{id}/update`, `FormData` with the bytes under **`file`** (below) |
| Mark as recent | `POST /files/file/{id}/recent` |
| Current user / people | `GET /people/@self` (a component has `useCurrentUser()`) / `GET /people` |
| Rooms / members | `GET /files/rooms` / `GET /files/rooms/{id}/share` |

List endpoints page with `count` + `startIndex` and take filter/sort as query params (`params` of `api.get`); `total` arrives beside the rows, whose field the endpoint names (`folders`, `files`, `items`). Page and search in the request, as the portal's own screens do.

### A file's contents are not part of the API

Metadata is JSON; the **bytes** are a `fetch` of the `viewUrl` the metadata carries (same origin, cookies), and a write is a multipart `PUT`:

```ts
const info = await api.get<TFile>(`/files/file/${id}`);
const body = await (await fetch(info.viewUrl, { credentials: "include", signal })).text();   // or .blob()

const form = new FormData();
form.append("file", new File([newBody], info.title, { type: mimeType }));
await api.put(`/files/${id}/update`, form);     // class-side: fetch with credentials and NO Content-Type of your own
```

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

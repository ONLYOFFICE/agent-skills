# Talking to the DocSpace REST API

Only relevant with the `API` scope declared. The portal hands the plugin its own base URLs and nothing else — there is no token, and none is needed: requests travel on the signed-in user's session.

## Building the base URL

`getAPI()` returns three parts that must be joined carefully, because any of them may be empty or carry stray slashes:

```ts
const buildApiUrl = (): string => {
  const { origin, proxy, prefix } = plugin.getAPI();

  let url = origin.replace(/\/+$/, "");

  for (const part of [proxy, prefix]) {
    if (!part) continue;
    const clean = part.trim().replace(/^\/+/, "");
    if (!clean) continue;
    url += url.endsWith("/") ? clean : `/${clean}`;
  }

  return url;   // e.g. https://portal.example.com/api/2.0
};
```

Build it lazily — on first use, not in `onLoadCallback` — because `setAPI` is guaranteed only to have run before that callback, and caching a value computed too early is a classic source of empty URLs.

## Responses are wrapped

Every endpoint wraps its payload in a `response` field:

```ts
const res = await fetch(`${apiUrl}/files/file/${id}`, { credentials: "include" });
const file = (await res.json()).response;
```

Forgetting `.response` yields an object that looks plausible in the debugger and has none of the fields you want.

## Check permissions before acting

Files and folders carry a `security` map, and the portal expects plugins to respect it. Acting without checking produces a 403 the user cannot interpret:

```ts
if (!file.security?.Download) return { actions: [Actions.showToast], toastProps: [/* … */] };
```

Keys match the `FilesSecurity` and `Security` enums — `Read`, `Edit`, `Download`, `Delete`, `Rename`, `Move`, `Copy`, `CopyLink`, and so on.

## Endpoints in practice

These are the ones the official plugins actually use.

| Purpose | Request |
|---|---|
| File metadata | `GET /files/file/{id}` |
| Folder contents | `GET /files/{folderId}` |
| Folder metadata | `GET /files/folder/{folderId}` |
| Rename / edit a file | `PUT /files/file/{id}` with `{ title }` |
| Replace file contents | `PUT /files/{id}/update` with `FormData` |
| Mark as recently used | `POST /files/file/{id}/recent` |
| Current user | `GET /people/@self` |
| People list | `GET /people` |
| Rooms | `GET /files/rooms` |

Reading a file's bytes does not go through the API: use `file.viewUrl` from its metadata.

## Uploading a file

Two steps — create a session, then post the bytes to the location it returns:

```ts
const session = await fetch(`${apiUrl}/files/${folderId}/upload/create_session`, {
  method: "POST",
  headers: { "Content-Type": "application/json;charset=utf-8" },
  credentials: "include",
  body: JSON.stringify({ createOn: new Date().toISOString(), fileName, fileSize }),
});

const { location } = (await session.json()).response.data;

const form = new FormData();
form.append("file", new File([blob], fileName));

await fetch(location, { method: "POST", body: form, credentials: "include" });
```

The second request goes to the location verbatim — do not prefix it with the API URL.

## Third-party origins

Any host outside the portal must be listed in `cspDomains` in `package.json`, or the portal's Content-Security-Policy blocks the request. Note the spelling: `cspDomains`. Two official plugins carry a typo (`scpDomains`) which silently does nothing — a good reminder that this field fails quietly.

Those origins are appended to the **portal's** CSP, not just the plugin's, so list only what is genuinely called.

## Errors

Nothing wraps plugin callbacks in `try/catch`, so an unhandled rejection here surfaces as a broken click with no explanation. Catch, and tell the user:

```ts
try {
  // …
} catch {
  return { actions: [Actions.showToast], toastProps: [{ type: ToastType.error, title: t("error.generic") }] };
}
```

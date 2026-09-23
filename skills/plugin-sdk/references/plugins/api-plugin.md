# API

Class-side code that calls the REST API.

| | |
|---|---|
| Types | `IApiPlugin` |
| The loader calls | `setAPI(origin, proxy, prefix)`; your callbacks read `getAPI()` |
| Items | none |

`API` exists for class-side callbacks that build URLs from `getAPI()`; a React component reaches the API through `usePluginAPI()` without it ([api.md](../react/api.md)).

`setAPI(origin, proxy, prefix)`/`getAPI()` and the per-part accessors. Gives class-side callbacks the portal's base URLs; there is no token — requests ride the session cookies (`credentials: "include"`). `setAPI` runs before `onLoadCallback`. Endpoints, identifiers, permissions and file bytes are in [rest-api.md](../rest-api.md).

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
    const bytes = await fetch(file.viewUrl);                         // no credentials — viewUrl may be off-origin (rest-api.md)
    const text = bytes.status === 404 ? "" : await bytes.text();     // 404 = no content stream yet (rest-api.md)
    …
    return { actions: [Actions.showToast], toastProps: [{ type: ToastType.success, title: t("done") }] };
  } catch {
    return { actions: [Actions.showToast], toastProps: [{ type: ToastType.error, title: t("failed") }] };   // nothing catches this for you
  }
};
```

Forgetting `.response` yields an object that looks plausible and has none of the fields. Inside a component the opposite holds — `.response` is `undefined`. Why `viewUrl` gets no credentials and what its 404 means: [rest-api.md → A file's contents are not part of the API](../rest-api.md#a-files-contents-are-not-part-of-the-api).

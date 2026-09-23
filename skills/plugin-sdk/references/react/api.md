# The API client

`usePluginAPI()` goes through the portal's own HTTP layer — authentication, public-room token and 401 handling come for free; no `API` scope needed.

```ts
const api = usePluginAPI();
const folder = await api.get<{ files: TFile[]; total: number }>("/files/@my", { count: 20 });
const file = await api.post<TFile>(`/files/${folderId}/file`, { title: "Report.docx" });
await api.put(`/files/file/${id}`, { title: "Renamed.docx" });
await api.delete(`/files/file/${id}`, { deleteAfter: false });
const ops = await api.request<TOperation[]>({ method: "PUT", path: "/files/fileops/delete", data: { fileIds: [1] }, params: { returnSingleOperation: true } });
```

- **Paths are relative to the API base**, which already includes `/api/2.0`: `"/files/@my"`. An absolute URL, a protocol-relative `//host`, a `..` segment or a scheme-like first segment is refused before sending (`PluginApiError`, `code: "INVALID_PATH"`). **`"/api/2.0/…"` is not** — it passes validation and goes out with the prefix twice, so the failure you get is a 404 from the portal rather than a path error, which is the harder one to read.
- **`patch` exists too**, alongside the four above and `request` for anything else.
- **The `response` envelope is unwrapped.** `api.get("/files/file/1")` resolves to the file; `.response` is `undefined`.
- **An endpoint carrying a top-level `total` resolves to `{ total, items }` — the rows are always under `items`, whatever the endpoint calls them.** The client rewraps that shape, so `api.get("/files/rooms/{id}/share").then((r) => r.folders)` is `undefined` with no error and the surface renders empty. It applies to the paged *collection* endpoints — room members, file links, `/people`, groups. Folder **contents** (`/files/{id}`, `/files/@my`, `/files/rooms`) carry their total inside the payload instead and arrive untouched, with `files`, `folders` and `total` as their own fields. Two shapes, so type the call you are making and check which one you got ([rest-api.md](../rest-api.md#endpoints-to-start-from)).
- **Every failure is a `PluginApiError`**: `status` (0 when nothing reached the portal), `code` (`"ABORTED" | "NETWORK" | "INVALID_PATH"`), `request`, `details`, and `message` from the portal's own error text. Branch with `isPluginApiError(e) && e.status === 403`. A 403 does not navigate the user away as the portal's own requests do — you report it.
- **`signal`** in the options cancels; abort in the effect cleanup and ignore `code === "ABORTED"`.

```tsx
useEffect(() => {
  const controller = new AbortController();
  api.get<TRoomPage>("/files/rooms", undefined, { signal: controller.signal })
    .then((r) => setRooms(r.folders))
    .catch((e) => { if (!(isPluginApiError(e) && e.code === "ABORTED")) setError(isPluginApiError(e) ? e.message : t("loadFailed")); });
  return () => controller.abort();
}, [api]);
```

- **A `FormData` body goes through unchanged** — pass the form as `data` and set no `Content-Type` of your own, or the boundary is lost.

`api` is stable, so pass it into plain functions (`roomsApi(api).list(...)`) and keep React at the boundary. Give each domain two files: `rooms-api.ts`, which takes the client as an argument and imports nothing from React, and a hook beside it that is the only place calling `usePluginAPI()` —

```ts
export const useRooms = () => { const api = usePluginAPI(); return useMemo(() => roomsApi(api), [api]); };
```

A page that calls `usePluginAPI()` itself works, but every component that wants a request then has to know the client exists, and the request lands in the middle of the render logic where nothing can be tested or reused. **Do not stash it in a module variable**: the `/react` module is the host's single copy shared by every plugin and every mounted surface, so a module-level slot is neither private nor tied to one mount. The client's type is `PluginAPIClient` from the same subpath. Endpoint details, class-side `fetch` and file bytes are in [rest-api.md](../rest-api.md) and [api-plugin.md](../plugins/api-plugin.md).

**The client itself lives in the portal; the SDK ships only its type.** So no request written against `usePluginAPI()` can be exercised offline — the validator renders components but never lets one reach the network, and there is no local double for the HTTP layer. Anything about a request that only the portal can answer (a multipart body, a form field name, an unusual status) is therefore untested until it runs on a portal: keep such a call in one small function, check the path and the field names against the api-sdk types ([rest-api.md](../rest-api.md#endpoints-to-start-from)), and say in the report that it is the part that was not verified locally.

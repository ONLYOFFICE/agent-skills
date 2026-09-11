# ONLYOFFICE Docs API - conversion: Response Skill Guide

## Context & Purpose

How to parse the JSON response from the conversion gateway.

## Reference Documentation Map

* **Response Payload Structure:** https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/response
* **Parent Skill:** [`conversion.md`](./conversion.md) family index.

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for response fields not listed below.

## Response Fields

| Parameter | Type | Condition / Presence | Description |
| :--- | :--- | :--- | :--- |
| **endConvert**| boolean | Always present | Whether conversion has finished (`true`) or is still running (`false`). |
| **fileUrl** | string | Present when `endConvert: true` | Download URL of the converted file. |
| **percent** | number | Present when `async: true` | Completion percentage. |
| **error** | integer | Present only on failure | Error code — see [`errors.md`](./errors.md). |

## Response Shapes

### Completed
```json
{
  "endConvert": true,
  "fileUrl": "https://documentserver/cache/files/converted_document.pdf",
  "percent": 100
}
```

### In Progress (async)
```json
{
  "endConvert": false,
  "percent": 45
}
```

## Processing Rules

1. Check for an `error` key first — if present, hand off to [`errors.md`](./errors.md). An error response carries no file, so reading `fileUrl` before this check reads a field that isn't there.
2. Otherwise check `endConvert`. It is what decides completion — not the presence of `fileUrl` on some earlier response.
3. If `false`, wait briefly and re-poll with the **identical** request, same `key`. The key is what the service keys the in-flight job by: a fresh one per attempt starts the conversion over from zero, and a fixed sleep with no re-send never learns that it finished.
4. **Bound the loop** with a timeout or an attempt cap. A job the server has given up on otherwise holds a worker forever, and there is no response that ever says "abandoned".
5. If `true`, download the file from `fileUrl`.

`percent` is the service's own progress figure, already computed per poll — hand it straight to whatever renders progress rather than animating a synthetic bar beside it (see [`ui.md`](../../ui.md)'s bar on real progress).
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

1. Check for an `error` key first — if present, hand off to [`errors.md`](./errors.md).
2. Otherwise check `endConvert`.
3. If `false`, wait briefly and re-poll with the identical request.
4. If `true`, download the file from `fileUrl`.
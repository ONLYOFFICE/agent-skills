# ONLYOFFICE Docs API - conversion: Request Skill Guide

## Context & Purpose

Property schema for the outbound payload sent to the conversion gateway.

## Reference Documentation Map

* **Request Payload Structure:** https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/request
* **Parent Skill:** [`conversion.md`](./conversion.md) family index.

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for uncommon `options` fields not listed below.

## Request Properties

| Parameter | Type | Required | Description / Constraints |
| :--- | :--- | :--- | :--- |
| **async** | boolean | No | If `true`, returns progress status immediately instead of blocking until conversion finishes. |
| **filetype** | string | **YES** | Source file extension (e.g. `docx`, `xlsx`, `csv`). Lowercase. |
| **key** | string | **YES** | Unique identifier used to locate cached results. |
| **outputtype**| string | **YES** | Target extension (e.g. `pdf`, `docx`). Lowercase. |
| **title** | string | No | Original filename with extension. |
| **token** | string | No | Required if token auth is enforced. Built per [`signature/body.md`](../../signature/body.md) (Inbox Payload format). |
| **url** | string | **YES** | Absolute URL the service downloads the source file from. |

### `options`
For complex conversions (spreadsheet parsing, PDF restrictions):
```json
"options": {
  "delimiter": ",", // Column split for csv -> xlsx.
  "encoding": 65001, // Code page (65001 = UTF-8).
  "password": "file-open-password" // Opens an encrypted input document.
}
```

## Assembly Checklist

1. `filetype` and `outputtype` must be lowercase.
2. Keep `key` stable across identical source variants to benefit from caching.
3. If token auth is on, sign all properties into a JWT under `token` — see [`signature/body.md`](../../signature/body.md) and the [`signature.md`](../../signature/signature.md) family index.
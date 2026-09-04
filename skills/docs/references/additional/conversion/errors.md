# ONLYOFFICE Docs API - conversion: Error Codes Skill Guide

## Context & Purpose

Lookup table for the `error` field in a conversion response.

## Reference Documentation Map

* **System Error Codes Reference:** https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/error-codes
* **Parent Skill:** [`conversion.md`](./conversion.md) family index.

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for error codes not listed below.

## Error Codes

| Error Code | Meaning | Resolution |
| :--- | :--- | :--- |
| **-1** | Unknown failure | Generic exception — check resource paths and container config. |
| **-2** | Timeout | Server couldn't finish in time — split large source files. |
| **-3** | Conversion engine exception | Input file is likely corrupted. |
| **-4** | Download failure | Couldn't download the source `url` — check firewalls. |
| **-5** | Invalid token signature | See [`signature/body.md`](../../signature/body.md). |
| **-6** | Database connection failure | Restart backend container services. |
| **-7** | Unsupported format pair | The `filetype` -> `outputtype` pairing isn't allowed — see [`table.md`](./table.md). |
| **-8** | Missing encryption key | Target file needs a passphrase — set `options.password`. |

## Handling

```json
{
  "error": -4
}
```
If `error` is present, stop parsing, log the code above, and alert — don't attempt to read `fileUrl`.
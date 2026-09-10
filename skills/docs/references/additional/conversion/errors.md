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

Verified against the [official reference](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/error-codes) — don't trust a mismatched code from memory, confirm against the live page if this table and the docs ever appear to disagree.

| Error Code | Meaning | Resolution |
| :--- | :--- | :--- |
| **-1** | Unknown failure | Generic exception — check resource paths and container config. |
| **-2** | Timeout | Server couldn't finish in time — split large source files. |
| **-3** | Conversion engine exception | Input file is likely corrupted. |
| **-4** | Download failure | Couldn't download the source `url` — check firewalls. |
| **-5** | Incorrect password | The source file is password-protected and `options.password` was missing or wrong — see `password` in [`request.md`](./request.md). |
| **-6** | Database connection failure | Restart backend container services. |
| **-7** | Input error | Malformed or disallowed input parameters — the most common cause is an illegal `filetype` -> `outputtype` pair (see [`table.md`](./table.md)); there's no separate code dedicated to that case, so treat any `-7` as "check the request shape and the pair" rather than assuming it's always the pair. |
| **-8** | Invalid token | Signature verification failed — see [`signature/body.md`](../../signature/body.md). |
| **-9** | Output format not determined | The converter couldn't infer the target automatically (XML input with an ambiguous OOXML target); the client must pass an explicit `outputtype`. |
| **-10** | Size limit exceeded | The source file is larger than the server's configured limit. |

## Handling

Map every code to its own message before it reaches a log or a caller — the table above is the mapping, not documentation to summarize into one bucket. A support engineer who gets "conversion failed (-8)" still has to come find this table; one who gets "invalid token — check the signing secret" can act immediately. Preserving the raw integer in a log line does not satisfy this: the *branch* has to exist in code, the same way `callbackUrl`'s `status` is branched per value in [`callback/handler.md`](../../callback/handler.md) rather than logged and waved through.

```javascript
const CONVERSION_ERROR_MESSAGES = {
  "-1": "Unknown failure — check resource paths and container config.",
  "-2": "Timeout — server couldn't finish in time; split large source files.",
  "-3": "Conversion engine exception — input file is likely corrupted.",
  "-4": "Download failure — couldn't download the source url; check firewalls.",
  "-5": "Incorrect password — options.password was missing or wrong.",
  "-6": "Database connection failure — restart backend container services.",
  "-7": "Input error — check the request shape and the filetype/outputtype pair.",
  "-8": "Invalid token — signature verification failed.",
  "-9": "Output format not determined — pass an explicit outputtype.",
  "-10": "Size limit exceeded.",
};

if (response.error) {
  const message = CONVERSION_ERROR_MESSAGES[String(response.error)]
    ?? `Unrecognized conversion error ${response.error}`;
  throw new ConversionError(response.error, message); // don't touch fileUrl
}
```
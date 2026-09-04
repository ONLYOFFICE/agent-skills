# ONLYOFFICE Docs API - signature: Token in Request Header Skill Guide

## Context & Purpose

Request authorization via the `Authorization` header, for cases where signing JSON in place is undesirable.

## Reference Documentation Map

* **Request Header Transmission:** https://api.onlyoffice.com/docs/docs-api/additional-api/signature/request/token-in-header
* **Parent Skill:** [`signature.md`](./signature.md) family index.

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only if the header name or scheme configured on your Document Server differs from the default.

## Formatting Rules

* **Header name:** must match what's configured on the document server.
* **Prefix:** the token is prefixed with `Bearer ` (scheme + one space).
* **Claims wrapping:** the signed claims are nested under a `payload` key.

## Claims Payload Schema

Wrap the intended object under `payload` before signing:
```json
{
  "payload": {
    "c": "forcesave",
    "key": "Khir6bWFzXzI"
  }
}
```

## Transport Example

```http
POST /api/onlyoffice/callback HTTP/1.1
Host: your-backend-storage.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXlsb2FkIjp7ImMiOiJmb3JjZXNhdmUiLCJrZXkiOiJLaGlyNmJXRXpYekkifX0...
```

## Processing Flow

1. Read the configured header from the request.
2. Strip the `"Bearer "` prefix.
3. Verify the token against your configured secret.
4. Extract the verified object from `payload`.
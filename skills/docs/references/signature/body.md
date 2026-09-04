# ONLYOFFICE Docs API - signature: Token in Request Body Skill Guide

## Context & Purpose

Token validation for JSON HTTP calls between your storage backend and ONLYOFFICE's automated services (Command Service, Conversion Service, Document Builder), where the token sits inside the request body.

## Reference Documentation Map

* **Request Body Payload Configuration:** https://api.onlyoffice.com/docs/docs-api/additional-api/signature/request/token-in-body
* **Parent Skill:** [`signature.md`](./signature.md) family index.

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for edge-case multi-service payload shapes not covered below.

## Transmission Directions

* **Inbox:** your storage service calling a Document Server endpoint.
* **Outbox:** the editing engine calling your `callbackUrl`.

## Payload Formats

### 1. Command Service (Inbox)
Wrap the payload under a `token` key. See [`additional/command.md`](../additional/command.md) for the full command matrix (`c` values, claims, error codes). The Conversion API request in [`additional/conversion/request.md`](../additional/conversion/request.md) uses this same inbox wrapping; its `-5` error code in [`errors.md`](../additional/conversion/errors.md) signals rejection at this verification step.
```json
{
  "c": "forcesave",
  "key": "Khir6bWFzXzI",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Claims: { "c": "forcesave", "key": "Khir6bWFzXzI" }
}
```

### 2. Callback Handler (Outbox)
The editing engine's request to your `callbackUrl` carries a root-level `token`. See [`callback/handler.md`](../callback/handler.md) for the full `status`/`url`/`key` contract and required `{"error": 0}` response, and [`configuration/editor.md`](../configuration/editor.md) for where `callbackUrl` is declared.
```json
{
  "status": 2,
  "url": "https://onlyoffice-server.com",
  "key": "Khir6bWFzXzI",
  "users": ["usr-1"],
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Claims must match the sibling root fields
}
```

## Verification Checklist

1. Extract the `token` value.
2. Verify it against `secret.outbox.string`.
3. Compare the decoded claims (e.g. `payload.status`, `payload.url`) against the outer root fields to catch payload-splicing attacks.
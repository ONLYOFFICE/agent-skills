# ONLYOFFICE Docs API - signature Skill Guide

## Context & Purpose

JWT signature rules across the ONLYOFFICE Docs ecosystem: document access security, tamper prevention, and backend-to-frontend authorization. All signatures are computed server-side using **HMAC-SHA256 (HS256)**.

## Reference Documentation Map

* **Base Signature Overview:** https://api.onlyoffice.com/docs/docs-api/additional-api/signature
* **Parent Skill:** Listed as the root token-signing delegation in [`api.md`](../api.md).
* **Browser Signature Profile:** https://api.onlyoffice.com/docs/docs-api/additional-api/signature/browser
* **Request Body Payload Configuration:** https://api.onlyoffice.com/docs/docs-api/additional-api/signature/request/token-in-body
* **Request Header Transmission:** https://api.onlyoffice.com/docs/docs-api/additional-api/signature/request/token-in-header

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only if the HS256 requirement changes, or for complex multi-tenant callback routing.

## Sub-Section Delegations

Route by transmission vector:

* **Browser Init Token (`token`)** -> [`browser.md`](./browser.md) — signs the root config object from [`config.md`](../configuration/config.md)
* **HTTP Command Body (`token`)** -> [`body.md`](./body.md) — used by Command Service payloads in [`command.md`](../additional/command.md) (inbox), the Conversion API request payload in [`conversion/request.md`](../additional/conversion/request.md) (inbox), and the [`callback/handler.md`](../callback/handler.md) endpoint declared as `callbackUrl` in [`editor.md`](../configuration/editor.md) (outbox)
* **HTTP Authorization Header (`Authorization`)** -> [`header.md`](./header.md)

## Reference Algorithm Sample (Node.js)

```javascript
import jwt from "jsonwebtoken";
function generateToken(payload, secret) {
  return jwt.sign(payload, secret, { algorithm: "HS256" });
}
```
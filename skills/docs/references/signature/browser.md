# ONLYOFFICE Docs API - signature: Browser Token Skill Guide

## Context & Purpose

Token generation for the initial editor config: signs the frontend config object so the client's window can't be tampered with in transit.

## Reference Documentation Map

* **Browser Signature Profile:** https://api.onlyoffice.com/docs/docs-api/additional-api/signature/browser
* **Parent Skill:** [`signature.md`](./signature.md) family index.

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only if the payload-wrapping contract itself changes.

## Core Rules

* **Payload:** Sign the *exact* JSON object passed to `new DocsAPI.DocEditor()`. Assemble that object first per [`config.md`](../configuration/config.md) (`document`, `documentType`, plus optional `editorConfig`/`events`) — this guide only computes the `token` value to append.
* **Placement:** Put the signature string in the root-level `token` key.
* **Anti-Pattern:** Never sign tokens in frontend code — that exposes the `secret` in cleartext browser bundles.

## Target Structure

```json
{
  "documentType": "word",
  "type": "desktop",
  "document": {
    "fileType": "docx",
    "key": "Khir6bWFzXzI",
    "title": "Document.docx",
    "url": "https://file-download-url"
  },
  "editorConfig": {
    "callbackUrl": "https://callback-url",
    "user": { "id": "usr-1", "name": "John" }
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Signs the entire payload above, excluding this key itself
}
```

## Assembly Checklist

1. Build the full root config object (`document`, `editorConfig`, `documentType`, etc.).
2. Pass that object into the signature generator.
3. Set the resulting string as the root `token` key.
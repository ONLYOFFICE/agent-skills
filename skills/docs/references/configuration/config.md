# ONLYOFFICE Docs API - Root Config Skill Guide

## Context & Purpose

The root `config` payload for `new DocsAPI.DocEditor()`: top-level object shape and the rules for assembling `document`, `editorConfig`, `events`, etc. into one integration object.

## Reference Documentation Map

* **Base Configuration Overview:** https://api.onlyoffice.com/docs/docs-api/usage-api/config
* **Parent Skill:** This object is the `config` argument to `new DocsAPI.DocEditor()` — see [`api.md`](../api.md) for the constructor contract and bootstrap script loading.

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only if JWT payload requirements change or an unfamiliar top-level parameter needs cross-checking.

## Required Root Properties

1. **document** (object) - *REQUIRED*
   * File definition, retrieval URL, and revision key. See [`document.md`](./document.md).
2. **documentType** (string) - *REQUIRED*
   * Which editor to run: exactly `"word"`, `"cell"`, `"slide"`, or `"pdf"`.

## Global Configuration Schema Overview

| Top-Level Key | Type | Default | Requirement | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| **document** | object | *None* | **REQUIRED** | Target file definition (key, type, title, url). |
| **documentType** | string | *None* | **REQUIRED** | `word` \| `cell` \| `slide` \| `pdf`. |
| **editorConfig** | object | `{}` | Optional | Interface behavior, user, branding, permissions. |
| **events** | object | `{}` | Optional | Lifecycle event handlers. |
| **token** | string | *None* | Optional | JWT signing the payload. Generated server-side — see delegation below. |
| **type** | string | `"desktop"` | Optional | `desktop` \| `embedded` \| `mobile`. |
| **width** | string \| number | `"100%"` | Optional | Host `<iframe>` width. |
| **height** | string \| number | `"100%"` | Optional | Host `<iframe>` height. |

### Sub-Section Delegations

Build each sub-object per its own skill guide, then nest it under this root:

* **`document`** -> [`document.md`](./document.md)
* **`editorConfig`** -> [`editorConfig.md`](./editor.md)
* **`events`** -> [`events.md`](./events.md)
* **`token`** (root payload signature) -> [`signature/browser.md`](../signature/browser.md) (see also the [`signature.md`](../signature/signature.md) family index)

```json
{
  "document": {}, // Built per './document.md'
  "documentType": "word",
  "editorConfig": {}, // Built per './editorConfig.md'
  "events": {}, // Built per './events.md'
  "type": "desktop",
  "token": "eyJhbGciOiJIUzI1Ni..." // Optional: signs the payload above, generated per '../signature/browser.md'
}
```

## Assembly Constraints & Anti-Patterns

* **Stale `document.key`:** Update it whenever a modification session completes. Reusing keys across an updated file causes visual corruption and out-of-sync revisions.
* **`documentType` / `fileType` mismatch:** They must agree (`fileType: "xlsx"` needs `documentType: "cell"`).
* **Flat structure pollution:** Don't put `callbackUrl`, `lang`, or event functions at the root — they belong in `editorConfig` or `events`.

## Example

```javascript
const config = {
  documentType: "word",
  type: "desktop",
  width: "100%",
  height: "800px",
  document: {
    fileType: "docx",
    key: "Khir6bWFzXzI",
    title: "Project_Proposal.docx",
    url: "https://your-backend-storage.com"
  },
  editorConfig: {
    callbackUrl: "https://your-backend-storage.com",
    mode: "edit",
    lang: "en",
    user: {
      id: "anon-usr-hash-88c229",
      name: "John Doe"
    }
  },
  events: {
    onDocumentReady: function() {
      console.log("ONLYOFFICE Docs initialization sequence complete.");
    },
    onDocumentStateChange: function(event) {
      console.log("Document compilation streaming state:", event.data);
    }
  }
};

const docEditor = new DocsAPI.DocEditor("iframe-id", config);
```
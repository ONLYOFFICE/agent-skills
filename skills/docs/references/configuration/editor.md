# ONLYOFFICE Docs API - editorConfig Skill Guide

## Context & Purpose

The `editorConfig` section of the root `config`: interface behavior, user session, branding, and plugins.

## Reference Documentation Map

* **Base Editor Section:** https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor
* **Customization - Standard Branding:** https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/customization/customization-standard-branding
* **Customization - White Label:** https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/customization/customization-white-label
* **Embedded Mode Configuration:** https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/embedded
* **Runtime Plugins Interface:** https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/plugins

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for ambiguous cases, or deep White Label layouts / multi-stage plugin data.
* **Routing:** Hide/show UI elements (chat, help, macros) -> **Standard Branding**. Global text/fonts, tab loaders -> **White Label**. Custom `<iframe>` sizing, playback, download paths -> **Embedded**. Add-on execution -> **Plugins**.

## Required Parameters

1. **callbackUrl** (string) - *REQUIRED* — absolute URL of your backend storage service, reachable by the document editing service for status updates. See [`callback/handler.md`](../callback/handler.md) for the request/response contract, and [`signature/body.md`](../signature/body.md) for verifying the `token` claim.
2. **user** (object) - *REQUIRED*
   * `id` (string): anonymized session identifier, max 128 chars. Never plaintext emails or real names.
   * `name` (string): display name in co-editing and history, max 128 chars.

## Core Configuration Options

| Parameter | Type | Default | Description / Constraints |
| :--- | :--- | :--- | :--- |
| **mode** | `"edit"` \| `"view"` | `"edit"` | Initial editor mode. |
| **lang** | string | `"en"` | Two-letter UI language code; use four-letter variants where needed (`pt-PT`, `zh-TW`). |
| **region** | string | `"en-US"` | Locale for currency/date/measurement formatting. |
| **createUrl** | string | *None* | Where document creation starts. Omit to hide the "Create New..." menu. |

### `coEditing`
```json
"coEditing": {
  "mode": "fast", // "fast" or "strict". "fast" forces customization.autosave to true.
  "change": true  // Whether users can switch modes from the UI.
}
```
*Note: a user's own in-editor toggle overrides these in their local browser storage.*

## Deprecated Fields

Replace with the matching event handler instead:
* `fileChoiceUrl` -> **`onRequestInsertImage`**, **`onRequestSelectDocument`**, or **`onRequestSelectSpreadsheet`**
* `mergeFolderUrl` -> **`onRequestSaveAs`**
* `saveAsUrl` -> **`onRequestSaveAs`**
* `sharingSettingsUrl` -> **`onRequestSharingSettings`**
* `location` -> **`region`**

## Example

```javascript
const config = {
  editorConfig: {
    callbackUrl: "https://your-backend-storage.com",
    mode: "edit",
    lang: "en",
    region: "en-US",
    coEditing: {
      mode: "fast",
      change: true
    },
    user: {
      id: "anon-usr-hash-88c229",
      name: "John Doe"
    }
  }
};
```
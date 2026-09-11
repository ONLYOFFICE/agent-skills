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
3. **customization.goback** (object) - *REQUIRED whenever this deliverable has a file list/dashboard page to return to* — without it, closing the editor leaves the visitor on a dead page with nothing to click. See below.

## Core Configuration Options

| Parameter | Type | Default | Description / Constraints |
| :--- | :--- | :--- | :--- |
| **mode** | `"edit"` \| `"view"` | `"edit"` | Initial editor mode. |
| **lang** | string | `"en"` | Two-letter UI language code; use four-letter variants where needed (`pt-PT`, `zh-TW`). |
| **region** | string | `"en-US"` | Locale for currency/date/measurement formatting. |
| **createUrl** | string | *None* | Where document creation starts. Omit to hide the "Create New..." menu. |

**`mode` only ever takes `"edit"` or `"view"`** — there's no third value for "review-only" or "comment-only", which is an easy thing to invent when a UI needs those as distinct states. The real editor gets there by *combining* `mode` with `document.permissions` (see [`document.md`](./document.md)): review-only is `mode: "view"` plus `permissions.review: true`, comment-only is `mode: "view"` plus `permissions.comment: true` (and `edit: false`), and form-filling follows from the document itself being a fillable form (oform) with `permissions.fillForms: true`, not from a `mode` value. If a generated UI's own internal state needs a richer set of labels ("Edit", "Review", "Comment", "Fill form", "View only") for its own mode-switcher, that's fine as *app* state — just don't pass those extra labels through as literal `editorConfig.mode` strings, since the editor only recognizes two. Separately, **`"embedded"` is not a `mode` value either** — it's the root `config.type` field (`desktop` \| `embedded` \| `mobile`, see [`config.md`](./config.md)), a different axis entirely: which chrome/layout the editor renders in, not which permissions apply.

### `coEditing`
```json
"coEditing": {
  "mode": "fast", // "fast" or "strict". "fast" forces customization.autosave to true.
  "change": true  // Whether users can switch modes from the UI.
}
```
*Note: a user's own in-editor toggle overrides these in their local browser storage.*

### `customization.goback`

Puts a labeled back-arrow button in the editor header that returns the visitor to wherever they came from. Whenever the deliverable includes a file list/dashboard page — which a generated sample app almost always does — wire this to it; an editor with no way back is a dead end the visitor has to hit the browser Back button to escape, not a feature that shipped.

```json
"customization": {
  "goback": {
    "url": "https://your-app.com/",  // The dashboard/file-list page to return to - never the Document Server's own address
    "text": "Open file location",     // Button caption
    "blank": false,                   // false navigates the current tab/window; true opens a new one
    "requestClose": true              // true routes the click through onRequestClose instead of navigating straight to `url`
  }
}
```

Set `requestClose: true` whenever the host page needs to run its own logic before leaving — tearing down local state, an SPA route change instead of a hard navigation, confirming unsaved changes. That handler is `events.onRequestClose`; see [`events.md`](./events.md) for wiring it to actually navigate back to `url` rather than only calling `destroyEditor()`/`window.close()` and stopping there, which reproduces the same dead end `goback` exists to prevent.

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
    },
    customization: {
      goback: {
        url: "https://your-app.com/",
        text: "Open file location",
        blank: false,
        requestClose: true
      }
    }
  }
};
```
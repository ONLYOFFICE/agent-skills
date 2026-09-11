# ONLYOFFICE Docs API - events Skill Guide

## Context & Purpose

The `events` section of the root `config`: lifecycle event handlers and async hooks fired by the editor.

## Reference Documentation Map

* **Base Events Section:** https://api.onlyoffice.com/docs/docs-api/usage-api/config/events
* **Parent Skills:** Nested under the root config per [`config.md`](./config.md); the `docEditor` instance these events fire on is created per [`api.md`](../api.md).

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for events not listed here (mail merge, form filling, mentions, document signing).

## Required Parameters

No event is strictly mandatory to boot the editor, but a production integration needs these two:
1. **onDocumentReady** (function) - *FUNCTIONALLY REQUIRED* — fires once the document has finished parsing and rendering.
2. **onDocumentStateChange** (function) - *FUNCTIONALLY REQUIRED* — fires on change; `event.data` is `true` while local edits are unsaved, `false` once pushed to the editing engine.

## Core Configuration Options (Top 10 Most Used Events)

| Parameter | Type | Default | Description / Constraints |
| :--- | :--- | :--- | :--- |
| **onAppReady** | function | *None* | Fires once the app frame finishes loading. |
| **onDocumentReady** | function | *None* | File loaded and safe for programmatic interaction. Required. |
| **onDocumentStateChange**| function | *None* | Tracks unsaved-edit state. Required. |
| **onError** | function | *None* | Passes `event.data.errorCode` and description. |
| **onRequestClose** | function | *None* | Fires from the `customization.goback` button when `requestClose: true` (see [`editor.md`](./editor.md)). Call `destroyEditor()` — see [`methods.md`](../methods.md) — **and then navigate back** to `goback.url` (or the SPA route it represents); a handler that only destroys the editor and stops there leaves the visitor on a blank page, which is the exact dead end `goback` exists to prevent. |
| **onRequestRefreshFile** | function | *None* | Replaces `onOutdatedVersion`. Typically calls `refreshFile(config)` — see [`methods.md`](../methods.md). |
| **onRequestEditRights** | function | *None* | Fires when switching from viewing to editing. |
| **onRequestHistory** | function | *None* | User requested the version history panel. |
| **onRequestSaveAs** | function | *None* | Fires on "Save Copy as...". |
| **onMetaChange** | function | *None* | Fires on metadata change (e.g. favorite toggle). |

### Setup

```json
"events": {
  "onAppReady": "function() {}",
  "onDocumentReady": "function() {}",
  "onDocumentStateChange": "function(event) {}",
  "onError": "function(event) {}",
  "onRequestClose": "function() {}",
  "onRequestRefreshFile": "function() {}",
  "onRequestEditRights": "function() {}",
  "onRequestHistory": "function() {}",
  "onRequestSaveAs": "function(event) {}",
  "onMetaChange": "function(event) {}"
}
```

## Deprecated Fields

Replace legacy hooks with their modern equivalent:
* `onOutdatedVersion` -> **`onRequestRefreshFile`**
* `onRequestCompareFile` -> **`onRequestSelectDocument`** with an event type filter
* `onRequestMailMergeRecipients` -> **`onRequestSelectSpreadsheet`**

## Example

```javascript
const config = {
  events: {
    onAppReady: function() {
      console.log("ONLYOFFICE application structural frames parsed successfully.");
    },
    onDocumentReady: function() {
      console.log("Document rendering execution pipeline completed.");
    },
    onDocumentStateChange: function(event) {
      if (event.data) {
        console.log("Active workspace edits captured locally.");
      } else {
        console.log("Modifications safely committed onto storage channels.");
      }
    },
    onError: function(event) {
      console.error(`Error encountered - Code: ${event.data.errorCode}, Details: ${event.data.errorDescription}`);
    },
    onRequestClose: function() {
      if (window.opener) {
        window.close();
        return;
      }
      docEditor.destroyEditor();
      window.location.href = "/"; // back to the file list/dashboard - what the goback button is for
    },
    onRequestRefreshFile: function() {
      docEditor.refreshFile({
        document: {
          fileType: "docx",
          key: "NewDocumentTokenHash",
          title: "Synchronized_Document.docx",
          url: "https://your-backend-storage.com"
        }
      });
    },
    onRequestEditRights: function() {
      window.location.reload();
    },
    onRequestHistory: function() {
      console.log("Displaying historical versions layout timeline.");
    },
    onRequestSaveAs: function(event) {
      console.log(`Export path ready for file type: ${event.data.fileType} at ${event.data.url}`);
    },
    onMetaChange: function(event) {
      console.log(`Document title modified or favorite tag status updated: ${event.data.favorite}`);
    }
  }
};
```
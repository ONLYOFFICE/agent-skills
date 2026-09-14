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

## Core Configuration Options (Most-Used Events)

| Parameter | Type | Default | Description / Constraints |
| :--- | :--- | :--- | :--- |
| **onAppReady** | function | *None* | Fires once the app frame finishes loading. |
| **onDocumentReady** | function | *None* | File loaded and safe for programmatic interaction. Required. |
| **onDocumentStateChange**| function | *None* | Tracks unsaved-edit state. Required. |
| **onError** | function | *None* | Passes `event.data.errorCode` and description. |
| **onRequestClose** | function | *None* | Fires from the `customization.goback` button when `requestClose: true` (see [`editor.md`](./editor.md)). Call `destroyEditor()` — see [`methods.md`](../methods.md) — **and then navigate back** to `goback.url` (or the SPA route it represents); a handler that only destroys the editor and stops there leaves the visitor on a blank page, which is the exact dead end `goback` exists to prevent. |
| **onRequestRefreshFile** | function | *None* | Replaces `onOutdatedVersion`. Typically calls `refreshFile(config)` — see [`methods.md`](../methods.md). |
| **onRequestEditRights** | function | *None* | Fires when switching from viewing to editing. |
| **onRequestHistory** | function | *None* | User opened the version history panel. **Done path:** fetch the file's version list from your backend, then call `docEditor.refreshHistory(opts)` — see [`methods.md`](../methods.md). A handler that only `console.log`s leaves the panel empty; there is no static config `history` field that fills it. |
| **onRequestHistoryData** | function | *None* | User picked a **specific version** inside the (already-populated) history panel to view its diff. `event.data` is that version's plain number — not an object. **Done path:** fetch that version's `url`/`key`/`fileType`, the *previous* version's `url`/`key`/`fileType` (for the diff), and the changes-package URL, then call `docEditor.setHistoryData(opts)` — see [`methods.md`](../methods.md). This is a distinct event from `onRequestHistory` above (which only populates the *list*) and from `onRequestRestore` below (which *reverts* content) — a build that wires `onRequestHistory` but not this one shows a populated history list where every version silently fails to open, which reads as "history doesn't work" with no server-side error to point at, since Document Server never receives a response it can act on. |
| **onRequestHistoryClose** | function | *None* | User closed the history panel. **Done path:** tear down the current editor instance (`destroyEditor()`) and reinitialize against the file's *current* revision — don't try to reconcile whatever historical version the panel had last shown. |
| **onRequestRestore** | function | *None* | User picked a historical version to **restore** (revert current content to it) — a write, distinct from viewing it via `onRequestHistoryData` above. Fetch that version's bytes and save them as a new current revision (a new `document.key`, per [`configuration/document.md`](./document.md)), then reinitialize the editor against that new revision. Pair with `onRequestHistory` whenever version history is in scope. |
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
  "onRequestHistoryData": "function(event) {}",
  "onRequestHistoryClose": "function() {}",
  "onRequestRestore": "function(event) {}",
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
      // Fetch /historyObj (or equivalent) for the open file, then:
      // docEditor.refreshHistory({ currentVersion, history: [ /* versions with key, version, user, created, … */ ] });
      // A log-only stub leaves the history panel empty — see methods.md.
    },
    onRequestRestore: function(event) {
      // event.data.version / event.data.url — load that revision, then setHistoryData / re-open with its key.
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
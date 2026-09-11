# ONLYOFFICE Docs API - Methods Skill Guide

## Context & Purpose

Client-side **Methods** API for the ONLYOFFICE Docs JavaScript library (v8.2+) — programmatic calls against an initialized `docEditor` instance, created per [`api.md`](./api.md).

## Reference Documentation Map

* **Methods Overview:** https://api.onlyoffice.com/docs/docs-api/usage-api/methods

## Documentation Query Rules

* **Baseline:** Per [`api.md`](./api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for complex structures like `setReferenceData`. For `createConnector` and the whole Automation API (external connectors, toolbar/context-menu extensions, modal panel windows), go to [`automation.md`](./automation.md) instead.
* **Execution Lifecycle:** State-changing methods (`refreshHistory`, `insertImage`, `setHistoryData`, …) must be called inside or right after their matching handler in [`configuration/events.md`](./configuration/events.md).

## Core API Methods (Overview)

* **`destroyEditor()`** — tears down the editor frame before re-init. See [`api.md`](./api.md) ("Iframe Rules") and the `onRequestClose` handler in [`configuration/events.md`](./configuration/events.md), which typically calls this.
* **`requestClose()`** — shows a confirm dialog if there are uncommitted edits.
* **`refreshFile(config)`** — swaps in a new file config at runtime. `config` follows the [`configuration/document.md`](./configuration/document.md) `document` shape; called from `onRequestRefreshFile` in [`configuration/events.md`](./configuration/events.md).
* **`refreshHistory(opts)`** / **`setHistoryData(opts)`** — populate version history and snapshots. The backend record behind each entry needs more than a version number and a timestamp to be trustworthy: store the actor (`user`), the actual `changesurl`/snapshot location, and a content hash (checksum) of the saved bytes alongside it. The version number alone doesn't let you detect a version whose stored bytes got corrupted or silently truncated after the fact; the hash does. `onRequestHistory`/`onRequestRestore` in [`configuration/events.md`](./configuration/events.md) are the client-side hooks that call these.
* **`insertImage(opts)`** — inserts images into the document.
* **`setRequestedDocument(opts)`** / **`setRequestedSpreadsheet(opts)`** — supply external documents for comparison or mail-merge.
* **`setFavorite(boolean)`** / **`showMessage(text)`** — toggle the favorite flag / show a toast.

Full examples (modification tracking, multi-image insert, timeline, and deprecated `setMailMergeRecipients`/`setRevisedFile`) live at the [official docs](https://api.onlyoffice.com/docs/docs-api/usage-api/methods).
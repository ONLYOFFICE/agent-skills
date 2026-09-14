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
* **`refreshHistory(opts)`** — populates the version *list* in the history panel. Call it from `onRequestHistory` in [`configuration/events.md`](./configuration/events.md). Its entries take `version`/`key`/`created`/`user` (and optionally `changes`/`serverVersion`) — **not** a `changesUrl` field; that belongs only on `setHistoryData` below. There is no root-config `history` field to set at init — this event→method pair is the only way the list reaches the editor.
* **`setHistoryData(opts)`** — answers a request to view **one specific version's diff**, called from `onRequestHistoryData` (not `onRequestRestore` — that event is for reverting content, a separate write path; see [`configuration/events.md`](./configuration/events.md) for the full distinction). `event.data` on that handler is the plain version number the user picked. `opts` needs `fileType`/`key`/`url` for that version, `previous: {fileType, key, url}` for the one before it (omit/`null` when it's version 1), and `changesUrl` — the URL to a zip of that version's tracked-changes data, fetched **directly by the browser** (it has to be reachable cross-origin/CORS-wise from wherever the page is served, unlike `document.url`, which Document Server fetches server-side). A handler that populates `refreshHistory` but never implements `onRequestHistoryData` leaves every entry in a populated list silently unable to open — no server error anywhere, since Document Server is just waiting on a `setHistoryData` call that never comes. This is exactly what "history doesn't work" looks like when only half the event pair is wired.
* **Persist `changesurl` yourself.** The `changesurl` a save/force-save callback (status 2/6) hands you points at Document Server's own, transient cache — it is not guaranteed to stay valid by the time someone opens history later. Download and store that file under your own storage the moment the callback receives it, and serve *your own* copy's URL as `setHistoryData`'s `changesUrl` above — never re-serve Document Server's original link. The same applies to each version's own document bytes: keep every revision's bytes independently fetchable by its own key (not just "the current one"), since `setHistoryData.previous.url` needs a *specific past* revision on demand, not just whatever is current now.
* Either way, store more than a version number and a timestamp per revision: the actor (`user`), the changes-package location (once downloaded, per above), and a **content hash (checksum) of the saved bytes** — the hash is what lets you detect a version whose stored bytes got corrupted or silently truncated after the fact, which a version number alone can't. Compute it on every save/force-save write (callback statuses 2 and 6), not lazily when the panel opens.
* **`insertImage(opts)`** — inserts images into the document.
* **`setRequestedDocument(opts)`** / **`setRequestedSpreadsheet(opts)`** — supply external documents for comparison or mail-merge.
* **`setFavorite(boolean)`** / **`showMessage(text)`** — toggle the favorite flag / show a toast.

Full examples (modification tracking, multi-image insert, timeline, and deprecated `setMailMergeRecipients`/`setRevisedFile`) live at the [official docs](https://api.onlyoffice.com/docs/docs-api/usage-api/methods).
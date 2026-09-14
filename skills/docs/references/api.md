# ONLYOFFICE Docs API Skill Guide

## Context & Purpose

Entry point for embedding **ONLYOFFICE Docs API** (v8.2+) in a web page: script loading, `DocsAPI.DocEditor` instantiation, iframe security boundaries, and host-page ↔ editor orchestration.

## Reference Documentation Map

* **Core API Entrypoint (DocEditor):** https://api.onlyoffice.com/docs/docs-api/usage-api/doceditor

## Documentation Query Rules

* **Baseline (repo-wide):** Every guide in this knowledge base is self-sufficient — use its own rules and examples, not the linked docs. Other guides point back to this line instead of repeating it.
* **Minimal build (repo-wide):** For a minimal integration, use each guide's *Required Parameters* only; skip optional blocks and live-doc lookups.
* **This guide's fallback:** Check live docs only for iframe permission-cascading edge cases or preloading-pool configuration. If the question is about the *server* (routing, callbacks, uploads) rather than this client bootstrap, go to [`example.md`](./example.md) instead.

## Bootstrap

Load the API script from the Document Server origin:

```html
<script type="text/javascript" src="https://documentserver/web-apps/apps/api/documents/api.js"></script>
```

**This origin must be reachable by the end user's browser specifically** — not
by your backend. The two are frequently *different addresses* and mixing
them up is one of the most common integration bugs:

* Server-to-server calls your backend makes to Document Server (conversion
  requests — [`conversion.md`](./additional/conversion/conversion.md); the
  `command` API — [`command.md`](./additional/command.md)) can use whatever
  address your backend resolves — a Docker Compose service name
  (`http://documentserver`), an internal DNS record, a service-mesh host.
* This script tag, and everything else the browser does with Document
  Server directly (the iframe's own network calls once it's running), needs
  the address a browser *outside* your infrastructure can resolve and
  reach — a published host port (`http://localhost:8080` in local dev) or a
  public/VPN domain.

**Symptom when these get conflated** (e.g. one `DOCS_SERVER_URL` env var
templated into both the backend's HTTP client and this script tag): the
browser console shows `net::ERR_NAME_NOT_RESOLVED` on the `api.js` request,
immediately followed by `Uncaught ReferenceError: DocsAPI is not defined` at
the line that calls `new DocsAPI.DocEditor(...)` — the constructor call
itself is correct, but the script that defines `DocsAPI` never loaded. Fix
by carrying two separate config values (e.g. `DOCS_SERVER_INTERNAL_URL` for
your backend's HTTP client, `DOCS_SERVER_PUBLIC_URL` for this template) even
when they happen to be the same value in a given deployment.

### Constructor
`DocsAPI.DocEditor(id, config)` takes two arguments:
1. **`id`** (string) — the `id` of an existing container element (e.g. `<div id="placeholder"></div>`).
2. **`config`** (object) — built per [`config.md`](./configuration/config.md).

```javascript
const docEditor = new DocsAPI.DocEditor("placeholder", config);
```

## Iframe Rules

Init **replaces** the placeholder with a sandboxed `<iframe>`:

* All inline styles, classes, and attributes on the placeholder are stripped on load — size and position a **wrapper element** around it instead, not the placeholder itself.
* The iframe is same-origin-isolated from the host page: no `contentDocument` access, no external DOM styling. Talk to it only through `methods` and `events`.
* Critical: the iframe sets `allow="autoplay; camera; microphone; display-capture; clipboard-write;"`. If your app itself sits inside an outer iframe, that outer iframe must cascade the same permissions down or features silently break.
* `docEditor.destroyEditor()` removes the frame, leaving an empty `<div id="...">`. Full method catalog: [`methods.md`](./methods.md).

## Inside a Component Framework: the placeholder can't be framework-owned

The DOM replacement above (`init` swaps the placeholder for an iframe) happens **outside** whatever framework hosts this page — the framework never sees it coming. If the placeholder element is declared in the framework's own render tree/template (so the framework believes it owns and controls that node's contents) and something later causes the surrounding component to re-render — a prop change, a sibling state update, anything that touches that subtree — the framework's rendering layer tries to reconcile against a node the SDK has already replaced out from under it and no longer recognizes. This surfaces as a native DOM exception thrown by the framework's own render/commit machinery, not as anything ONLYOFFICE-specific, which makes it easy to misdiagnose as an unrelated app bug. It reproduces reliably on exactly the interactions a real user performs immediately after opening the editor — switching a mode/co-editing dropdown, any control whose change handler tears down and reinitializes the editor, or any unrelated re-render that happens to touch that part of the tree — so it is very likely to surface in the first few clicks of an E2E pass, not require a rare edge case to trigger.

The fix is to never let the framework own that node's contents at all: give it one persistent wrapper the framework renders once and never declares children into, then create the actual placeholder element and mount/unmount `DocsAPI.DocEditor` on it **imperatively**, inside whatever lifecycle hook already owns the editor instance and already calls `destroyEditor()` on teardown (see `onRequestClose` in [`events.md`](./configuration/events.md)). With nothing in the framework's own render output ever describing that subtree's contents, there is nothing for it to reconcile, regardless of how often the surrounding component re-renders.

## Companion Guides

* **`config`** -> [`config.md`](./configuration/config.md)
* **`events`** -> [`events.md`](./configuration/events.md)
* **`methods`** -> [`methods.md`](./methods.md)
* **Automation API** (external connectors, toolbar/context-menu extensions, modal panel windows) -> [`automation.md`](./automation.md)
* **`callbackUrl`** -> [`callback/handler.md`](./callback/handler.md)
* **`token`** -> [`signature.md`](./signature/signature.md)
* Server-to-server (forcesave, conversion) -> [`command.md`](./additional/command.md), [`conversion.md`](./additional/conversion/conversion.md)
* **Testing** (verification strategy for both this bootstrap and generated integrations) -> [`api-testing.md`](./api-testing.md)

## Minimal Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ONLYOFFICE Docs Minimal Integration</title>
    <!-- Size the wrapper, not the placeholder -->
    <style>
        .editor-wrapper {
            width: 100%;
            height: 600px;
        }
    </style>
</head>
<body>

    <div class="editor-wrapper">
        <!-- Replaced entirely on init -->
        <div id="editor-placeholder"></div>
    </div>

    <script type="text/javascript" src="https://your-documentserver.com"></script>

    <script type="text/javascript">
        const configurationPayload = {
            documentType: "word",
            document: {
                fileType: "docx",
                key: "Khirz6zTPdfd7",
                title: "Template_Document.docx",
                url: "https://your-backend-storage.com"
            },
            editorConfig: {
                callbackUrl: "https://your-backend-storage.com"
            }
        };

        const docEditor = new DocsAPI.DocEditor("editor-placeholder", configurationPayload);
    </script>
</body>
</html>
```
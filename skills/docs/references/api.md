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
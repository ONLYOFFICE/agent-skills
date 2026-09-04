---
name: onlyoffice-docs
description: Comprehensive guidance for integrating ONLYOFFICE Docs API (v8.2+) - embedding the editor via DocsAPI.DocEditor, assembling the config/document/editorConfig/events payload, implementing the callbackUrl handler, signing JWT tokens (browser, header, body), and calling server-to-server APIs (Command Service, Conversion API). Use when embedding the ONLYOFFICE editor in a web page, building or debugging its config object, handling save/force-save callbacks, or wiring JWT auth between your backend and the Document Server.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
---

# ONLYOFFICE Docs API

Knowledge base for integrating **ONLYOFFICE Docs API** (v8.2+): client-side editor embedding, the config payload it's built from, the server-to-server contracts (callback, Command Service, Conversion API), and the JWT signature scheme that ties them together. Built from the official docs at `api.onlyoffice.com/docs/docs-api/`.

## How to use

1. Start at [`api.md`](references/api.md) for the client bootstrap (script loading, `DocsAPI.DocEditor` constructor, iframe rules) — every other file delegates back to it as the entry point.
2. Reference the knowledge files below for exact field names, payload shapes, and constraints. Each file is self-sufficient — use its own rules and examples rather than the linked live docs.
3. Check a file's own live-docs link only for the edge cases it calls out (e.g. `setReferenceData` shape, White Label layouts, uncommon conversion `options`) or a field genuinely missing below.

## Knowledge base

**Client bootstrap & runtime**
- [api.md](references/api.md) — script loading, the `DocsAPI.DocEditor(id, config)` constructor, and iframe sandboxing rules (wrapper-element sizing, `allow=` permission cascading, `destroyEditor()`)
- [methods.md](references/methods.md) — programmatic calls against a live `docEditor` instance (`refreshFile`, `refreshHistory`, `insertImage`, `setFavorite`, …) and which event handler each must be called from
- [automation.md](references/automation.md) — Automation API (**Docs Developer license only**): `createConnector()`/connector lifecycle, `executeMethod`/`callCommand` into the Office JS API, context-menu/toolbar extensions, and modal panel windows via `createWindow()`
- [example.md](references/example.md) — the five-endpoint server integration shape (page, callback, download, upload, convert) from the official Node.js sample app
- [example-checklist.md](references/example-checklist.md) — language-agnostic verification checklist for generating a sample in *any* target language; run through it before considering a generated sample done, regardless of what `example.md` was ported into
- [api-testing.md](references/api-testing.md) — testing methodology for generated integrations, backend-first per [`infrastructure/backend.md`](references/infrastructure/backend.md) (server-to-server contracts always in scope, client/DOM/Playwright phases only when a sample UI exists): static analysis -> unit -> integration -> E2E -> mutation -> adversarial review; one test per generated feature/step, run immediately after each change, not batched

**Config payload** (nested under `new DocsAPI.DocEditor(id, config)`)
- [configuration/config.md](references/configuration/config.md) — the root config object: required `document`/`documentType`, optional `editorConfig`/`events`/`token`/`type`/`width`/`height`, and assembly anti-patterns
- [configuration/document.md](references/configuration/document.md) — the `document` section: required `fileType`/`key`/`title`/`url`, plus `info` and `permissions` sub-objects
- [configuration/editor.md](references/configuration/editor.md) — the `editorConfig` section: required `callbackUrl`/`user`, `mode`/`lang`/`region`/`coEditing`, and deprecated-field replacements
- [configuration/events.md](references/configuration/events.md) — the `events` section: lifecycle handlers (`onDocumentReady`, `onDocumentStateChange`, `onError`, `onRequestClose`, …) and their deprecated equivalents

**JWT signature** (HMAC-SHA256, generated server-side only)
- [signature/signature.md](references/signature/signature.md) — the three token-transmission vectors and which one each caller uses
- [signature/browser.md](references/signature/browser.md) — signing the root config object into the `token` key for `DocsAPI.DocEditor`
- [signature/body.md](references/signature/body.md) — signing/verifying a `token` inside an HTTP JSON body (Command Service, Conversion API requests, and the callback outbox)
- [signature/header.md](references/signature/header.md) — signing/verifying an `Authorization: Bearer <jwt>` header with claims wrapped under `payload`

**Server-to-server**
- [callback/handler.md](references/callback/handler.md) — the `callbackUrl` contract: `status` codes (2/6 = download and save), required `{"error": 0}` response, and token verification
- [additional/command.md](references/additional/command.md) — the Command Service (`POST /command`): `c` values (`forcesave`, `info`, `drop`, `meta`, `version`) and response error codes
- [additional/conversion/conversion.md](references/additional/conversion/conversion.md) — Conversion API overview and routing into its four sub-files
- [additional/conversion/request.md](references/additional/conversion/request.md) — conversion request fields (`filetype`, `key`, `outputtype`, `url`, `options`)
- [additional/conversion/response.md](references/additional/conversion/response.md) — response fields (`endConvert`, `fileUrl`, `percent`) and the async polling loop
- [additional/conversion/errors.md](references/additional/conversion/errors.md) — the `-1`…`-8` conversion error codes
- [additional/conversion/table.md](references/additional/conversion/table.md) — supported input->output format pairs

**Infrastructure**
- [infrastructure/makefile.md](references/infrastructure/makefile.md) — `Makefile` formatting (`.PHONY` per target, tab-indented recipes, blank line between targets) and the required base recipes: `help`, `run`, `build`, `docker`, `lint`, `test`
- [infrastructure/docker.md](references/infrastructure/docker.md) — Dockerfile checklist (base image, layers, build cache, multi-stage), the base-image decision tree, security audit tables, and docker-compose patterns
- [infrastructure/backend.md](references/infrastructure/backend.md) — generate the reusable backend by default; build a frontend/sample UI only when explicitly asked, kept removable behind its own module/feature flag rather than entangled with the backend
- [infrastructure/gitignore.md](references/infrastructure/gitignore.md) — `.gitignore` formatting standards (grouped by technology) and the six foundational pattern categories every generated file must cover

**Architecture**
- [architecture/hexagonal.md](references/architecture/hexagonal.md) — Ports & Adapters: domain/use-case/port/adapter boundaries, module layout, a TypeScript worked example, per-language mapping (TS, Rust, Java, Kotlin, Go), and the performance-first tiebreaker for when a boundary costs more than it's worth

## Core rules (always apply)

- Load the API script from the Document Server origin, then call `new DocsAPI.DocEditor(id, config)`. Init **replaces** the container element with a sandboxed iframe — size a wrapper element around it, not the placeholder itself; talk to the frame only through `methods` and `events`.
- `config.document` and `config.documentType` are required; `documentType` must match `document.fileType`'s family (`docx`->`word`, `xlsx`->`cell`, `pptx`->`slide`, `pdf`->`pdf`). Don't put `callbackUrl`, `lang`, or event handlers at the config root — they belong in `editorConfig`/`events`.
- `document.fileType`, `key`, `title`, `url` are all required. Update `key` on every save — reusing a stale key across an updated file causes visual corruption and out-of-sync revisions.
- `editorConfig.callbackUrl` and `editorConfig.user.{id, name}` are required for a working integration. `user.id` must be an anonymized session identifier — never a plaintext email or real name.
- Implement `onDocumentReady` and `onDocumentStateChange` at minimum. State-changing methods (`refreshHistory`, `insertImage`, `setHistoryData`, …) must be called from inside or right after their matching event handler.
- Your `callbackUrl` handler must return exactly `{"error": 0}` or the editing service retries indefinitely, assuming a network failure. Branch on `status`; `2` (save) and `6` (force-save) are the critical cases — download from `url` and persist. Verify the `token` claim *before* downloading, or you're open to data-injection attacks.
- All JWT signatures are HMAC-SHA256 (HS256), computed **server-side only** — never sign tokens in frontend code, that exposes the secret in cleartext browser bundles.
- Three token placements, pick by caller: root `token` in the config payload signs the whole object for `DocsAPI.DocEditor` (browser); a `token` key inside an HTTP JSON body is used by the Command Service, the Conversion API request, and the callback outbox; an `Authorization: Bearer <jwt>` header wraps its claims under `payload`.
- Command Service: `POST /command` with a `c` value (`forcesave`, `info`, `drop`, `meta`, `version`), wrapped in a signed `token` when JWT is enabled. Error `4` = no changes to force-save; `6` = invalid token signature.
- Conversion API: `POST /ConvertService.ashx` with `filetype`/`key`/`outputtype`/`url` required and lowercase, **and an `Accept: application/json` request header** — without it the service replies in XML (`<FileResult><Error>...`) instead, which silently breaks any client that only sends `Content-Type` and expects JSON back. `async: true` returns immediately — re-poll the identical request (same `key`) until `endConvert: true`; the response's `percent` field is real per-poll progress, safe to render directly rather than animating something synthetic. Check the format matrix before assuming a pair is supported; an unsupported pair returns error `-7`, not a generic failure.
- A full server integration needs five endpoints: the embedding page (`GET /`), the callback receiver (`POST /track`), file download (`GET /download`), file upload (`POST /upload`), and format conversion (`POST /convert`).
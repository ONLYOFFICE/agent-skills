---
name: web-converter
description: Guidance for calling the ONLYOFFICE Docs Conversion API (v8.2+) - converting a document from one format to another (e.g. docx -> pdf, csv -> xlsx) via a synchronous or async POST to the Document Server's converter service, with JWT signed requests and format pair validation. Use when the task is "convert this file to X" with no live editing session involved - a bulk converter, an upload pipeline that needs a PDF preview, a format migration job. For the editor's own API contract, use the separate `doceditor` skill; for generating a whole sample integration whose `/convert` route defers back to this one, use `doceditor-integration`.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
---

# ONLYOFFICE Web Converter API

Guidance for the **ONLYOFFICE Docs Conversion API**: converting a file from one format to another via a single HTTP call to the Document Server, with no editor session and no `config`/`editorConfig`/`events` payload involved. This file is the whole skill - the official docs below are the field by field source; **Core rules** is what they don't say explicitly: the ways a request or response fails *quietly*.

This is a standalone concern from embedding the Document Editor - a live editing session has its own contract (config payload, callback handler, Command Service) covered by the sibling **`doceditor`** skill, and generating a whole sample integration around it (whose `/convert` route defers back to this skill) is the sibling **`doceditor-integration`** skill's job. Reach for those when the task involves `DocsAPI.DocEditor` at all; reach for this one when it's purely "take file A, hand back file B".

## How to use

1. Read [Request](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api/request.md) for the request shape, then [Response](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api/response.md) for parsing the result.
2. [Signature](https://api.teamlab.info/docs/docs-api/additional-api/signature.md) covers JWT signing the request when the Document Server has token auth enabled - the request body is the vector this service reads (see "Token in body" from that page), not an `Authorization` header.
3. [Error codes](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api/error-codes.md) and [Conversion tables](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api/conversion-tables.md) are lookups: the negative error code table, and the supported pair matrix to check before sending a request.
4. **A detail these pages don't cover is a required lookup, not license to guess** - follow that page's own links, or [Basic concepts](https://api.teamlab.info/docs/docs-api/get-started/basic-concepts.md) generally, rather than filling a gap from memory.

## Definition of done

The request sends `filetype`, `key`, `outputtype`, and `url`, with the two type values lowercased and the token (when auth is enabled) signed into the JSON body - never sent only as a header. The request carries `Accept: application/json`, without which the service silently answers in XML. Whether the pair is convertible at all is checked against the format table before the request goes out, never assumed or hand typed. When `async: true`, the caller re-polls the *identical* request under the *same* `key` until `endConvert: true`, bounded by a timeout or attempt cap, rendering the response's own `percent` as progress rather than a synthetic animation. The response's `error` key is checked before `fileUrl` is read, and every negative code maps to its own message or branch - `-7` (input error), `-8` (invalid token, never retried as-is), `-5` (password), and the rest - not a single generic "conversion failed".

## Official reference

- [DocEditor conversion overview](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api.md) - index into the four pages below
- [Request](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api/request.md) - request fields (`filetype`, `key`, `outputtype`, `url`, `options`) and worked examples per scenario (password protected source, watermark, thumbnail, JWT)
- [Response](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api/response.md) - response fields (`endConvert`, `fileUrl`, `percent`) and the XML vs JSON response shape
- [Error codes](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api/error-codes.md) - the `-1`...`-10` conversion error codes
- [Conversion tables](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api/conversion-tables.md) - supported input-output pairs by document/spreadsheet/presentation/diagram family
- [Signature](https://api.teamlab.info/docs/docs-api/additional-api/signature.md) - JWT signing overview and the "Token in body" vector this service's request uses

## Core rules

These are the rules the pages above state as *fields*, not as *consequences* - what a wrong or missing one actually does, which is usually nothing you'd notice until it's in front of a user.

- **When you don't know, look it up - don't guess.** A field, error code, or format pair the pages above don't answer is a required live-docs check, not something to fill in from memory.
- `POST` to `https://documentserver/converter` with lowercase `filetype`/`outputtype`/`key`/`url`, the token inside the JSON body (never only a header), and **an `Accept: application/json` request header** - without it the service replies in XML (`<FileResult><Error>...`) and the failure surfaces as a JSON decode error pointing nowhere near the cause.
- With `async: true` the call returns immediately: re-poll the *identical* request under the *same* `key` until `endConvert: true` - a fresh key per attempt restarts the job from zero - and bound that loop with a timeout or attempt cap so a job the server gave up on doesn't hold a worker forever. The response's own `percent` is real progress - render it rather than animating something synthetic.
- Check the pair against the format matrix before sending - for a generated integration, pin [`ONLYOFFICE/document-formats`](https://github.com/ONLYOFFICE/document-formats) (`onlyoffice-docs-formats.json`) as a git submodule rather than hand-typing the pairs or re-fetching them at request time. Check `error` before reading `fileUrl`, keeping the negative codes distinct: `-7` (input error - what an illegal pair comes back as), `-8` (invalid token - will fail identically on every retry, so don't retry it), `-5` (incorrect password). All three read the same in a flat "conversion failed" and need different fixes.
- A report that says only "conversion error" is missing the one fact that would answer it - get the real `error` value logged (or read it directly if you're working from code) before reasoning any further; collapsing ten different codes into one string is usually the actual bug, not something to work around. When only the symptom is available and the code genuinely isn't, don't hand back the whole code table as a menu of equally-weighted guesses - commit to one diagnosis and say so, the way you'd name a root cause rather than list every suspect. A fixed, non-growing set of items failing identically on every retry while everything else succeeds first try rules out anything universal (a bad shared secret, a down server, misconfigured auth) and points at something specific to those items or their request; retrying, or disabling JWT to check, can't change a deterministic-per-request outcome and is wasted motion either way. Among item-specific causes, favor the mundane gap over the exotic one - a parameter some inputs need and others don't (a password, an explicit format hint, a size override) going unset for a subset of requests is a far more common bug than a subset of files being selectively corrupt or unreachable, and it's the one worth naming first. The same discipline applies to a contract deviation you actually find in code (a token sent only as a header, a missing `Accept`): state what it does under the setup described - it will fail once X is true - instead of softening a checkable consequence into "probably fine."
- All JWT signatures are HMAC-SHA256 (HS256), computed **server-side only** - never sign the token in frontend code. Load the signing secret from the environment and **fail startup if unset** - never hardcode a fallback in application source.
- Map every negative error code to its own branch or message in the generated code - a table in a doc page is documentation, not implementation.
- `url` has to be an address the Document Server itself can reach - not a local filesystem path, not a `localhost` URL that only resolves inside the calling process.

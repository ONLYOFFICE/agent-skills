---
name: web-converter
description: Guidance for calling the ONLYOFFICE Docs Conversion API (v8.2.0+) - converting a document from one format to another (e.g. docx -> pdf, csv -> xlsx) via a synchronous or async POST to the Document Server's converter service, with JWT signed requests and format pair validation. Use when the task is "convert this file to X" with no live editing session involved - a bulk converter, an upload pipeline that needs a PDF preview, a format migration job. For the editor's own API contract, use the separate `doceditor` skill; for generating a whole sample integration whose `/convert` route defers back to this one, use `doceditor-integration`. For generating a new document from a builder script rather than converting an existing one, use `web-builder`.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
  sdk-version: "8.2.0"
---

# ONLYOFFICE Web Converter API

Guidance for the **ONLYOFFICE Docs Conversion API**: converting a file from one format to another via a single HTTP call to the Document Server, with no editor session and no `config`/`editorConfig`/`events` payload involved. The official docs below are the field by field source; **Core rules** is what they don't say explicitly: the ways a request or response fails *quietly*. Detail that only some tasks need is in `references/`, routed from **References** below.

This is a standalone concern from embedding the Document Editor - a live editing session has its own contract (config payload, callback handler, Command Service) covered by the sibling **`doceditor`** skill, and generating a whole sample integration around it (whose `/convert` route defers back to this skill) is the sibling **`doceditor-integration`** skill's job. Reach for those when the task involves `DocsAPI.DocEditor` at all; reach for this one when it's purely "take file A, hand back file B". Generating a file that doesn't exist yet - from data, a template, a script - is the sibling **`web-builder`** skill (`/docbuilder`, a different request and response shape).

## How to use

1. Read [Request](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/request.md) for the request shape, then [Response](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/response.md) for parsing the result.
2. [Signature](https://api.onlyoffice.com/docs/docs-api/additional-api/signature.md) covers JWT signing the request when the Document Server has token auth enabled - the service reads the token from the JSON body's `token` field ("Token in body", the recommended vector) and falls back to an `Authorization: Bearer` header only when the body has none.
3. [Error codes](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/error-codes.md) and [Conversion tables](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/conversion-tables.md) are lookups: the negative error code table, and the supported pair matrix to check before sending a request.
4. **A detail these pages don't cover is a required lookup, not license to guess** - follow that page's own links, or [Basic concepts](https://api.onlyoffice.com/docs/docs-api/get-started/basic-concepts.md) generally, rather than filling a gap from memory.

## Definition of done

The request sends `filetype`, `key`, `outputtype`, and `url`, with the two type values lowercased and, when auth is enabled, every one of those parameters inside the signed token payload - preferably sent as the body's `token` field. The request goes to `/converter`, which answers in JSON; the legacy `/ConvertService.ashx` answers in XML unless the request sends `Accept: application/json`. Whether the pair is convertible at all is checked against the format table before the request goes out, never assumed or hand typed. When `async: true`, the caller re-polls the *identical* request under the *same* `key` until `endConvert: true`, bounded by a timeout or attempt cap; progress is shown as a state (converting/done), because `percent` is only ever `0` or `100`. The response's `error` key is checked before `fileUrl` is read, and every negative code maps to its own message or branch - `-7` (input error), `-8` (invalid token, never retried as-is), `-5` (password), and the rest - not a single generic "conversion failed" - and the codes that fail identically on every identical request never go back through a retry, the job queue's included.

## Official reference

- [DocEditor conversion overview](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api.md) - index into the four pages below
- [Request](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/request.md) - request fields (`filetype`, `key`, `outputtype`, `url`, `password`, `thumbnail`, `watermark`, ...) and worked examples per scenario (password protected source, watermark, thumbnail, JWT)
- [Response](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/response.md) - response fields (`endConvert`, `fileUrl`, `percent`) and the XML vs JSON response shape (the intermediate `percent: 95` example there is not what the server sends - see Core rules)
- [Error codes](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/error-codes.md) - the `-1`...`-10` conversion error codes
- [Conversion tables](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/conversion-tables.md) - supported input-output pairs by document/spreadsheet/presentation/diagram family
- [Signature](https://api.onlyoffice.com/docs/docs-api/additional-api/signature.md) - JWT signing overview and the "Token in body" vector this service's request uses

## Core rules

These are the rules the pages above state as *fields*, not as *consequences* - what a wrong or missing one actually does, which is usually nothing you'd notice until it's in front of a user.

- **When you don't know, look it up - don't guess.** A field, error code, or format pair the pages above don't answer is a required live-docs check, not something to fill in from memory.
- `POST` to `https://documentserver/converter` with lowercase `filetype`/`outputtype`/`key`/`url`. `/converter` answers in JSON unless the request's `Accept` prefers XML; the legacy `/ConvertService.ashx` (still routed, still in old integrations) is the reverse - it answers in XML (`<FileResult><Error>...`) unless the request sends `Accept: application/json`, so a client there that calls `.json()` fails with a decode error pointing nowhere near the cause. Sending `Accept: application/json` is correct on both.
- **With JWT on, only what's inside the token counts.** By default (`tokenRequiredParams`) the service replaces the request's parameters with the token's decoded payload, so `filetype`, `outputtype`, `key`, `url`, `async`, `password` and the rest all belong *inside* the signed payload - a field sent in plain JSON next to the token is silently dropped (a `thumbnail` or `title` beside the token is ignored without an error). This is a rule for reviewing request-building code you can see - not a diagnosis to reach for from a symptom. The token is read from the body's `token` field - the vector the docs recommend - or, only when the body has none, from the `Authorization: Bearer` header (header name and prefix are server config, `services.CoAuthoring.token.inbox`); a header token signed over the full request works. Don't report a header token as a defect on its own; report a token that doesn't carry the parameters.
- With `async: true` the call returns immediately: re-poll the *identical* request under the *same* `key` until `endConvert: true` - a fresh key per attempt restarts the job from zero - and bound that loop with a timeout or attempt cap so a job the server gave up on doesn't hold a worker forever. `percent` is not progress: the server sends `0` on every intermediate response and `100` once `endConvert` is `true` (the Response page's `percent: 95` example notwithstanding - `fillResponse` computes `end ? 100 : 0`). A progress bar bound to it sits at zero and jumps to done; show a state (queued/converting/done) or elapsed time instead, and don't animate a synthetic percentage either.
- Check the pair against the format matrix before sending: `ONLYOFFICE/document-formats`' `onlyoffice-docs-formats.json`, the file the Document Server itself reads, taken **from `master` only** and used whole - never hand-typed, trimmed, or re-fetched per request. Where it comes from and how to ship it: [references/formats.md](references/formats.md). Check `error` before reading `fileUrl`, keeping the negative codes distinct: `-7` (input error - what an illegal pair comes back as), `-8` (invalid token - will fail identically on every retry, so don't retry it), `-5` (incorrect password). All three read the same in a flat "conversion failed" and need different fixes.
- **A report that says only "conversion error" gets one committed diagnosis, not the code table as a menu** - read [references/diagnosis.md](references/diagnosis.md) before answering one. The short form: get the real `error` value first; a fixed set of items failing identically on every retry rules out anything universal and points at a parameter those items need going *not sent* (a `password` above all); disabling JWT is no test and no fix.
- All JWT signatures are HMAC-SHA256 (HS256), computed **server-side only** - never sign the token in frontend code. Load the signing secret from the environment and **fail startup if unset** - never hardcode a fallback in application source.
- Map every negative error code to its own branch or message in the generated code, and let the branch decide retries wherever retries actually happen - the job queue's `attempts`/`autoretry_for` included. `-3`, `-5`, `-7`, `-8`, `-9`, `-10` are permanent; `-1`, `-4`, `-6` can be transient; `-2` means move to `async`. The table with the fix per code: [references/errors.md](references/errors.md).
- In an audit, report each independent cause as its own finding, even when several combine into one symptom, state what a deviation does under the setup described rather than "probably fine", and say explicitly which parts are already correct - [references/diagnosis.md](references/diagnosis.md).
- `url` has to be an address the Document Server itself can reach - not a local filesystem path, not a `localhost` URL that only resolves inside the calling process.

## References

| Read | When |
| :--- | :--- |
| [references/formats.md](references/formats.md) | Any code that decides whether a pair is convertible, or ships the format matrix |
| [references/errors.md](references/errors.md) | Writing the response handling or the retry policy |
| [references/diagnosis.md](references/diagnosis.md) | Answering a failure report, or auditing someone else's converter |
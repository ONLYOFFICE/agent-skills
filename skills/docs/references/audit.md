# ONLYOFFICE Integration Audit & Debug Guide

## Context & Purpose

Reviewing or debugging an ONLYOFFICE integration **someone else already wrote** — a portal that "works, sort of", a `/track` endpoint that never stops retrying, an editor that comes up as a thin strip. The deliverable here is understanding, handed over as findings: what's wrong, why it produces exactly that symptom, and the change each one needs.

That is a different job from generating an integration ([`example.md`](./example.md)) and it's held to different rules — chief among them that a review nobody asked to be a rewrite stays a review.

## Reference Documentation Map

* **Every row of the catalogue below cites the file carrying the contract it violates** — that file has the fix detail; this one has the diagnosis.
* **Generation counterpart:** [`example.md`](./example.md), [`example-checklist.md`](./example-checklist.md) — what a correct integration contains in the first place.
* **Testing generated code** (a different activity from auditing existing code): [`api-testing.md`](./api-testing.md).

## Documentation Query Rules

* **Baseline:** Self-sufficient as an index. Follow the cited file for the remedy rather than restating it from memory.
* **Fallback:** None. A symptom that isn't listed below and turned out to have a general cause is worth adding here once diagnosed.

## Review discipline

* **Answer the question they asked.** "Tell me what was going on" wants the *rule* behind the symptom said plainly — "the editing service retries anything that isn't exactly `{"error": 0}`" — not just corrected code. A silent patch leaves them unable to recognise the next instance of it, which is most of what they were asking for.
* **Don't rewrite unless they asked.** "I want a list I can hand the team" is a deliverable spec, not a preamble. Give findings in their code's own terms — their file, their function, the line — and leave the code where it is.
* **Report only what's actually there.** A review padded with a fault that isn't real costs the reader the attention the real findings need, and one wrong finding discredits the rest of the list. Where a component is sound — a callback handler that already verifies before it fetches, branches 2 and 6, and answers correctly — say so explicitly; "this part is fine" is information they can act on.
* **One cause usually owns several symptoms.** Trace them back before writing them up: a `document.key` that never changes explains *both* "they get yesterday's content" *and* "one guy's formatting was scrambled". Two mysteries reported separately is a worse review than one root cause with two consequences named.
* **Keep what they reported separate from what you found.** An unauthenticated download route you noticed on the way is a genuine finding and belongs in the list — marked as something they didn't ask about, with its own severity, not folded into their complaint.
* **Rank by consequence.** Data loss, silent corruption, and unauthenticated access sit above anything cosmetic, regardless of which one the user happened to notice first.

## Fault catalogue

Read it **by symptom** when debugging a reported problem; read it **top to bottom** as a sweep when auditing code with no specific complaint attached. The last group has no symptom at all — those only ever surface as an incident later.

### Keys and revisions

| Symptom / check | Cause | Contract |
| :--- | :--- | :--- |
| Reopening a document shows an earlier revision; some saves come back with scrambled formatting | `document.key` doesn't change when the stored bytes do — derived from the filename, or minted fresh per page load. The service serves the cached revision it already holds for a key it has seen | [`configuration/document.md`](./configuration/document.md) |
| Works until the process restarts, then old content reappears | The key is an in-memory counter or map that resets, handing the service a key it already knows under different content — it has to be persisted beside the file | [`configuration/document.md`](./configuration/document.md) |
| *(no symptom)* The save path overwrites the file without recording a new revision | Even a correct key generator is inert if `/track` doesn't store the new value for the next config to read | [`callback/handler.md`](./callback/handler.md) |

### Config shape

| Symptom / check | Cause | Contract |
| :--- | :--- | :--- |
| `callbackUrl`, `lang`, or the event handlers appear to be ignored, with nothing raised anywhere | They sit at the config root instead of under `editorConfig`/`events`, which is where the editor reads them. Nothing errors — that's why nobody noticed | [`configuration/config.md`](./configuration/config.md), [`configuration/editor.md`](./configuration/editor.md), [`configuration/events.md`](./configuration/events.md) |
| Wrong editor opens, or the document won't load | `documentType` isn't one of `word`/`cell`/`slide`/`pdf` — `"text"` and the raw extension are the common wrong values — or it disagrees with `document.fileType`'s family | [`configuration/config.md`](./configuration/config.md) |

### Client / embedding

| Symptom / check | Cause | Contract |
| :--- | :--- | :--- |
| Editor renders as a thin strip at the top, most often after picking a different file | Sizing lives on the placeholder, which init replaced with an iframe — both the CSS rule and any `style.height` set after the constructor land on a detached node. Size a wrapper. Frequently paired with a second `DocsAPI.DocEditor` built on the same id without `destroyEditor()` first, which is why it follows switching files | [`api.md`](./api.md) |
| Editor never appears; console shows `ERR_NAME_NOT_RESOLVED` on `api.js` then `DocsAPI is not defined` | The script tag points at the backend-facing Document Server address instead of one the *browser* can resolve | [`api.md`](./api.md) |
| Host page's camera/clipboard features silently dead inside the editor | The app itself sits in an outer iframe that doesn't cascade the `allow=` permissions down | [`api.md`](./api.md) |
| Closing a document leaves the visitor on a blank page, or there's no way back to the file list short of the browser Back button | `editorConfig.customization.goback` is missing or not pointed at the dashboard, or `onRequestClose` only calls `destroyEditor()`/`window.close()` without navigating anywhere afterward | [`configuration/editor.md`](./configuration/editor.md), [`configuration/events.md`](./configuration/events.md) |

### Security

| Symptom / check | Cause | Contract |
| :--- | :--- | :--- |
| The signing secret is reachable by the browser — signed in page JS, or served by an endpoint the page calls | Every visitor then holds it, so every visitor can forge a config. The server assembles and signs; the page receives it already signed | [`signature/browser.md`](./signature/browser.md), [`signature/signature.md`](./signature/signature.md) |
| Anyone who can reach the URL can make the backend download a file from anywhere they name | The callback fetches `url` before verifying the body token — by then the request has already been made | [`callback/handler.md`](./callback/handler.md), [`signature/body.md`](./signature/body.md) |
| A valid token spliced onto a substituted `url` is accepted | The signature is trusted on its own; the decoded claims are never compared against the sibling root fields (`status`, `url`, `key`) | [`signature/body.md`](./signature/body.md) |
| Every genuine callback is rejected as a forgery | The splicing check compares *all* decoded claims, including the registered ones the signer stamps (`iat` above all) that never appear as body fields | [`signature/body.md`](./signature/body.md) |
| Any stored file is downloadable by naming it in the query string | Download route with no token verification and no ownership check | [`example.md`](./example.md) |
| `editorConfig.user.id` is a plaintext email or real name | It must be an anonymized session identifier | [`configuration/editor.md`](./configuration/editor.md) |
| A key or filename from the request body steers the write path | Path traversal — the storage path has to be derived so it cannot escape the storage directory | [`callback/handler.md`](./callback/handler.md) |

### Callback behaviour

| Symptom / check | Cause | Contract |
| :--- | :--- | :--- |
| The same callback repeats every few seconds, same `key`, indefinitely — often "the first save worked" and 40k log lines overnight | The response isn't exactly `{"error": 0}`: a bare `ok`, an empty 200, a 204, or an unacknowledged status the handler only logged. Anything else reads as a failed delivery | [`callback/handler.md`](./callback/handler.md) |
| A save is silently lost, no retry | The opposite failure: a genuine internal error (download or disk write failed) was swallowed into `{"error": 0}`, so the retry that would have saved it never came | [`callback/handler.md`](./callback/handler.md) |
| Handler throws on routine callbacks | `url` read unguarded — it's absent on statuses `1` and `4` | [`callback/handler.md`](./callback/handler.md) |
| Session tears down mid-edit, or force-saves are treated as a close | Status `6` handled as an end-of-session event; it's a snapshot with the tab still open | [`callback/handler.md`](./callback/handler.md) |
| *(no symptom)* Statuses swept into a `default` branch | Each of `1`, `3`, `4`, `7` is the service saying something different about the session; a catch-all discards it | [`callback/handler.md`](./callback/handler.md) |

### Conversion

| Symptom / check | Cause | Contract |
| :--- | :--- | :--- |
| Conversion fails with a JSON decode error that names nothing relevant | Missing `Accept: application/json` — the service answered in XML | [`additional/conversion/request.md`](./additional/conversion/request.md) |
| A conversion never finishes, or restarts from zero on every poll | A fresh `key` per attempt (the key is what the in-flight job is keyed by), or a fixed sleep instead of re-sending the identical request | [`additional/conversion/response.md`](./additional/conversion/response.md) |
| A stuck job holds a worker forever | The polling loop has no timeout or attempt cap | [`additional/conversion/response.md`](./additional/conversion/response.md) |
| Support gets "conversion failed" with nothing to act on | Negative codes folded into one message — `-7` (input error, what an illegal pair returns), `-8` (bad token, will fail identically every retry), `-5` (password), `-2`/`-4` (operational) each need their own | [`additional/conversion/errors.md`](./additional/conversion/errors.md) |
| `fileUrl` read on a response that carried an `error` | The error key has to be checked first — an error response has no file | [`additional/conversion/response.md`](./additional/conversion/response.md) |
| Legacy `.doc`/`.xls`/`.ppt` opens read-only, or is rejected | The format table's `auto-convert` action is unread; support was decided by a hand-typed extension list instead | [`additional/conversion/table.md`](./additional/conversion/table.md) |

## Deliverable shape

**Audit:** a ranked list of findings, each one *symptom (theirs or yours) -> cause -> the change it needs*, plus an explicit note of what you checked and found sound. No rewrite, no restructuring their app.

**Debug:** the corrected code **and** the rule that explains the symptom, stated in a sentence they can reuse. If the fix touches a contract they'll hit again — the `{"error": 0}` acknowledgement, key rotation, verify-before-fetch — name it as a rule, not as a line you happened to change.
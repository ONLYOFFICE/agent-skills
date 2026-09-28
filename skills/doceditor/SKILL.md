---
name: doceditor
description: Guidance for the ONLYOFFICE Document Editor's own API contract (v8.2+) - embedding it via DocsAPI.DocEditor, assembling the config/document/editorConfig/events payload, implementing the callbackUrl handler, signing JWT tokens (browser, header, body), and calling the server to server Command Service. Use when wiring the editor into an app that already exists - the config object, the callback handler, JWT, force-save, version history. For generating a whole sample/demo integration from scratch (project scaffolding, a file-list UI, Docker/infra, the testing methodology), use the separate `doceditor-integration` skill instead. For standalone document format conversion with no editor session involved, use `web-converter`. For generating documents server-side from a builder script, use `web-builder`.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
---

# ONLYOFFICE Document Editor API

This file is the whole skill. The field by field reference is the official docs, linked directly below - **Core rules** covers what they don't say explicitly (the ways a request or response fails *quietly*), and **Auditing or debugging an existing integration** is a symptom - cause index with no official-docs equivalent, for reviewing code someone else wrote.

This skill is scoped to *using* the API correctly, wherever it's being called from - an existing backend, a route added to a larger app, a single page. Two adjacent concerns live in sibling skills instead of here:

- **Generating a whole sample/demo integration from scratch** — project scaffolding, the reusable-backend-vs-sample-UI decision, `docspace-ui-kit-react`-based UI, Docker/nginx/compose, hexagonal architecture, and the testing methodology for generated code - is the sibling **`doceditor-integration`** skill. Reach for that one when the task is "build me something I can click through," not just "wire the editor into what we have." It also carries the official React/Angular/Vue component walkthroughs.
- **Standalone document format conversion**, no live editing session involved, is the sibling **`web-converter`** skill; **server-side document generation from a builder script** is the sibling **`web-builder`** skill.

## How to use

1. **Name the task shape first** (table below).
2. Read the official page(s) the shape routes to for exact field names, payload shapes, and constraints.
3. **This skill's own "Core rules" below are not optional colour** - they're the failure modes the raw parameter reference doesn't call out as failure modes (a stale key doesn't error, a bad callback response doesn't error, a signed-in-the-browser token doesn't error). Apply them on top of whatever the linked page says, not instead of it.
4. **A detail nothing here covers is a required lookup, not license to guess** — follow that page's own links, or [Basic concepts](https://api.teamlab.info/docs/docs-api/get-started/basic-concepts.md) generally, rather than filling a gap from memory.

### Task shapes

| Shape | Sounds like | Path | Done when |
| :--- | :--- | :--- | :--- |
| **Embed the editor** | "add the ONLYOFFICE editor to our page", "wire it into our app", "get the config object right for our doc viewer" | [DocEditor](https://api.teamlab.info/docs/docs-api/usage-api/doceditor.md) -> [Config](https://api.teamlab.info/docs/docs-api/usage-api/config.md) and its `document`/`editor`/`events` sub-pages -> [Signature](https://api.teamlab.info/docs/docs-api/additional-api/signature.md) -> [Callback handler](https://api.teamlab.info/docs/docs-api/usage-api/callback-handler.md) - for a React/Angular/Vue target, the sibling `doceditor-integration` skill's official component walkthrough instead of hand-rolling `DocEditor`'s manual pattern | **Definition of done** below holds for every field/handler actually in scope |
| **Add a capability** | "wire up force-save", "add version history", "switch on co-editing" | The one official page for it ([Command service](https://api.teamlab.info/docs/docs-api/additional-api/command-service.md), [Events](https://api.teamlab.info/docs/docs-api/usage-api/config/events.md), [Methods](https://api.teamlab.info/docs/docs-api/usage-api/methods.md)) | It's reachable, every documented status/error code it can return is branched, and each branch has a test |
| **Debug** | "saves once then POSTs us forever", "editor comes up as a thin strip", "connection refused fetching the callback url" | **Auditing or debugging** below, symptom -> cause | The **rule** behind the symptom is explained back to the user, not just a patched file — "tell me what was going on" is half the request |
| **Audit / review** | "go through it and tell me what's actually wrong", "I want a list I can hand the team, don't rewrite it" | **Auditing or debugging** below — review discipline, then its fault catalogue | Every finding names cause + the change it needs, nothing is reported that isn't actually there, and the app is not rewritten |

Building a whole sample app, not just wiring the API into something that exists? That's the **`doceditor-integration`** skill's task shape table, not this one - it starts from project scaffolding and comes back to this skill for the API contract as it builds each piece.

### Definition of done

`config.document` and `config.documentType` are assembled correctly (required fields present, `documentType` matching `document.fileType`'s family) and `document.key` rotates on every save rather than being reused. `editorConfig.callbackUrl`/`user` and event handlers sit where the editor actually reads them (`editorConfig`/`events`, not the config root), with `user.id` an anonymized session identifier. Every token is signed server-side with the correct vector for its caller. The callback verifies its token before fetching anything, branches every status it can receive, and answers exactly `{"error": 0}` for everything it handled. When the scope includes version history, both `onRequestHistory`/`refreshHistory` and `onRequestHistoryData`/`setHistoryData` are wired, not just one. Whenever a dashboard/file-list page exists for the editor to return to, `editorConfig.customization.goback` points at it and `onRequestClose` actually navigates back there. JWT and other secrets come from the environment with **no hardcoded fallback in source** — fail fast if unset. Every field/handler/status branch actually in scope has its own test, derived from the contract rather than from whatever the implementation happens to do.

## Official reference

- [DocEditor](https://api.teamlab.info/docs/docs-api/usage-api/doceditor.md) — the `DocsAPI.DocEditor(id, config)` constructor, why init renders into an iframe, and what that means for the host page
- [Config](https://api.teamlab.info/docs/docs-api/usage-api/config.md), [Document](https://api.teamlab.info/docs/docs-api/usage-api/config/document.md) ([Info](https://api.teamlab.info/docs/docs-api/usage-api/config/document/info.md), [Permissions](https://api.teamlab.info/docs/docs-api/usage-api/config/document/permissions.md)), [Editor](https://api.teamlab.info/docs/docs-api/usage-api/config/editor.md) ([Standard branding](https://api.teamlab.info/docs/docs-api/usage-api/config/editor/customization/customization-standard-branding.md), [White label](https://api.teamlab.info/docs/docs-api/usage-api/config/editor/customization/customization-white-label.md), [Embedded](https://api.teamlab.info/docs/docs-api/usage-api/config/editor/embedded.md), [Plugins](https://api.teamlab.info/docs/docs-api/usage-api/config/editor/plugins.md)), [Events](https://api.teamlab.info/docs/docs-api/usage-api/config/events.md) — the full config payload, one page per section
- [Methods](https://api.teamlab.info/docs/docs-api/usage-api/methods.md) - every `docEditor` instance method
- [Automation API](https://api.teamlab.info/docs/docs-api/usage-api/automation-api.md), [Connector class](https://api.teamlab.info/docs/docs-api/usage-api/automation-api/connector-class.md), [Connector window](https://api.teamlab.info/docs/docs-api/usage-api/automation-api/connector-window.md) - Automation API (**Docs Developer license only**)
- [Callback handler](https://api.teamlab.info/docs/docs-api/usage-api/callback-handler.md) - the `callbackUrl` contract: status codes, request fields, required response
- [Command service](https://api.teamlab.info/docs/docs-api/additional-api/command-service.md) - Command Service `c` values and error codes
- [Signature](https://api.teamlab.info/docs/docs-api/additional-api/signature.md), [Browser](https://api.teamlab.info/docs/docs-api/additional-api/signature/browser.md), [Token in body](https://api.teamlab.info/docs/docs-api/additional-api/signature/request/token-in-body.md), [Token in header](https://api.teamlab.info/docs/docs-api/additional-api/signature/request/token-in-header.md) - the three JWT vectors
- [Basic concepts](https://api.teamlab.info/docs/docs-api/get-started/basic-concepts.md), [Preloading static resources](https://api.teamlab.info/docs/docs-api/get-started/configuration/preload.md) - orientation and static-asset preloading

## Core rules (always apply)

These are the rules the pages above state as *fields*, not as *consequences* — what happens when one is wrong, which is usually nothing you'd notice until it's in front of a user.

- **When you don't know, look it up - don't guess.** A field, error code, or edge case the pages above don't answer is a required live-docs check, not something to fill in from memory.
- Init **replaces** the container element with a sandboxed iframe (DocEditor's "Rendering in an iframe") - size a wrapper element around it, not the placeholder itself; talk to the frame only through `methods` and `events`.
- **Inside a component framework (React/Angular/Vue), the placeholder can't be framework-owned.** If the element `DocEditor` mounts into is declared in the framework's own render tree, a later re-render anywhere in that subtree makes the framework try to reconcile against a node the SDK already replaced with an iframe - a native DOM exception from the framework's own render layer, not anything ONLYOFFICE specific, and it reproduces on the very next click after opening the editor. The official docs don't cover this because it's a framework integration hazard, not an API fact. **The official components (sibling `doceditor-integration` skill) already solve it internally** - use one instead of hand-rolling the manual pattern for those three frameworks; for every other target, mount/unmount imperatively on a persistent wrapper the framework renders once and never declares children into.
- Whenever this deliverable has a file list/dashboard page, wire `editorConfig.customization.goback` to point at it (`requestClose: true`) and make `onRequestClose` actually navigate back there after `destroyEditor()` — not just close the tab or stop at a blank page. An editor with no way back is a dead end, not a demo.
- `config.document` and `config.documentType` are required; `documentType` must match `document.fileType`'s family (`docx`->`word`, `xlsx`->`cell`, `pptx`->`slide`, `pdf`->`pdf`). Don't put `callbackUrl`, `lang`, or event handlers at the config root — they belong in `editorConfig`/`events`.
- `document.fileType`, `key`, `title`, `url` are all required. Update `key` on every save — reusing a stale key across an updated file causes visual corruption and out-of-sync revisions, and nothing about the request errors when it happens.
- `editorConfig.callbackUrl` and `editorConfig.user.{id, name}` are required for a working integration. `user.id` must be an anonymized session identifier - never a plaintext email or real name.
- Implement `onDocumentReady` and `onDocumentStateChange` at minimum. State changing methods (`refreshHistory`, `insertImage`, `setHistoryData`, ...) must be called from inside or right after their matching event handler.
- Your `callbackUrl` handler answers exactly `{"error": 0}` for every callback it handled — **including the statuses it only logs** — or the editing service reads the reply as a failed delivery and retries that same callback forever. Two exceptions matter as much as the rule: a request whose token doesn't verify is rejected *without* that acknowledgement (acknowledging a forgery tells the sender it worked), and a genuine internal failure — download failed, disk write failed — answers non-zero so the retry does its job instead of silently losing the user's save. Verify the token *before* fetching anything from `url`, branch every `status` (`2` save and `6` force-save both download and persist; `6` leaves the session open), and don't read `url` unguarded — it's absent on `1` and `4`.
- All JWT signatures are HMAC-SHA256 (HS256), computed **server-side only** - never sign tokens in frontend code, that exposes the secret in cleartext browser bundles.
- Three token placements, pick by caller: root `token` in the config payload signs the whole object for `DocsAPI.DocEditor` (browser); a `token` key inside an HTTP JSON body is used by the Command Service and the callback outbox (the same vector the `web-converter` skill's conversion requests use); an `Authorization: Bearer <jwt>` header wraps its claims under `payload`. **A state-changing `docEditor` method call from the browser (`setHistoryData`, `insertImage`, `setMailMergeRecipients`, …) is signed with this same root/browser vector, not the body-token vector** — its own `token` field signs the whole object handed to that method, assembled and signed server-side exactly like the root config token, never client-side.
- When the request includes version history, comparison, or restore: persist each revision with an incremented number, actor, snapshot, and a **content hash** of the saved bytes (computed on callback save/force-save), and wire **both** history event pairs — `onRequestHistory` - `refreshHistory` (populates the list) **and** `onRequestHistoryData` - `setHistoryData` (opens one version's diff; a distinct event from `onRequestRestore`, which reverts content). Wiring only the first leaves every entry in a populated list silently unable to open - the "history doesn't work" symptom with no server-side error to chase. Download and persist the callback's `changesurl` yourself rather than re-serving Document Server's own transient cache link, and keep every past revision's bytes independently fetchable by its own key, not just the current one - **on disk, that means each revision's own snapshot path, never the live document's path**, which the next save overwrites; a schema field named `storage_path`/`snapshot` on the revision record is not proof of this if every revision's value actually points at the same current-file path. Verify it directly: after N+1 saves, revision N's own bytes must still differ from the live file whenever the edits did. `setHistoryData`'s parameter object is **not** just `{key, url, version}` - assemble the full documented shape (`fileType`, `key`, `url`, `version`, plus `changesUrl` and a `previous{fileType, key, url}` block whenever this isn't the first revision, plus the signed `token` above) or Document Server's own client bundle throws deep inside its history UI (`Cannot read properties of undefined (reading 'canUseHistory')` in `onSetHistoryData`) with nothing resembling a server-side error to chase — the same "looks wired, silently does nothing (or worse, throws)" failure mode as wiring only one event of the pair. There is no static config `history` field.
- Command Service: `POST /command` with a `c` value (`forcesave`, `info`, `drop`, `meta`, `version`), wrapped in a signed `token` when JWT is enabled. Error `4` = no changes to force-save; `6` = invalid token signature.
- The Conversion API (`POST /ConvertService.ashx`) that a `/convert` route wraps — the `Accept: application/json` requirement, the lowercase `filetype`/`outputtype`/async-poll contract, the negative error codes, and the format-pair table - is documented in full by the sibling **`web-converter`** skill; build that route from there rather than re-deriving it here.
- Wherever a response carries a small set of named error/status codes (Command Service's `1`/`2`/`3`/`4`/`6`, the callback's `status`, and — via `web-converter` - conversion's `-1`…`-10`), map every value to its own branch or message in the generated code - a table in a doc page is documentation, not implementation. Preserving the raw integer in a log line and funneling everything else into one generic "failed" branch throws away the distinction the table exists for.

## Auditing or debugging an existing integration

Reviewing or debugging an ONLYOFFICE integration **someone else already wrote** - a portal that "works, sort of", a `/callback` endpoint that never stops retrying, an editor that comes up as a thin strip. The deliverable here is understanding, handed over as findings: what's wrong, why it produces exactly that symptom, and the change each one needs. That is a different job from generating a sample integration (sibling `doceditor-integration` skill) and it's held to different rules - chief among them that a review nobody asked to be a rewrite stays a review.

**Review discipline:**

- **Answer the question they asked.** "Tell me what was going on" wants the *rule* behind the symptom said plainly - "the editing service retries anything that isn't exactly `{"error": 0}`" - not just corrected code. A silent patch leaves them unable to recognise the next instance of it, which is most of what they were asking for.
- **Don't rewrite unless they asked.** "I want a list I can hand the team" is a deliverable spec, not a preamble. Give findings in their code's own terms - their file, their function, the line - and leave the code where it is.
- **Report only what's actually there.** A review padded with a fault that isn't real costs the reader the attention the real findings need, and one wrong finding discredits the rest of the list. Where a component is sound - a callback handler that already verifies before it fetches, branches 2 and 6, and answers correctly - say so explicitly; "this part is fine" is information they can act on.
- **One cause usually owns several symptoms.** Trace them back before writing them up: a `document.key` that never changes explains *both* "they get yesterday's content" *and* "one guy's formatting was scrambled". Two mysteries reported separately is a worse review than one root cause with two consequences named.
- **Keep what they reported separate from what you found.** An unauthenticated download route you noticed on the way is a genuine finding and belongs in the list - marked as something they didn't ask about, with its own severity, not folded into their complaint.
- **Rank by consequence.** Data loss, silent corruption, and unauthenticated access sit above anything cosmetic, regardless of which one the user happened to notice first.

**Fault catalogue** - read it **by symptom** when debugging a reported problem; read it **top to bottom** as a sweep when auditing code with no specific complaint attached. The last group has no symptom at all — those only ever surface as an incident later.

*Keys and revisions*
| Symptom / check | Cause |
| :--- | :--- |
| Reopening a document shows an earlier revision; some saves come back with scrambled formatting | `document.key` doesn't change when the stored bytes do — derived from the filename, or minted fresh per page load. The service serves the cached revision it already holds for a key it has seen ([Document](https://api.teamlab.info/docs/docs-api/usage-api/config/document.md)) |
| Works until the process restarts, then old content reappears | The key is an in-memory counter or map that resets, handing the service a key it already knows under different content — it has to be persisted beside the file |
| *(no symptom)* The save path overwrites the file without recording a new revision | Even a correct key generator is inert if `/callback` doesn't store the new value for the next config to read ([Callback handler](https://api.teamlab.info/docs/docs-api/usage-api/callback-handler.md)) |

*Config shape*
| Symptom / check | Cause |
| :--- | :--- |
| `callbackUrl`, `lang`, or the event handlers appear to be ignored, with nothing raised anywhere | They sit at the config root instead of under `editorConfig`/`events`, which is where the editor reads them. Nothing errors - that's why nobody noticed ([Config](https://api.teamlab.info/docs/docs-api/usage-api/config.md)) |
| Wrong editor opens, or the document won't load | `documentType` isn't one of `word`/`cell`/`slide`/`pdf` - `"text"` and the raw extension are the common wrong values - or it disagrees with `document.fileType`'s family |

*Client / embedding*
| Symptom / check | Cause |
| :--- | :--- |
| Editor renders as a thin strip at the top, most often after picking a different file | Sizing lives on the placeholder, which init replaced with an iframe - both the CSS rule and any `style.height` set after the constructor land on a detached node. Size a wrapper. Frequently paired with a second `DocsAPI.DocEditor` built on the same id without `destroyEditor()` first, which is why it follows switching files ([DocEditor](https://api.teamlab.info/docs/docs-api/usage-api/doceditor.md)) |
| Editor never appears; console shows `ERR_NAME_NOT_RESOLVED` on `api.js` then `DocsAPI is not defined` | The script tag points at the backend-facing Document Server address instead of one the *browser* can resolve |
| Host page's camera/clipboard features silently dead inside the editor | The app itself sits in an outer iframe that doesn't cascade the `allow=` permissions down |
| Closing a document leaves the visitor on a blank page, or there's no way back to the file list short of the browser Back button | `editorConfig.customization.goback` is missing or not pointed at the dashboard, or `onRequestClose` only calls `destroyEditor()`/`window.close()` without navigating anywhere afterward ([Editor](https://api.teamlab.info/docs/docs-api/usage-api/config/editor.md), [Events](https://api.teamlab.info/docs/docs-api/usage-api/config/events.md)) |
| Version history list populates fine, but clicking an entry throws inside Document Server's own bundle — `Cannot read properties of undefined (reading 'canUseHistory')` (or similar) in `onSetHistoryData`, nothing server-side to chase | `onRequestHistoryData`'s `setHistoryData({...})` call was handed a partial object — `{key, url, version}` alone is the common shape, missing `fileType`, the signed `token` (same root/browser vector as the config token — see the token-placement rule above), and, for any version after the first, `previous{fileType, key, url}`. The fix is completing the object per [Methods](https://api.teamlab.info/docs/docs-api/usage-api/methods.md), not catching the exception |
| Opening version N-1 after N has been saved shows N's content (or the diff is empty/identical) | A revision's stored "snapshot" path actually aliases the live document's current path, so every past version resolves to whatever was saved most recently — see the version-history Core rule above; verify by diffing the two versions' actual served bytes, not just their metadata rows |

*Security*
| Symptom / check | Cause |
| :--- | :--- |
| The signing secret is reachable by the browser — signed in page JS, or served by an endpoint the page calls | Every visitor then holds it, so every visitor can forge a config. The server assembles and signs; the page receives it already signed ([Browser](https://api.teamlab.info/docs/docs-api/additional-api/signature/browser.md)) |
| Anyone who can reach the URL can make the backend download a file from anywhere they name | The callback fetches `url` before verifying the body token — by then the request has already been made ([Callback handler](https://api.teamlab.info/docs/docs-api/usage-api/callback-handler.md), [Token in body](https://api.teamlab.info/docs/docs-api/additional-api/signature/request/token-in-body.md)) |
| A valid token spliced onto a substituted `url` is accepted | The signature is trusted on its own; the decoded claims are never compared against the sibling root fields (`status`, `url`, `key`) |
| Every genuine callback is rejected as a forgery | The splicing check compares *all* decoded claims, including the registered ones the signer stamps (`iat` above all) that never appear as body fields |
| Any stored file is downloadable by naming it in the query string | Download route with no token verification and no ownership check — sibling `doceditor-integration` skill's `example.md` has the endpoint's reference shape |
| `editorConfig.user.id` is a plaintext email or real name | It must be an anonymized session identifier |
| A key or filename from the request body steers the write path | Path traversal — the storage path has to be derived so it cannot escape the storage directory |

*Callback behaviour*
| Symptom / check | Cause |
| :--- | :--- |
| The same callback repeats every few seconds, same `key`, indefinitely — often "the first save worked" and 40k log lines overnight | The response isn't exactly `{"error": 0}`: a bare `ok`, an empty 200, a 204, or an unacknowledged status the handler only logged. Anything else reads as a failed delivery |
| A save is silently lost, no retry | The opposite failure: a genuine internal error (download or disk write failed) was swallowed into `{"error": 0}`, so the retry that would have saved it never came |
| Handler throws on routine callbacks | `url` read unguarded - it's absent on statuses `1` and `4` |
| Session tears down mid-edit, or force-saves are treated as a close | Status `6` handled as an end-of-session event; it's a snapshot with the tab still open |
| *(no symptom)* Statuses swept into a `default` branch | Each of `1`, `3`, `4`, `7` is the service saying something different about the session; a catch-all discards it |

*Conversion* — the Conversion API's own symptom index (JSON-decode-error-from-a-missing-`Accept`-header, a poll that restarts from zero, negative codes folded into one message, `fileUrl` read before `error` is checked) lives in the sibling **`web-converter`** skill — go there for any `/convert`-route or standalone-conversion symptom.
| Symptom / check | Cause |
| :--- | :--- |
| Legacy `.doc`/`.xls`/`.ppt` opens read-only, or is rejected | The format table's `auto-convert` action is unread; support was decided by a hand-typed extension list instead — `web-converter` skill's [Conversion tables](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api/conversion-tables.md) |

**Deliverable shape:**

**Audit:** a ranked list of findings, each one *symptom (theirs or yours) -> cause -> the change it needs*, plus an explicit note of what you checked and found sound. No rewrite, no restructuring their app.

**Debug:** the corrected code **and** the rule that explains the symptom, stated in a sentence they can reuse. If the fix touches a contract they'll hit again - the `{"error": 0}` acknowledgement, key rotation, verify-before-fetch — name it as a rule, not as a line you happened to change.

# Auditing or debugging an existing integration

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
| Reopening a document shows an earlier revision; some saves come back with scrambled formatting | `document.key` doesn't change when the stored bytes do — derived from the filename, or minted fresh per page load. The service serves the cached revision it already holds for a key it has seen ([Document](https://api.onlyoffice.com/docs/docs-api/usage-api/config/document.md)) |
| Works until the process restarts, then old content reappears | The key is an in-memory counter or map that resets, handing the service a key it already knows under different content — it has to be persisted beside the file |
| *(no symptom)* The save path overwrites the file without recording a new revision | Even a correct key generator is inert if `/callback` doesn't store the new value for the next config to read ([Callback handler](https://api.onlyoffice.com/docs/docs-api/usage-api/callback-handler.md)) |

*Config shape*
| Symptom / check | Cause |
| :--- | :--- |
| `callbackUrl`, `lang`, or the event handlers appear to be ignored, with nothing raised anywhere | They sit at the config root instead of under `editorConfig`/`events`, which is where the editor reads them. Nothing errors - that's why nobody noticed ([Config](https://api.onlyoffice.com/docs/docs-api/usage-api/config.md)) |
| Wrong editor opens, or the document won't load | `documentType` isn't one of `word`/`cell`/`slide`/`pdf` - `"text"` and the raw extension are the common wrong values - or it disagrees with `document.fileType`'s family |

*Client / embedding*
| Symptom / check | Cause |
| :--- | :--- |
| Editor renders as a thin strip at the top, most often after picking a different file | Sizing lives on the placeholder, which init replaced with an iframe - both the CSS rule and any `style.height` set after the constructor land on a detached node. Size a wrapper. Frequently paired with a second `DocsAPI.DocEditor` built on the same id without `destroyEditor()` first, which is why it follows switching files ([DocEditor](https://api.onlyoffice.com/docs/docs-api/usage-api/doceditor.md)) |
| Editor never appears; console shows `ERR_NAME_NOT_RESOLVED` on `api.js` then `DocsAPI is not defined` | The script tag points at the backend-facing Document Server address instead of one the *browser* can resolve |
| The editor shows "Download failed" / the document never opens, or saves never reach `/callback`, while both containers are up and the app answers from the host | Document Server refuses to fetch `document.url` or post to `callbackUrl` when the address resolves to a private IP - a compose service name, `host.docker.internal`, a LAN address - unless its container runs with `ALLOW_PRIVATE_IP_ADDRESS=true`. Its own log shows the refused request; the sibling `doceditor-integration` skill's `infrastructure/compose.md` has the full container setup |
| Host page's camera/clipboard features silently dead inside the editor | The app itself sits in an outer iframe that doesn't cascade the `allow=` permissions down |
| Closing a document leaves the visitor on a blank page, or there's no way back to the file list short of the browser Back button | No `onRequestClose` is declared (so `editorConfig.customization.close` never shows the cross button), it only calls `destroyEditor()`/`window.close()` without navigating anywhere afterward, or the close is still wired through `goback.requestClose`, deprecated since 8.1 ([Customization](https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/customization/customization-standard-branding.md#close), [Events](https://api.onlyoffice.com/docs/docs-api/usage-api/config/events.md#onrequestclose)) |
| Version history list populates fine, but clicking an entry throws inside Document Server's own bundle — `Cannot read properties of undefined (reading 'canUseHistory')` (or similar) in `onSetHistoryData`, nothing server-side to chase | `onRequestHistoryData`'s `setHistoryData({...})` call was handed a partial object — `{key, url, version}` alone is the common shape, missing `fileType`, the signed `token` (same root/browser vector as the config token — see the token-placement rule in `SKILL.md`), and, for any version after the first, `previous{fileType, key, url}`. The fix is completing the object per [Methods](https://api.onlyoffice.com/docs/docs-api/usage-api/methods.md), not catching the exception |
| Opening version N-1 after N has been saved shows N's content (or the diff is empty/identical) | A revision's stored "snapshot" path actually aliases the live document's current path, so every past version resolves to whatever was saved most recently — see [history.md](history.md); verify by diffing the two versions' actual served bytes, not just their metadata rows |

*Security*
| Symptom / check | Cause |
| :--- | :--- |
| The signing secret is reachable by the browser — signed in page JS, or served by an endpoint the page calls | Every visitor then holds it, so every visitor can forge a config. The server assembles and signs; the page receives it already signed ([Browser](https://api.onlyoffice.com/docs/docs-api/additional-api/signature/browser.md)) |
| Anyone who can reach the URL can make the backend download a file from anywhere they name | The callback fetches `url` before verifying the body token - by then the request has already been made ([Callback handler](https://api.onlyoffice.com/docs/docs-api/usage-api/callback-handler.md), [Token in body](https://api.onlyoffice.com/docs/docs-api/additional-api/signature/request/token-in-body.md)) |
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
| Legacy `.doc`/`.xls`/`.ppt` opens read-only, or is rejected | The format table's `auto-convert` action is unread; support was decided by a hand-typed extension list instead — `web-converter` skill's [Conversion tables](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/conversion-tables.md) |

**Deliverable shape:**

**Audit:** a ranked list of findings, each one *symptom (theirs or yours) -> cause -> the change it needs*, plus an explicit note of what you checked and found sound. No rewrite, no restructuring their app.

**Debug:** the corrected code **and** the rule that explains the symptom, stated in a sentence they can reuse. If the fix touches a contract they'll hit again - the `{"error": 0}` acknowledgement, key rotation, verify-before-fetch - name it as a rule, not as a line you happened to change.
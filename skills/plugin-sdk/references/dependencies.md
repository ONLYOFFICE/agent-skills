# Third-party dependencies

Anything imported beyond the six specifiers the portal provides ([react.md → Bundling](react.md#bundling)) is compiled into `plugin.js`, shipped inside the 5 MB archive, and executed in the portal's own window — its DOM, its cookies, the signed-in user's session. Both halves of that matter, and they pull in opposite directions.

**Do not hand-write what a well-known library already does.** Archive formats, PDF or spreadsheet output, HTML sanitising, markdown, date arithmetic, charts, fuzzy search, diffing — a few hundred lines of your own is a few hundred lines of unreviewed edge cases (zip64, CRC, DST, XSS), and they surface on the user's real file rather than on the one you tested. Take the established package and spend the effort on the feature.

**The bar for adding one is high**, and it is cleared before the import is written, not after. Everything below is one command each:

```sh
npm view <pkg> version license dependencies dist.unpackedSize time.modified
curl -s https://api.npmjs.org/downloads/point/last-week/<pkg>
```

| Take it only if | Because |
|---|---|
| It is the obvious, widely used choice — millions of weekly downloads, or the de-facto standard for the job | download count is the closest thing npm has to a review process; an obscure package with a plausible name is how typosquats and supply-chain payloads arrive |
| You verified the name on the registry rather than recalling it | a misremembered name is an unclaimed name, and unclaimed names get claimed |
| It was published within the last year or two and has a maintainer behind it | |
| The licence is permissive — MIT, ISC, Apache-2.0, BSD, MPL-2.0 | the plugin redistributes the code |
| Few or no transitive dependencies, and no install scripts | every transitive dependency runs in the portal too, on the same session |
| It runs in a browser — no `fs`, `path`, Node `crypto`, no build-time polyfill of a Node built-in | there is no shim in the portal, and a bundled polyfill is bulk for nothing |
| `plugin.js` still ends well under 5 MB — prefer the leaner of two good options | the limit is enforced server-side, on upload |

If nothing well known fits, write the minimum yourself and say so in the report. An unknown package is worse than 200 lines of your own; a popular one is better than 700.

**And nothing at all for what the platform already provides**: `fetch`, `Intl.DateTimeFormat`/`NumberFormat`/`RelativeTimeFormat`, `URL`/`URLSearchParams`, `structuredClone`, `crypto.randomUUID`/`crypto.subtle`, `TextEncoder`/`TextDecoder`, `Blob`/`File`/`FileReader`, `CompressionStream`, `Intl.Collator` for sorting, the `Array`/`Object` methods (no lodash for `groupBy`) — or anything the kit already renders.

The recurring needs, with the package that is the usual answer. Each is browser-first and has no runtime dependencies of its own — and each has a documented edge it does *not* handle, which is the plugin's job to handle instead, because these are the cases that reach a real user's real file:

| Need | Package | Licence | What it leaves to you |
|---|---|---|---|
| Zip read/write, deflate, gzip | `fflate` | MIT | **Encrypted entries** — it ignores the general-purpose bit-0 flag and inflates a password-protected entry as if it were plain, failing with a codec error: read the flag yourself and say the archive is protected. **Non-ASCII names** — without bit 11 they are decoded as latin1, so an older archiver's Cyrillic or CJK name arrives as mojibake |
| Sanitising HTML before it reaches the DOM | `dompurify` | MPL-2.0 or Apache-2.0 | It sanitises HTML, not URLs or CSS you interpolate yourself; and it needs a DOM, so nothing about it works in a class-side callback |
| Markdown to HTML | `marked` | MIT | It does **not** sanitise — the output goes through `dompurify` before it reaches `innerHTML` |
| Date arithmetic beyond `Intl` | `date-fns` | MIT | Time zones are a separate package (`date-fns-tz`); portal timestamps are UTC and the user's zone is theirs |
| Validating a foreign JSON payload at runtime | `zod` | MIT | Nothing, but it is only worth its bytes for input you do not control |

Confirm version and licence with the commands above rather than trusting this table — it ages, and the check costs one call. And whenever a library is recommended here or chosen by you, **say in the report what it does not cover**: a dependency taken on the user's behalf with an unstated blind spot is how a silent bug gets shipped with a clean validator run.

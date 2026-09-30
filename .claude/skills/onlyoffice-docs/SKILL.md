---
name: onlyoffice-docs
description: >
  Navigate the ONLYOFFICE API documentation (api.onlyoffice.com, or the docs stand while
  production has no Markdown pages) while working on the skills of this repository: find the
  page that states a signature, field, default, enum value, endpoint or event, print it or one
  heading of it, and check whether production serves the Markdown docs at all. Use when writing
  or correcting a reference of embed-sdk or plugin-sdk, when a claim in a skill must be checked
  against the docs, when a reference needs a docs link, when deciding whether a passage
  duplicates the docs and can become a pointer, or when someone asks "is the documentation live
  on production", "what does the docs page for X say", "find the docs page about Y".
  Repository-internal; not shipped in the plugin.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/docs.mjs *)
---

# Navigate the ONLYOFFICE API documentation

The docs site publishes every page as Markdown (`<page-url>.md`) and an index per section
(`<section>/llms.txt`). `scripts/docs.mjs` reads them from production (`apiSite` in the root
`sources.json`) and, while production has no Markdown twins, from the stand (`apiSiteFallback`).
The shipped skills describe the site by URL and never depend on this script; this script is how
their authors check what the site says.

```
node .claude/skills/onlyoffice-docs/scripts/docs.mjs status                                # production vs stand, per section
node .claude/skills/onlyoffice-docs/scripts/docs.mjs sections                              # the sections of the site
node .claude/skills/onlyoffice-docs/scripts/docs.mjs find uploader mode --section embed-sdk # pages whose title, URL or summary contain every word
node .claude/skills/onlyoffice-docs/scripts/docs.mjs page TFrameConfig                     # a type name, a site path (docspace/…, no leading slash) or a URL
node .claude/skills/onlyoffice-docs/scripts/docs.mjs page SDKInstance --toc                # headings only, then --heading <text> for one part
node .claude/skills/onlyoffice-docs/scripts/test-docs.mjs                                  # offline self-test of the parsers
```

Section aliases for `--section`: `embed-sdk`, `plugins-sdk`, `rest`, `mcp`, `docs-api`,
`office-api`, `plugins`, `macros`, `ai`, `document-builder`, `desktop`. `--host <origin>` pins a
site (a local docs build); `--refresh` bypasses the one-hour cache.

## Working rules

1. **Search before you fetch.** `find` costs one index read; a `page` read costs the page (the
   generated reference pages run from 2 KB to 40 KB). Take `--toc` first and `--heading <text>`
   for the part you need. When no page carries every word, `find` lists the closest ones by
   words matched — a page title (`Uploader mode`, `TFrameEvents`) is the most reliable query.
2. **Read the first output line.** `FALLBACK` means the stand answered because production has
   no Markdown docs yet. `generated from: … (branch X)` on a reference page names the source
   branch the page was generated from — compare it with the branch the skill targets before
   treating a difference as a documentation error.
3. **A skill passage that repeats a docs page is a pointer, not a copy.** When `page` shows the
   same field table or signature the reference carries, the reference keeps only what the page
   does not say — the portal's behaviour, the trap, the silent failure — and links the page.
   A link goes into the text as a production URL (`apiSite`), never a stand URL; run
   `node tools/sync-sources.mjs --check` afterwards.
4. **When the docs and a skill disagree**, check the SDK source the page was generated from and
   the client before changing either; a docs page generated from an older branch is stale, not
   wrong, and a hand-written guide page (`embedding-modes/*`, `samples/*`) can lag the SDK.
5. **`status` is a release gate** (RELEASING.md step 2b): exit 0 means production serves
   `llms.txt` and a Markdown page for every section; 1 means only the stand does; 2 means neither.

## What is where

- `docspace/javascript-sdk` (Embed SDK): guides under `embedding-modes/*` and `get-started/*`,
  the generated reference under `usage-sdk/{classes|type-aliases|enumerations|variables}` (a type
  or class name is its page name), samples under `samples/*`.
- `docspace/plugins-sdk` (Plugins SDK): `usage-sdk/coding-plugin/{interfaces,react,enums}` — an
  interface (`IContextMenuItem`) or an enum (`Actions`) is its page name.
- `docspace/api-backend` (REST API): one page per operation; `find` with the resource and the
  verb (`find rooms create --section rest`).
- `docs/*`: the ONLYOFFICE Docs editor family — Docs API, Office API, editor plugins and macros,
  Document Builder, Desktop Editors.

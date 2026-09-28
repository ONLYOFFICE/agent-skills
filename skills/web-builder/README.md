# ONLYOFFICE Web Builder skill

A skill that teaches an AI coding agent to call the **ONLYOFFICE Docs Document Builder API**: generating documents, spreadsheets, presentations and PDFs by having the Document Server run a `.js` builder script (`POST /docbuilder`), with no editor session involved - an invoice from an order row, a quarterly report from a query, a contract from a template, a tracked-changes comparison of two files. The sibling **[`web-converter`](../web-converter/README.md)** skill covers turning an existing file into another format; **[`doceditor`](../doceditor/README.md)** covers the live editor.

The builder contract fails quietly in its own ways, several of them by looking like the converter: a poll that re-sends `url` instead of the `key` the first response returned queues a new job every time and never finishes; a progress bar wired to a `percent` field that this service never sends shows nothing or something made up; with JWT on, an `argument` sent next to the token instead of inside it reaches the script as nothing; a script assembled by concatenating customer data into JavaScript breaks on the first apostrophe and is an injection hole besides; and a flat "generation failed" throws away the difference between a script bug (`-3`), an unreachable URL (`-4`) and a bad token (`-8`). This skill encodes those rules. The body is [`SKILL.md`](SKILL.md).

## Installing it

As part of the `onlyoffice` plugin - see [Install](../../README.md#install) in the root README. On its own: copy this directory to where your agent scans for skills (for example `~/.claude/skills/web-builder/`), or hand it `SKILL.md`.

## What it targets

The ONLYOFFICE Docs Document Builder API, **v8.2+**. Built from the official docs at
[Document Builder API](https://api.teamlab.info/docs/docs-api/additional-api/document-builder-api.md), with the behaviours the page doesn't spell out (the server-issued key, token-only parameters, the error mapping, the temporary result links) checked against `builderRequest` in the Document Server's `DocService/sources/converterservice.js`.

## Layout

This skill is **one file**: [`SKILL.md`](SKILL.md) links directly to the official API, signature and script-file pages (as Markdown, via `api.teamlab.info`) rather than keeping a local paraphrase of them - the "Core rules" section is the only original content, covering what those pages state as fields but not as consequences. No `references/` directory: there's nothing here that isn't either the official spec (linked, not copied) or a short rule in `SKILL.md` itself.

## Relationship to `web-converter`, `doceditor` and `doceditor-integration`

All ship together in the `onlyoffice` plugin. `web-converter` is "take file A, hand back file B"; this skill is "run this script, hand back the files it made" - the two services share a Document Server and a JWT scheme but not a request shape, and the most common builder bug is carrying converter habits over, so `SKILL.md` names the differences explicitly. A task that needs both (generate a docx, then convert it to PDF - though a script can `SaveFile("pdf", ...)` directly) draws on both skills.

## Maintaining it

There's no local copy of the spec to go stale - `SKILL.md` links straight to the live pages. On every Docs API release: skim the Document Builder API page and `builderRequest` for anything that changed shape (a `percent` field, a new error code, a change to how the key is issued), update "Core rules" if a consequence changed, and bump the version in `SKILL.md`'s description and intro (currently v8.2+). Run the [evals](evals/README.md) after any content change.

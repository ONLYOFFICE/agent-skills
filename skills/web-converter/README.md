# ONLYOFFICE Web Converter skill

A skill that teaches an AI coding agent to call the **ONLYOFFICE Docs Conversion API**: converting a document from one format to another (`docx` -> `pdf`, `csv` -> `xlsx`, ...) via a single HTTP call to the Document Server, with no editor session involved. Split off from the sibling **[`doceditor`](../doceditor/README.md)** skill so a task that's purely "convert this file" doesn't have to pull in the config payload, callback handler, and Command Service that only matter once a live editing session is in the picture. The sibling **[`doceditor-integration`](../doceditor-integration/README.md)** skill's own generated `/convert` route defers back to this skill for that route's internals.

The conversion contract fails quietly in its own ways: with JWT on, a parameter sent next to the token instead of inside it is silently dropped; a progress bar bound to `percent` sits at zero, because the server only ever sends `0` or `100`; a poll that mints a fresh `key` per attempt restarts the job from zero instead of reading its progress; a flat "conversion failed" message throws away the difference between a bad pair (`-7`, permanent) and a bad token (`-8`, also permanent but for a different reason) and a password issue (`-5`, fixable by the caller). This skill encodes those rules. The body is [`SKILL.md`](SKILL.md).

## Installing it

As part of the `onlyoffice` plugin - see [Install](../../README.md#install) in the root README. On its own: copy this directory to where your agent scans for skills (for example `~/.claude/skills/web-converter/`), or hand it `SKILL.md`.

## What it targets

The ONLYOFFICE Docs Conversion API, **v8.2+**. Built from the official docs at
[Conversion API](https://api.teamlab.info/docs/docs-api/additional-api/conversion-api.md), with the behaviours the pages don't spell out (JSON vs XML by endpoint, token-only parameters, the header fallback, `percent`) checked against `convertRequest` and `fillResponse` in the Document Server source.

## Layout

This skill is **one file**: [`SKILL.md`](SKILL.md) links directly to the official request/response/error-codes/conversion-tables/signature pages (as Markdown, via `api.teamlab.info`) rather than keeping a local paraphrase of them - the "Core rules" section is the only original content, covering what those pages state as fields but not as consequences (token-only parameters, same-key polling, `percent` being 0-100, `-7`/`-8`/`-5` staying distinct). No `references/` directory: there's nothing here that isn't either the official spec (linked, not copied) or a short rule in `SKILL.md` itself.

## Relationship to `doceditor` and `doceditor-integration`

All three skills ship together in the `onlyoffice` plugin. `doceditor` covers the interactive Document Editor's own API contract - config payload, callback, JWT, Command Service - for wiring the editor into an app that already exists. `doceditor-integration` covers generating a whole sample/demo integration from scratch (scaffolding, UI, infra, testing), building each piece per `doceditor`'s contract and, for its `/convert` route, per this skill's. This skill covers standalone format conversion - a task shaped like "take file A, hand back file B," with no editor in the picture. A build that needs more than one (an editor with a legacy format auto convert on upload path, say) draws on the relevant skills together; none duplicates another's reference files.

## Maintaining it

There's no local copy of the spec to go stale - `SKILL.md` links straight to the live pages. On every Docs API release: skim the linked pages for anything that changed shape, update "Core rules" if a consequence changed, and bump the version in `SKILL.md`'s description and intro (currently v8.2+).

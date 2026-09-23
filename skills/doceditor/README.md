# ONLYOFFICE Document Editor API skill

A skill that teaches an AI coding agent the **ONLYOFFICE Document Editor's own API contract** (`DocsAPI.DocEditor`): embedding the editor in a web page, assembling the `config`/`document`/`editorConfig`/`events` payload, implementing the `callbackUrl` handler, signing JWT tokens (browser, header, body), and calling the server-to-server Command Service. Two adjacent concerns live in sibling skills instead: generating a whole sample/demo integration from scratch - project scaffolding, a file-list UI on `docspace-ui-kit-react`, Docker/nginx/compose, hexagonal architecture, the testing methodology — is the sibling **[`doceditor-integration`](../doceditor-integration/README.md)** skill; standalone document format conversion with no editor session is the sibling **[`web-converter`](../web-converter/README.md)** skill.

The API fails quietly in its own ways. A stale `document.key` reused across a save corrupts the file's revision history instead of erroring; a `callbackUrl` handler that returns anything other than exactly `{"error": 0}` makes the editing service retry forever, mistaking a bug for a network blip; a JWT signed in frontend code leaks the secret in a browser bundle. This skill encodes those rules. The body is [`SKILL.md`](SKILL.md).

## Installing it

As part of the `onlyoffice` plugin — see [Install](../../README.md#install) in the root README. On its own: copy this directory to where your agent scans for skills (for example `~/.claude/skills/doceditor/`), or hand it `SKILL.md`.

## What it targets

ONLYOFFICE Docs API **v8.2+**. Built from the official docs at
[`api.teamlab.info/docs/docs-api/`](https://api.teamlab.info/docs/docs-api/get-started/basic-concepts.md).

## Layout

This skill is **one file**: [`SKILL.md`](SKILL.md) links directly to the official DocEditor/Config/Events/Callback-handler/Command-service/Signature pages (as Markdown, via `api.teamlab.info`) rather than keeping a local paraphrase of each.

## Relationship to the sibling skills

This skill is scoped to *using* the API correctly, wherever it's called from. `doceditor-integration` is the one that decides whether a whole sample app gets a UI, scaffolds its project layout, and tests the generated result end to end - it comes back to this skill for the API contract as it builds each piece. `web-converter` is the standalone Conversion API, with no editor session in the picture. All three ship together in the `onlyoffice` plugin, so a task that spans them (a full sample app with an auto convert on upload path, say) draws on all three without any of them duplicating another's content.

## Maintaining it

There's no local copy of the spec to go stale - `SKILL.md` links straight to the live pages. On every Docs API release: skim the linked pages for anything that changed shape, update "Core rules" or the fault catalogue if a consequence changed, and bump the version in `SKILL.md`'s description and intro (currently v8.2+).

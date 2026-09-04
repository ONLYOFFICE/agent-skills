# ONLYOFFICE Docs API skill

A skill that teaches an AI coding agent to integrate the **ONLYOFFICE Docs API** (`DocsAPI.DocEditor`): embedding the editor in a web page, assembling the `config`/`document`/`editorConfig`/`events` payload, implementing the `callbackUrl` handler, signing JWT tokens (browser, header, body), and calling the server-to-server APIs (Command Service, Conversion API).

The integration fails quietly in its own ways. A stale `document.key` reused across a save corrupts the file's revision history instead of erroring; a `callbackUrl` handler that returns anything other than exactly `{"error": 0}` makes the editing service retry forever, mistaking a bug for a network blip; a Conversion API request missing `Accept: application/json` gets silently answered in XML instead of failing outright; a JWT signed in frontend code leaks the secret in a browser bundle. This skill encodes those
rules, routes to the right reference file instead of dumping everything at once, and defaults every code-generation task to a reusable backend over a throwaway sample UI. The body is [`SKILL.md`](SKILL.md).

## Installing it

As part of the `onlyoffice` plugin — see [Install](../../README.md#install) in the root README. On its own: copy this directory to where your agent scans for skills (for example `~/.claude/skills/docs/`), or hand it `SKILL.md`.

## What it targets

ONLYOFFICE Docs API **v8.2+**. Built from the official docs at
[`api.onlyoffice.com/docs/docs-api/`](https://api.onlyoffice.com/docs/docs-api/get-started/basic-concepts); every reference file links back to the live page it was built from for edge cases not covered below.

## Layout

* **SKILL.md**: The master skill router. Inherits all core rules and injects context into reference files.

### Architecture & Infrastructure
* **architecture.md**: Hexagonal architecture (Ports & Adapters) blueprint for backend generation.
* **infrastructure/**: Implementation assets.
    * `Dockerfile` / `Makefile` / `.gitignore`
    * Backend-first generation architecture.

### Configuration & Security
* **configuration/**: The `config` payload structure (`document`, `editorConfig`, `events`).
* **signature/**: JWT signature schemes and token structure across browser, body, and header vectors.
* **callback/**: The `callbackUrl` handling contract.

## Core API References
* **api.md**: Client bootstrap entry point. Covers script loading, iframe sandboxing, and `DocsAPI.DocEditor(id, config)`.
* **methods.md**: Programmatic API actions executed against a live `docEditor` instance.
* **automation.md**: Automation API features (connectors, `executeMethod`, `callCommand`, UI extensions, modal windows).
* **additional/**: Command Service specifications and the 4-file Conversion API framework.

## Implementation & Testing
* **example.md**: The server integration architecture (based on the official Node.js sample).
* **example-checklist.md**: Language-agnostic functional checklist for sample apps.
* **api-testing.md**: Backend contract-first testing methodology.

## Maintaining it

Every reference file is hand-synced against its own "Reference Documentation Map" links under `api.onlyoffice.com/docs/docs-api/`. On every Docs API release: diff the changed live pages against the matching reference file, update the fields/behavior that moved, and bump the version in `SKILL.md`'s description and intro (currently v8.2+). Keep cross-file links canonical to their path under `references/` (e.g. `signature/body.md`,
not a `../`-relative label) so `SKILL.md`'s Knowledge base list and the in-file "Parent Skill"/"Baseline" pointers stay in sync with each other.

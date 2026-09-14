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

* **SKILL.md**: The master skill router - the task-shape table, the Definition of Done, and the always-apply core rules. Every file below is reached from here, never read standalone.

### Architecture & Infrastructure
* **architecture/hexagonal.md**: Ports & Adapters blueprint for backend generation — domain/use-case/port/adapter boundaries, a worked example, and the per-language mapping (TS, Rust, Java, Kotlin, Go).
* **infrastructure/**: reference guides for the generated build/deploy assets — not the assets themselves.
    * `docker.md` — writing the Dockerfile: base image selection, multi-stage builds, layer caching, Dockerfile-side security audit.
    * `compose.md` — running the built image(s) together: docker-compose service topology, networking, environment/secrets wiring, runtime hardening (`read_only`/`cap_drop`/`tmpfs` and how they interact with a non-root user), and the ONLYOFFICE Document Server address-split for local compose stacks.
    * `nginx.md` — the reverse proxy in front of the stack: CORS, CSP (the editor iframe's `frame-src`/`connect-src`), TLS/cookies, and proxying Document Server itself.
    * `makefile.md` — `Makefile` conventions and the required base recipes.
    * `gitignore.md` — `.gitignore` formatting and the pattern categories every generated project needs.
    * `backend.md` — scope decision: generate the reusable backend by default, a sample UI only when asked, kept removable behind its own module/flag.

### Configuration & Security
* **configuration/**: the root `config` payload, one file per section — `config.md` (root object), `document.md` (`document`), `editor.md` (`editorConfig`), `events.md` (`events`, including the history event pair: `onRequestHistory`/`refreshHistory` for the list, `onRequestHistoryData`/`setHistoryData` for one version's diff — a distinct pair from `onRequestRestore`).
* **signature/**: JWT signature schemes — `signature.md` (which of the three vectors a given caller uses), plus `browser.md`, `body.md`, `header.md` for each vector.
* **callback/handler.md**: the `callbackUrl` handling contract — status table, the `{"error": 0}` acknowledgement rule, token verification order.

### Core API References
* **api.md**: Client bootstrap entry point. Covers script loading, iframe sandboxing, `DocsAPI.DocEditor(id, config)`, and the component-framework placeholder-ownership hazard (a framework-owned placeholder node crashes the framework's own render layer once the SDK replaces it out from under it).
* **methods.md**: Programmatic API actions executed against a live `docEditor` instance.
* **automation.md**: Automation API features (connectors, `executeMethod`, `callCommand`, UI extensions, modal windows).
* **additional/**: `command.md` (Command Service) plus `conversion/` — `conversion.md`, `request.md`, `response.md`, `errors.md`, `table.md` (the vendored format-pair matrix).

### Implementation & Testing
* **example.md**: The server integration architecture (based on the official Node.js sample).
* **templates.md**: Sourcing blank/sample files per format from the vendored `ONLYOFFICE/document-templates` repo, rather than hand-authoring or generating them.
* **ui.md**: The design bar for a generated UI — port vs. designed app, where the tokens come from, and the state/responsive/accessibility/motion requirements.
* **example-checklist.md**: Language-agnostic functional checklist for sample apps.
* **api-testing.md**: Backend-first testing methodology (static -> unit -> integration -> E2E -> mutation -> adversarial review), including the required Playwright E2E pass whenever a sample UI exists — host-page interactions around the mounted editor, opening a specific history version (not just listing it), and a dedicated visual/glitch verification pass against `ui.md`'s bar.
* **audit.md**: Reviewing or debugging an integration someone else wrote — symptom-to-cause catalogue and review discipline.

## Maintaining it

Every reference file is hand-synced against its own "Reference Documentation Map" links under `api.onlyoffice.com/docs/docs-api/`. On every Docs API release: diff the changed live pages against the matching reference file, update the fields/behavior that moved, and bump the version in `SKILL.md`'s description and intro (currently v8.2+). Keep cross-file links canonical to their path under `references/` (e.g. `signature/body.md`,
not a `../`-relative label) so `SKILL.md`'s Knowledge base list and the in-file "Parent Skill"/"Baseline" pointers stay in sync with each other.

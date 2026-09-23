# ONLYOFFICE Document Editor Integration Examples skill

A skill that teaches an AI coding agent to **generate a whole ONLYOFFICE Document Editor sample/demo integration from scratch**: the reusable-backend-vs-sample-UI scope decision, project scaffolding (hexagonal architecture, a language-neutral template), a UI built on `docspace-ui-kit-react` or the official React/Angular/Vue component, Docker/nginx/compose infrastructure, vendored template and format-table sourcing, and the testing methodology for the result. Split off from the sibling **[`doceditor`](../doceditor/README.md)** skill, which owns the editor's own API contract (config payload, JWT, callback, Command Service) that every piece this skill scaffolds is built against — and from the sibling **[`web-converter`](../web-converter/README.md)** skill, which a generated `/convert` route defers to.

Generated integrations fail in their own ways: a sample UI that quietly ships a bare editor snippet instead of the reference app's full feature set; a Dockerfile that "should build" but was never actually run; a conversion capability written only as an internal step with no route an integrator can call on demand; a test suite that asserts shape (status code, response type) rather than the behavior a mutation-testing pass would catch missing. This skill encodes those rules and routes to the right reference file instead of dumping everything at once. The body is [`SKILL.md`](SKILL.md).

## Installing it

As part of the `onlyoffice` plugin — see [Install](../../README.md#install) in the root README. On its own: copy this directory to where your agent scans for skills (for example `~/.claude/skills/doceditor-integration/`), or hand it `SKILL.md`.

## What it targets

ONLYOFFICE Docs API **v8.2+**, via the official Node.js sample app's architecture. Built from
[`api.onlyoffice.com/docs/docs-api/`](https://api.onlyoffice.com/docs/docs-api/get-started/basic-concepts) and the [`document-server-integration`](https://github.com/ONLYOFFICE/document-server-integration) repo; every reference file links back to the live page or repo it was built from for edge cases not covered below.

## Layout

Unlike the sibling `doceditor` and `web-converter` skills, this one keeps a `references/` directory: scaffolding, architecture, testing methodology, and UI design are this skill's own original content with no official-docs page to link to instead. Where an official page *does* cover something (the framework components below), `SKILL.md` links straight to it rather than keeping a local copy.

* **SKILL.md**: The master skill router — the Definition of Done and the always-apply core rules. Every file below is reached from here, never read standalone.

### Starter Template
* **templates/**: language-agnostic starting point — copy from here instead of freehand-authoring the project skeleton and infra boilerplate each session.
    * `README.md` — how to use the directory; how it relates to the prose guides it's derived from.
    * `structure.md` — the hexagonal project skeleton instantiated for an ONLYOFFICE integration (one folder per contract endpoint).
    * `endpoints.md` — the five-route contract (method, path, schema pointer) in one table.
    * `Dockerfile.template`, `docker-compose.yml.template`, `nginx.conf.template`, `Makefile.template`, `.gitignore.template`, `.env.example.template` — fill-in-the-blank infra files consistent with the guides in `infrastructure/`.
    * `scaffold.py` — pinned wrapper around ONLYOFFICE's official [`create-app`](https://github.com/ONLYOFFICE/create-app) generator, for when the whole stack (frontend and backend) is Next.js/React/TypeScript — not merely a React frontend paired with a different-language backend.

### Architecture & Infrastructure
* **references/architecture/hexagonal.md**: Ports & Adapters blueprint for backend generation — domain/use-case/port/adapter boundaries, a worked example, and the per-language mapping (TS, Rust, Java, Kotlin, Go).
* **references/infrastructure/**: reference guides for the generated build/deploy assets — not the assets themselves.
    * `docker.md` — writing the Dockerfile: base image selection, multi-stage builds, layer caching, Dockerfile-side security audit.
    * `compose.md` — running the built image(s) together: docker-compose service topology, networking, environment/secrets wiring, runtime hardening, and the ONLYOFFICE Document Server address-split for local compose stacks.
    * `nginx.md` — the reverse proxy in front of the stack: CORS, CSP (the editor iframe's `frame-src`/`connect-src`), TLS/cookies, and proxying Document Server itself.
    * `makefile.md` — `Makefile` conventions and the required base recipes.
    * `gitignore.md` — `.gitignore` formatting and the pattern categories every generated project needs.
    * `backend.md` — scope decision: generate the reusable backend by default, a sample UI only when asked, kept removable behind its own module/flag.

### UI & Components
* **The official `@onlyoffice/document-editor-*` component for each framework** — [React](https://api.teamlab.info/docs/docs-api/get-started/frontend-frameworks/react.md), [Angular](https://api.teamlab.info/docs/docs-api/get-started/frontend-frameworks/angular.md), [Vue](https://api.teamlab.info/docs/docs-api/get-started/frontend-frameworks/vue.md) — linked directly from `SKILL.md`, not copied locally: install, props/inputs, a usage example, and framework-specific caveats. Real, Apache-2.0, public npm packages, unlike `dependencies/kit.md` — no license question. Default to these for a matching target; the sibling `doceditor` skill's manual pattern is the fallback for everything else.
* **references/ui.md**: The design bar for a generated UI — port vs. designed app, always built on `dependencies/kit.md`'s dependency regardless of requested style, plus the state/responsive/accessibility/motion bar itself.
* **references/dependencies/kit.md**: The single source of truth for ONLYOFFICE's own `docspace-ui-kit-react` — what it is, how to install and verify it as a real dependency, and its live AGPL license check gating direct-dependency-vs-token-port every session.

### Implementation & Testing
* **references/example.md**: The server integration architecture (based on the official Node.js sample).
* **references/templates.md**: Sourcing blank/sample files per format from the vendored `ONLYOFFICE/document-templates` repo, rather than hand-authoring or generating them.
* **references/example-checklist.md**: Language-agnostic functional checklist for sample apps.
* **references/api-testing.md**: Backend-first testing methodology (static -> unit -> integration -> E2E -> mutation -> adversarial review), including the required Playwright E2E pass whenever a sample UI exists.

## Relationship to the sibling skills

This skill decides *what* gets built and *how it's structured* — project layout, the backend/UI scope call, infra, testing. It is not the authority on whether any one piece is *correct*: the config payload, JWT signing, the callback contract, and the Command Service are the sibling **`doceditor`** skill's, and the Conversion API backing a generated `/convert` route is the sibling **`web-converter`** skill's. All three ship together in the `onlyoffice` plugin, so a full build draws on all three without any of them duplicating another's reference files.

## Maintaining it

Every reference file is hand-synced against its own "Reference Documentation Map" links and the [`document-server-integration`](https://github.com/ONLYOFFICE/document-server-integration) sample repo. On every Docs API release: diff the changed live pages/repo against the matching reference file, update the fields/behavior that moved, and bump the version in `SKILL.md`'s description and intro (currently v8.2+).

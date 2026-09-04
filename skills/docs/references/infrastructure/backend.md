# Backend-First Generation Skill Guide

## Context & Purpose

When generating an integration or example, the reusable backend and any frontend/sample UI are two different deliverables with two different audiences — a third-party system integrates against the backend; a human looks at the UI. Default to the one with the wider audience.

## Reference Documentation Map

* **Concrete application:** [`example.md`](../example.md)'s "Optional Sample UI" section — this exact rule applied to ONLYOFFICE integrations, plus the reference shape to follow when a full sample UI is actually asked for.
* **Boundary discipline once a UI exists:** [`architecture/hexagonal.md`](../architecture/hexagonal.md) — keeping UI-only concerns out of the domain/use-case layer.
* **Testing scope follows this same split:** [`api-testing.md`](../api-testing.md) — backend/server-to-server phases always run; client/DOM/Playwright phases only when a UI was actually generated.

## Documentation Query Rules

* **Baseline:** This guide is self-sufficient — a repo-local convention, not a wrapped third-party API.
* **Fallback:** None — there's no external doc to check. If a request doesn't fit the decision table below, ask rather than guess.

## Decision Table

| Signal in the request | Generate |
| :--- | :--- |
| No mention of a UI, page, or demo | Backend only |
| "Does it work?" / "test the backend" / "show me the endpoints" | Backend only — point at the endpoints or a health check, not a page |
| "Sample app" / "demo" / "show me it working" / names a page directly | Backend + a UI — see **Scope the UI** below before building |
| Integration-partner framing ("a system that calls into…", "for any third-party system") | Backend only, designed for an external caller |

## Rules

* **Generate the backend by default.** The reusable API surface — the endpoints a third-party system would actually call — is the deliverable unless told otherwise.
* **Keep the UI removable, not entangled.** Put it behind its own module/feature flag/build target so the backend still compiles, ships, and is consumable standalone with the UI fully absent — not just unrouted. A third-party integrator should never need to pull in demo-page code to use the backend.
* **Scope the UI before building it.** A minimal page proving the integration works and a full admin-style sample UI (file listing, per-item actions, user/language pickers, …) are different amounts of work with different backend requirements — the latter usually needs list/delete/rename endpoints the bare integration doesn't. Confirm which one before building the larger one rather than assuming it.

## Anti-Patterns

* Shipping a `GET /` demo page as part of "the backend" with no way to omit it.
* Building a full admin-style sample UI when a one-line "it works" check would have answered the actual question.
* Letting UI-only concerns (a page's asset URLs, its own presentation state) leak into the domain/use-case layer meant to be reused.
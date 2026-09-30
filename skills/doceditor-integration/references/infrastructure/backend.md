# Backend generation

## Context & Purpose

When generating an integration or example, the reusable backend and any frontend/sample UI are two different deliverables with two different audiences - a third-party system integrates against the backend; a human looks at the UI. Default to the one with the wider audience.

## Reference Documentation Map

* **Concrete application:** [`example.md`](../example.md)'s "Optional Sample UI" section - this exact rule applied to ONLYOFFICE integrations, plus the reference shape to follow when a full sample UI is actually asked for.
* **Boundary discipline once a UI exists:** [`architecture/hexagonal.md`](../architecture/hexagonal.md) - keeping UI-only concerns out of the domain/use-case layer.
* **Testing scope follows this same split:** [`api-testing.md`](../api-testing.md) - backend/server-to-server phases always run; client/DOM/Playwright phases only when a UI was actually generated.

## Documentation Query Rules

* **Baseline:** This guide is self-sufficient - a repo-local convention, not a wrapped third-party API.
* **Fallback:** None - there's no external doc to check. If a request doesn't fit the decision table below, ask rather than guess.

## Decision Table

| Signal in the request | Generate |
| :--- | :--- |
| No mention of a UI, page, or demo | Backend only |
| "Does it work?" / "test the backend" / "show me the endpoints" | Backend only - point at the endpoints or a health check, not a page |
| "Sample app" / "demo" / "show me it working" / names a page directly | Backend + a UI - see **Scope the UI** below before building |
| Integration-partner framing ("a system that calls into...", "for any third-party system") | Backend only, designed for an external caller |

## Rules

* **Generate the backend by default.** The reusable API surface - the endpoints a third-party system would actually call - is the deliverable unless told otherwise.
* **Keep the demo dashboard removable, not entangled.** Put it behind its own module/feature flag/build target so the backend still compiles, ships, and is consumable standalone with the dashboard fully absent - not just unrouted. A third-party integrator should never need to pull in demo code to use the backend.
* **Split by audience, not by "is it HTML".** The backend is the five endpoints ([`example.md`](../example.md)'s Endpoints) - and one of them is the embedding page, because an integrator links or iframes the editor for a file its own system already lists. The removable side is the dashboard *and* the routes only it calls: file listing, create-new, rename, delete. The two ways to get this backwards both look tidy: compiling the embedding page out with the dashboard (the integrator loses the editor), or leaving list/rename/delete registered on the backend router (the dashboard's API ships to every integrator).
* **Scope the UI before building it.** A minimal page proving the integration works and a full admin-style sample UI (file listing, per-item actions, user/language pickers, ...) are different amounts of work with different backend requirements - the latter usually needs list/delete/rename endpoints the bare integration doesn't. Confirm which one before building the larger one rather than assuming it.
* **Style it deliberately.** Whatever UI gets built is held to [`ui.md`](../ui.md)'s bar: always built on `docspace-ui-kit-react`, one design system settled before the first component, and no part left as bare unstyled markup because it wasn't in the reference you started from.
* **Mount the whole contract surface.** The backend's audience is a caller you'll never meet, so the callback, download, upload and convert routes all get mounted even when this deliverable's UI only exercises some of them - see [`example.md`](../example.md)'s Endpoints on why conversion in particular tends to go missing.

## Anti-Patterns

* Shipping the demo dashboard, or its list/rename/delete routes, as part of "the backend" with no way to omit it.
* Treating the embedding page as demo code and compiling it out with the dashboard.
* Building a full admin-style sample UI when a one-line "it works" check would have answered the actual question.
* A sample UI where some components carry real styling and others are left at browser defaults - an unstyled control reads as broken to whoever's clicking through it.
* Letting UI-only concerns (a page's asset URLs, its own presentation state) leak into the domain/use-case layer meant to be reused.
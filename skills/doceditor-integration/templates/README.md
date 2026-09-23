# ONLYOFFICE Backend Integration — Generic Starter Template

## Context & Purpose

A language-agnostic starting point for the **Build** task shape ([`SKILL.md`](../SKILL.md)) — the project skeleton, the five-endpoint contract, and the infra boilerplate (Dockerfile/compose/nginx/Makefile/.gitignore/.env.example) that is identical in shape for every generated backend regardless of target language. Start every Build-shape deliverable here instead of freehand-authoring the folder tree and infra files from the prose in [`architecture/hexagonal.md`](../references/architecture/hexagonal.md) and [`infrastructure/*.md`](../references/infrastructure/) each session — those files stay the authority for *why* each shape/rule exists; this directory is the literal, fill-in-the-blank starting point derived from them.

This mirrors the vendoring principle already applied to document files in [`templates.md`](../references/templates.md): a demo file is sourced from the official templates repo instead of hand-authored, so it can't drift from what a real ONLYOFFICE file looks like. The same reasoning applies here to project scaffolding — copy from a known-good starting shape instead of re-deriving the folder tree and infra boilerplate from prose each session, which is exactly where drift and omitted pieces (a route never mounted, a hardcoded secret fallback) creep in.

## What's here

* [`structure.md`](structure.md) — the project skeleton: hexagonal layers (domain/application/adapters/composition) laid out for an ONLYOFFICE integration specifically, with one folder per contract endpoint. Copy the tree, name folders/files per the target language's convention ([`hexagonal.md`](../references/architecture/hexagonal.md)'s Multi-Language Mapping), delete what a narrower request doesn't need.
* [`endpoints.md`](endpoints.md) — the five-route contract in one table (method, path, purpose, the file with its exact schema). Implement against this page rather than re-deriving the routing surface from `example.md`, `callback/handler.md`, and the `configuration/*.md` files separately.
* `Dockerfile.template`, `docker-compose.yml.template`, `nginx.conf.template`, `Makefile.template`, `.gitignore.template`, `.env.example.template` — copy, fill in the `{{PLACEHOLDER}}` tokens, delete the guidance comments. Each stays consistent with its own guide (`infrastructure/docker.md`, `compose.md`, `nginx.md`, `makefile.md`, `gitignore.md`) — read that guide for *why* a placeholder is shaped the way it is, especially before changing one.
* [`scaffold.py`](scaffold.py) — the one stack with an official generator: when the request's *entire* stack is Next.js/React/TypeScript — frontend **and** backend — run this instead of hand-porting `example.md`'s Express+EJS reference. Wraps ONLYOFFICE's own [`create-app`](https://github.com/ONLYOFFICE/create-app) scaffolder, pinned to a known-good version. **Does not apply when the backend is a different language than the frontend** (React + Rust/Go/Python/Java/…) — `create-app` scaffolds one unified Next.js project with its own backend logic (JWT signing, callback handling, persistence) living in Next.js API routes; there is no "frontend-only" mode to extract and pair with an external backend. A React frontend alongside a non-JS backend follows the normal path (steps 1-4) on both sides, same as any other language pairing.

## How to use (Build task shape)

1. Copy [`structure.md`](structure.md)'s tree into the target project, translated into the target language's file/folder conventions.
2. Copy the six template files, fill in every `{{PLACEHOLDER}}`, delete the guidance comments from each.
3. Implement each row of [`endpoints.md`](endpoints.md) against its port/use-case per `structure.md`, using the config/signature/callback reference files for exact field shapes — and the sibling `web-converter` skill for `/convert`'s.
4. Run [`example-checklist.md`](../references/example-checklist.md) before calling the result done.

**Exception — the whole stack is Next.js/React/TypeScript, backend included:** run `python3 scaffold.py <project-dir>` first; it produces a working file manager + editor page + JWT config + callback handlers already wired close to the five-endpoint contract. Treat its output as the starting point for steps 2-4 above — it still needs this skill's Definition of Done applied on top (the `/convert` route made reachable on its own per `example.md`'s Endpoints note, `JWT_SECRET` read from the environment with no hardcoded fallback, etc.), not skipped because it came from an official generator. This does not replace `example.md`'s Node.js/Express+EJS reference — that stays the path for a plain Node/Express request or one naming that stack directly; `create-app` is the path specifically when the request is Next.js/React/TypeScript **end to end**. A request naming React (or any other frontend framework) for the UI while asking for a *different* language on the backend never triggers this exception — see the note on `scaffold.py` above.

## Relationship to the rest of the skill

This directory is a **derived artifact**, not a new source of rules — `architecture/hexagonal.md` and `infrastructure/*.md` remain authoritative. If a rule here and a prose guide ever disagree, the prose guide is right and this directory has drifted; fix the drift here, don't follow the stale copy.

## Maintaining it

Whenever `hexagonal.md`'s suggested layout or an `infrastructure/*.md` guide's checklist changes, re-check every file in this directory against it — these templates exist to save re-deriving that content each session, which only holds if they stay in sync with the guides they were derived from.

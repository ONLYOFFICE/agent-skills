# The eval fixture: a bare app the scenarios build on

A Vite + React 19 + TypeScript application with nothing from the kit in it — no providers, no
components, no stylesheet. That is deliberate: setting the kit up is part of what every `build`
scenario is graded on, so the fixture must not do it for the run.

## Before a run, the operator installs the kit

`@onlyoffice/apps-ui-kit` is listed in `package.json` at the version the skill targets, so one
command does it:

```sh
npm install
```

To run the scenarios against an unreleased build of the kit, pack it in its checkout
(`pnpm build && pnpm pack`) and `npm install <path to the .tgz>` here instead.

Hand the run a copy with `node_modules/` already populated: the scenarios are about the code,
and an install that fails halfway darkens every check at once.

## What is in it

```
index.html
vite.config.ts
tsconfig.json
src/main.tsx        createRoot and nothing else — no providers
src/App.tsx         a page with a heading and room to add to
src/data/members.json   eight people, for the list scenario
```

`npm run build` type-checks and builds, and does so before any scenario touches it. If it
does not, fix the fixture rather than the run.

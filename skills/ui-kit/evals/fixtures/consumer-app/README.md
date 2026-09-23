# The eval fixture: a bare app the scenarios build on

A Vite + React 19 + TypeScript application with nothing from the kit in it — no providers, no
components, no stylesheet. That is deliberate: setting the kit up is part of what every `build`
scenario is graded on, so the fixture must not do it for the run.

## Before a run, the operator installs the kit

**This paragraph is the only place in the repository that says how the kit is installed.** It
is not on npm, so there is nothing to install by name yet:

```sh
# in a checkout of docspace-ui-kit-react, on the branch the skill is pinned to
pnpm install && pnpm build && pnpm pack      # pnpm, not npm — an npm-packed tarball has no exports map

# here
npm install
npm install ../../docspace-ui-kit-react/onlyoffice-apps-ui-kit-4.0.0.tgz
```

That second command writes the dependency into `package.json` itself, which is why this file
does not list it. When the package reaches a registry, add it to `dependencies` here, replace
the two commands above with `npm install`, and turn on the `verify` flags for the registry
source in `skills/ui-kit/sources.json`. Nothing else in the skill names an install method.

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

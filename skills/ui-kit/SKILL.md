---
name: ui-kit
description: Build React 19 screens with the ONLYOFFICE UI kit (@onlyoffice/apps-ui-kit, successor of @docspace/ui-kit) in your own web app — forms, dialogs, side panels, lists, empty states, toasts, theming and translations. Use when someone wants their app to look like ONLYOFFICE DocSpace or Apps ("a dialog in the DocSpace style", "a settings form like the portal's", "use the DocSpace components in our admin") even if they never name the kit; when they ask which kit component fits a job or what a prop is called (visible vs isVisible vs isOpen vs open); when kit components render unstyled, with empty labels, an i18n console error, a collapsed toggle, a 1px textarea or doubled spacing; when an import from the kit does not resolve or pulls in portal-only modules (selectors, billing, uploader); or when reviewing code that uses the kit. Not for plugins inside the DocSpace portal (plugin-sdk), for embedding DocSpace in an iframe (embed-sdk), or for other component libraries.
license: Apache-2.0
metadata:
  author: ONLYOFFICE
  sdk-version: "4.0.0"
---

# ONLYOFFICE UI kit

The component library ONLYOFFICE DocSpace and ONLYOFFICE Apps are built from, used from
your own React application. It is the same library the portal ships as `@docspace/ui-kit`;
outside the portal it is `@onlyoffice/apps-ui-kit`.

## Pinned facts

These are checked against the kit's own source at every release of this skill.

- **Package and version.** `@onlyoffice/apps-ui-kit` **4.0.0**, ESM only — the published
  `type` is `module` and the only build is `dist/esm`. There is no CommonJS entry point.
- **Where it comes from.** No registry carries it today. It is installed from a tarball
  (`npm i ../onlyoffice-apps-ui-kit-4.0.0.tgz`) or from a checkout of
  [`docspace-ui-kit-react`](https://github.com/ONLYOFFICE/docspace-ui-kit-react).
- **Required peers are four**: `react` and `react-dom` (^19), `i18next` (^25.5.2) and
  `react-i18next` (^15.7.3). Fifteen further peers are declared optional and are needed
  only by the portal-internal modules listed below — an application that does not import
  those does not install `mobx`, `axios`, `socket.io-client` or the rest.
- **The stylesheet arrives with the component.** Every module imports its own CSS
  (`dist/esm/components/button/Button.module.scss/index.css`), so a bundler that resolves
  CSS imports from `node_modules` — Vite, webpack 5, Next — needs no stylesheet import at
  all. `@onlyoffice/apps-ui-kit/styles.css` is the whole library in one file, 727 KB, and
  belongs only in a build that cannot do those imports.
- **98 components**, each with a `README.md` of its own shipped inside the package at
  `node_modules/@onlyoffice/apps-ui-kit/components/<folder>/README.md`.
- **89 of the 98 are importable by name from the root barrel.** The other nine are default
  exports, which `export *` does not forward, so they are reachable only through their
  subpath: `AppLoader`, `Article`, `Dropzone`, `Navigation`, `OperationsProgressButton`,
  `PublicRoomBar`, `QuantityPicker`, `RoomType`, `Section`. The package's `exports` map
  carries a `./*` wildcard, so `@onlyoffice/apps-ui-kit/components/<folder>` resolves for
  every one of the 98.
- **Two providers, both from a subpath of their own**: `ThemeProvider` from
  `@onlyoffice/apps-ui-kit/providers/theme` and `TranslationProvider` from
  `@onlyoffice/apps-ui-kit/providers/translation`. Both are also in the root barrel.
  `providers/Providers` — the composed root the portal mounts — fetches portal settings
  through the REST API and is not in the `providers` barrel; it is portal-internal, and so
  is `providers/api`.
- **The root barrel re-exports `./uploader` and `./billing`**, so portal-internal names are
  reachable from a plain root import without any error to warn you.

## Step 0 — find out what you are working against

Before writing any code:

1. Read `node_modules/@onlyoffice/apps-ui-kit/package.json` and compare its `version` with
   the 4.0.0 pinned above. Say in your answer which version you read.
2. If the package is not installed, ask how it is meant to be installed before writing
   imports — there is no registry to install it from, so the answer decides the specifier.
3. If the project is a **DocSpace portal plugin** — `@onlyoffice/docspace-plugin-sdk` in
   its `package.json`, or imports of `@docspace/ui-kit` — stop and load the `plugin-sdk`
   skill instead. The portal's shim resolves exactly one specifier per package and throws
   on a subpath import, so the import rules here are wrong there.
4. Prefer what the installed package says over what you remember: its own
   `components/<folder>/README.md` for behaviour, `dist/types/**/*.d.ts` for props.

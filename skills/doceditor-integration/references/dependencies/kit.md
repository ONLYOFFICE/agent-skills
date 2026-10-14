# ONLYOFFICE UI kit dependency

## Context & Purpose

The single source of truth for ONLYOFFICE's own [UI kit](https://github.com/ONLYOFFICE/docspace-ui-kit-react), published on npm as `@onlyoffice/apps-ui-kit` - what it is, how to take it on as a real dependency, and the license rule that governs whether it's used directly or ported. [`ui.md`](../ui.md) is the design bar a generated UI is held to; this file is what that bar is *built on*. Read this file before installing, importing, or theming anything from the kit - not just before writing CSS.

## Reference Documentation Map

* [`Welcome.mdx`](https://github.com/ONLYOFFICE/docspace-ui-kit-react/blob/master/docs/Welcome.mdx) - what the kit is (components, hooks, MobX stores, API client) and the top level `Providers` wrapper.
* [`Structure.mdx`](https://github.com/ONLYOFFICE/docspace-ui-kit-react/blob/master/docs/Structure.mdx) - the 130+ components under `components/`, plus `hooks/`, `providers/`, `selectors/` (room/files/people pickers), `document-editor/`.
* [`API.mdx`](https://github.com/ONLYOFFICE/docspace-ui-kit-react/blob/master/docs/API.mdx) - `ApiProvider`, the `useApi()` hook, response shape (`.data.response`).
* [`Themes.mdx`](https://github.com/ONLYOFFICE/docspace-ui-kit-react/blob/master/docs/Themes.mdx) - `ThemeProvider`, theme tokens, `colorTheme` overrides. This is where a named style's tokens land - see "Theming" below.
* [`Translation.mdx`](https://github.com/ONLYOFFICE/docspace-ui-kit-react/blob/master/docs/Translation.mdx) - `TranslationProvider`, `useTranslation`, `getCommonTranslation` outside React.
* [`CLAUDE.md`](https://github.com/ONLYOFFICE/docspace-ui-kit-react/blob/master/CLAUDE.md) - the kit's own repo conventions (strict TS, `forwardRef` + WCAG 2.1 AA on every interactive component, theme tokens only, no hardcoded values). Read it before writing or modifying any kit component, not just before consuming one.
* **Where this feeds back into:** [`ui.md`](../ui.md) - the design bar built on this dependency, its ask step (style/layout/shape/theme-mode/motion/license questions), and its own Anti-Patterns for the non-kit-specific misses. [`example-checklist.md`](../example-checklist.md) §7.1 - where "actually used the kit, not just claimed to" gets verified.

## Documentation Query Rules

* **Baseline:** This guide is self-sufficient for the kit's install/license/theming rules; the six docs above are the primary source for everything else about the kit (props, hooks, component catalog) and get fetched fresh, never recalled.
* **License is the one fact that expires.** Everything else here (structure, providers, component set) is comparatively stable; the license note below is re-verified live every session that touches this file, never carried over from memory or a prior session.
* **Empty or unreachable isn't a cue to fabricate.** A lookup that comes back thin or blocked gets one retry with a different query before falling back to the nearest documented value here - say so, rather than presenting a guess as sourced.

## Mandatory foundation

**Every designed-app UI is built on this kit - not conditional on whether a style was named, no exception but an explicit faithful port** (see [`ui.md`](../ui.md)'s "Pick the mode"). A named style (glassmorphism, a dashboard archetype, a competitor's product) changes the *theme* layered onto the kit's components - it is never a reason to hand-roll a parallel button/modal/tile from scratch. What differs is *how* it's consumed, which turns on the license below and one required question to the user, not on whether it's used at all.

## Install and verify

**Install it as a real dependency, then verify each component you actually adopt.** The kit is published on npm as `@onlyoffice/apps-ui-kit` - install it with `npm i @onlyoffice/apps-ui-kit` pinned to an exact version, not as a `file:`/git dependency. Check the published `package.json` of that version rather than this paragraph for the peer set; at 4.0.x the required peers are `react`/`react-dom` `^19`, `i18next` and `react-i18next`, while `mobx`, `mobx-react`, `axios`, `react-router` (pinned, and itself demanding a newer React), `socket.io-client`, the markdown/katex stack and `@onlyoffice/document-editor-react` are *optional* peers that only the kit's portal-bound parts (API client, stores, AI chat, editor wrapper) need. A target on an older React needs a real upgrade first.

* **Import by sub-path, never from the package root.** `@onlyoffice/apps-ui-kit/components/button`, `@onlyoffice/apps-ui-kit/providers/theme`, `@onlyoffice/apps-ui-kit/providers/translation` (the `./*` export). The root entry re-exports everything, which drags in every optional peer and fails the build when they aren't installed.
* **Use `ThemeProvider` and `TranslationProvider` on their own.** The composite `Providers` also wraps `ApiProvider`, which requires a portal `url` and `apiKey` - an editor integration has neither. See the Themes/Translation docs above.
* **Don't import `styles.css`.** Each component imports its own compiled stylesheet; the global sheet only duplicates them.
* **A reference file manager ships in the repo:** [`docs/samples/files-app/FilesApp.tsx`](https://github.com/ONLYOFFICE/docspace-ui-kit-react/blob/master/docs/samples/files-app/FilesApp.tsx) - read it before composing the dashboard from the kit's components.

**Being the real kit doesn't exempt a specific component from `ui.md`'s bar - read its actual source before adopting it, not just its name.** A real integration found the kit's `IconButton`/`ContextMenuButton` combo - the obvious pick for an icon-only trigger - renders a non-focusable `<div>` with a mouse-only `onClick`, failing `ui.md`'s accessibility rules just as hard as a hand-rolled version would. Reading the component's own source (not its docs' happy-path example, not its name) caught this before it shipped; the fix composed `Button` (a real `<button>`) with `DropDown`/`DropDownItem` instead. Using the kit is not itself proof of meeting the bar - verify the specific component clears it.

## License: check every session, never assume

The kit is currently **AGPL-3.0-only** (confirmed via its `LICENSE` file and `CLAUDE.md`; ONLYOFFICE has only *planned*, not shipped, an MIT relicense). Re-check the live `LICENSE` file every session that touches this - don't carry over either state from memory or a prior session.

**While it's AGPL, ask the user directly** - batched with `ui.md`'s other ask-step questions, never inferred, never silently defaulted: *"This UI is built on ONLYOFFICE's own UI kit (`@onlyoffice/apps-ui-kit`), currently AGPL-3.0. Use the real component library directly - this project becomes AGPL-3.0 too, with a network-copyleft obligation - or port its design (tokens, layout, component shapes) into fresh, permissively-licensed code with the same look?"*

* **Port (the default if this is somehow skipped):** never take the dependency or copy its component/style source. Port token *values* (colors, spacing, radii, type scale — facts, not expression) into hand-written components, per "Theming" below.
* **Use directly (only on explicit acceptance):** install the real `@onlyoffice/apps-ui-kit` npm package and use its components as-is (React target), or port its actual markup/CSS/behavior faithfully (non-React target). This makes the generated project itself AGPL-3.0 - add the kit's real `LICENSE` text (not a summary), set the manifest's license field to match, and disclose the AGPL §13 network-source obligation prominently in the README.

**If a live check ever shows MIT**, this whole license note is moot - use the kit as an unconditional real dependency, no question needed.

## Theming

The kit's own tokens (`Themes.mdx`'s `colorTheme`, type scale, spacing) are the starting point for every generated UI, named style or not - a style *overrides* those tokens, it never replaces the component underneath:

* **A style was named:** apply what real examples show by **overriding the kit's own theme tokens** (`colorTheme`/type/spacing, or the equivalent once ported per the license note above) - the kit's Tile/Row/Table/ModalDialog/Toast components stay the implementation underneath every style; only tokens and, per `ui.md`'s collection-layout answer, the layout change.
* **Nothing was named:** ground the UI in **the kit's own `Themes.mdx` and component docs** - current color tokens, type scale, spacing, and each component family's actual shape (Tile, Row, Selector, ModalDialog, Toast, progress/loader). Its component set is enough to compose upload/convert/create-new screens too, without also consulting the Node.js sample's markup. The official ONLYOFFICE site fills in whatever the kit doesn't cover - page chrome, wordmark, general brand tone.

### Theme mode (light / dark / system)

`ThemeProvider`'s `initialTheme` prop takes `BaseStr` (light), `DarkStr`, or `SystemStr` (follows `window.matchMedia`, and keeps responding live to OS changes) - this is a real, user-facing choice, not a technical default to pick silently. [`ui.md`](../ui.md)'s ask-step asks it directly; **system** is the suggested default when the answer is "no preference," since it defers to whatever the visitor's OS already prefers instead of guessing light or dark. A named style settles this on its own only when it explicitly implies one ("dark-first," "neon," "light and airy") - otherwise ask.

## Anti-Patterns

* Hand-rolling a button/modal/tile/table from scratch instead of using the kit's - a named style re-themes it, never bypasses it.
* Treating the kit as optional, or asking *whether* to use it at all - the only actual exception is an explicit faithful port request ([`ui.md`](../ui.md)'s "Pick the mode").
* Silently choosing "use it directly" or "port it" instead of asking the license question while the kit is AGPL - a license decision this consequential is never inferred or defaulted, in either direction.
* Silently defaulting to light or dark theme mode instead of asking (or offering "system" when there's no preference) - see "Theme mode" above.
* Guessing ONLYOFFICE's colors/typeface/component shapes instead of reading the kit's own docs - a from-memory approximation of a component the kit actually ships.
* Using the kit's component "because it's the obvious name" without reading its source - see "Install and verify" above.
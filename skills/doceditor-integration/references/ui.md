# UI design

## Context & Purpose

The visual and interaction bar for any UI generated alongside an ONLYOFFICE integration - the file manager, the editor page, the dialogs a person actually clicks. A generated sample gets screenshared and judged on sight long before anyone reads its code, so it has to look like a product that shipped, not a harness someone wired up.

[`example.md`](./example.md) defines *what* the UI must do; this file defines *how it looks and behaves*, always built on ONLYOFFICE's own [UI kit](./dependencies/kit.md). The official Node.js sample is the **feature floor, never the visual ceiling** - porting its markup faithfully reproduces a decade-old demo, not "something I can show the team on Friday."

## Reference Documentation Map

*Bare mentions of `api.md` below are the sibling **`doceditor`** skill's file, not one in this directory.*

* **[`dependencies/kit.md`](./dependencies/kit.md) - the always-on component foundation, in every mode but a faithful port.** What the kit is, how to install and verify it, its license rule, and where its tokens feed the theming decisions below. Read it before building anything.
* **Feature set and reference views:** [`example.md`](./example.md)'s "Optional Sample UI" - which screens and controls have to exist; the fidelity rules that apply *only* in port mode.
* **Design collections, for a style the user named** - theme the kit, don't replace it: [Dribbble](https://dribbble.com), [Awwwards](https://www.awwwards.com), [Land-book](https://land-book.com), [Mobbin](https://mobbin.com), [Godly](https://godly.website), [siteInspire](https://www.siteinspire.com), [Lapa Ninja](https://www.lapa.ninja), [Refero](https://refero.design), [Collect UI](https://collectui.com); [Material Design 3](https://m3.material.io), [Apple HIG](https://developer.apple.com/design/human-interface-guidelines), [shadcn/ui](https://ui.shadcn.com), [Tailwind UI](https://tailwindui.com).
* **https://www.onlyoffice.com** - the live site, for whatever neither the kit nor a named style covers: page chrome, wordmark, general brand tone.
* **Port-mode reference** (only for an explicit port request - see "Pick the mode"): the Node.js sample's own front end - [`index.ejs`](https://github.com/ONLYOFFICE/document-server-integration/blob/main/web/documentserver-example/nodejs/views/index.ejs), [`editor.ejs`](https://github.com/ONLYOFFICE/document-server-integration/blob/main/web/documentserver-example/nodejs/views/editor.ejs), [`jscript.js`](https://github.com/ONLYOFFICE/document-server-integration/blob/main/web/documentserver-example/nodejs/public/javascripts/jscript.js), plus whatever stylesheets `index.ejs` links - read the links rather than guessing filenames ([`example-checklist.md`](./example-checklist.md) §2.2). A local pinned checkout beats a fetched branch.
* **Mounting the editor in React/Angular/Vue:** by default the dashboard navigates to the backend's `/editor` page instead of mounting its own editor (`SKILL.md`'s "One editor implementation"); when the editor does live in the app's routes, use the official component for each - [React](https://api.onlyoffice.com/docs/docs-api/get-started/frontend-frameworks/react.md), [Angular](https://api.onlyoffice.com/docs/docs-api/get-started/frontend-frameworks/angular.md), [Vue](https://api.onlyoffice.com/docs/docs-api/get-started/frontend-frameworks/vue.md) - with the sibling `doceditor` skill's manual `DocsAPI.DocEditor` pattern as the fallback for any other framework. On Vue, pass every event handler through `config.events`, not `events_*` props - see `SKILL.md`'s Vue caveat.
* **Editor surface sizing:** `api.md` - init replaces the placeholder (or the component's own root) with an iframe, so size lives on a wrapper around it either way.
* **Editor placeholder inside a component framework, if falling back to manual init:** `api.md`'s "Inside a Component Framework" - a framework-owned placeholder crashes the render layer the moment anything re-renders around it. The React/Angular/Vue packages above already solve this internally.
* **Seed and create-new content:** [`templates.md`](./templates.md) - real vendored documents, not placeholders.
* **Verification:** [`example-checklist.md`](./example-checklist.md) §2, §4, §7.

**Always fetch these, never recall them.** A lookup that comes back thin or blocked gets one retry with a different query before falling back to the nearest documented value here - and say so, rather than presenting a guess as sourced. [`dependencies/kit.md`](./dependencies/kit.md) has its own query rules for the kit's docs and license - this rule and that one apply together, not instead of each other.

## Pick the mode before writing any CSS

| What the request is | Mode |
| :--- | :--- |
| "Port the official example", "same as the Node sample", a diff against a pinned checkout | **Faithful port** - the reference *is* the spec: reuse its CSS/DOM verbatim under [`example.md`](./example.md)'s fidelity rules |
| "Sample app", "demo", "something to show the team", or any named look/brand/design system | **Designed app** - the reference supplies the feature list; the surface is built on the kit, to the bar below |

**Default to designed app.** A demo request wants something presentable; a faithful port is a narrower, explicitly-requested deliverable. Feature coverage is identical either way - only whether the visual layer is transcribed or designed.

## Always use the UI kit

**Every designed-app UI is built on the kit - not conditional on whether a style was named, no exception but an explicit faithful port.** A named style (glassmorphism, a dashboard archetype, a competitor's product) changes the *theme* layered onto the kit's components - it is never a reason to hand-roll a parallel button/modal/tile from scratch. See [`dependencies/kit.md`](./dependencies/kit.md) for how to install and verify it, and its **License** section for what changes while it's AGPL-3.0 - that section's ask-the-user step is question 6 in the ask-step below.

## Decide the design once, before the first component

Per-component styling is how incoherence gets in. Settle the system first - CSS custom properties, a theme file, or the kit's own theme tokens - then build every component against it:

* **Palette, type scale, spacing scale, radius/border/shadow/focus ring** - one ramp or value each, reused everywhere. [`dependencies/kit.md`](./dependencies/kit.md)'s "Theming" section is the starting point for all of these; a named style overrides them, it doesn't replace the component underneath.
* **Collection layout** - table, card/tile grid, or hybrid (icon + row) for the file list. A layout decision, not a token - settled by asking (below), never assumed from a surface treatment alone (a named style can still browse as a table, and vice versa).
* **App-shell chrome** - when the shape includes a nav shell, the sidebar is `position: fixed` (or full-height sticky, explicit width), not a grid track that only looks fixed at one breakpoint. Content scrolls beside it, not away with it.

### Ask, don't guess - batch these into one dialog with any other open question for the task

1. **Style** - *"Any particular look you'd like this styled after - a product, a brand, a design system - or ONLYOFFICE's own look?"* ONLYOFFICE's own identity is the default/no-preference option. Any concrete name proceeds via "They named a style" below; "no preference" proceeds via "They named nothing."
2. **Collection layout** - *"How should the file list be browsed?"* **Data table** (dense rows, aligned columns), **Card/tile grid** (thumbnail-forward), **Hybrid** (icon + row). Skip only when (1) already implies it unambiguously.
3. **Overall shape** - *"What's the overall shape of this UI?"*, grounded in real document-management patterns:
   1. **Single embed** - just the editor and minimal chrome; nothing to return to.
   2. **Simple file list** - a flat "my files" view behind little or no auth; a narrow demo, not a full product.
   3. **Folder-based drive** - nested folders, breadcrumbs, upload/organize, auth-gated; no external-sharing concept.
   4. **Sharing-centric cloud storage** - personal/shared folders, shareable links with per-link permissions, a details/activity panel per file, starred/recent views.
   5. **Room/workspace-based** - separate collaboration spaces with their own membership/roles - typically the most screens.

   Five options exceed the four-button dialog ceiling - present this one as a **plain numbered list in the question text** rather than dropping an option to fit buttons; the user can answer with a number, a short name, or an explicit hybrid. Skip only when the request already settles it, or [`infrastructure/backend.md`](./infrastructure/backend.md)'s decision table already resolved "backend only, no UI."
4. **Theme mode** - *"Should this default to light, dark, or follow the system preference?"* [`dependencies/kit.md`](./dependencies/kit.md)'s `ThemeProvider` supports all three natively - **system** is the default if this gets skipped. Skip only when the style answer already settles it ("dark-first," "neon," "light and airy").
5. **Motion** - *"How much animation should this have - subtle micro-interactions (the default), something more expressive with richer transitions, or none/static?"* **Subtle** (120–200ms on state/entry transitions, per "The bar" below) is the default if this gets skipped. Whatever is chosen still honours `prefers-reduced-motion` - that's an accessibility floor, not a style choice, and applies regardless of the answer. Skip only when the style answer already settles it ("brutalist" or a stated "no animation" preference implies none; a named style built around motion - a lot of glassmorphism/neumorphism references - implies expressive).
6. **License** (only while the kit is AGPL - see [`dependencies/kit.md`](./dependencies/kit.md)'s "License" section for the live check and the exact question) - real license question, asked every time, never inferred from an unrelated "yes."

A named style still answers (3), (4), or (5) directly when it implies them - an archetype settles shape, "dark-first"/"neon" settles theme mode, "brutalist"/minimal settles motion - skip only the ones actually implied, never all three by default. Never answer (1)-(3) from memory once an answer is in hand - a misremembered brand colour, or a guessed "glassy" surface, reads as a bug, not a style.

### They named a style - the theme layered onto the kit

Arrives as a **surface treatment** (glassmorphism, minimalism, neo-brutalism, neumorphism, flat/material, dark-first, editorial, terminal/retro) and/or an **archetype that expands the screens** (a dashboard, an admin console, a SaaS landing page, mobile-first) - build the sign-in flow, nav shell, settings, and per-view empty/loading states that archetype implies, not just a restyled single page.

**Look it up before implementing it.** Fetch real examples from the collections above and derive tokens from what they actually show - real blur radii and layer opacities for glassmorphism, real whitespace ratios for minimalism, real density and nav width for a dashboard. Apply what's found per [`dependencies/kit.md`](./dependencies/kit.md)'s "Theming" section - override the kit's own tokens, never bypass its components to get there.

### They named nothing - ground it in the kit, then the live site

[`dependencies/kit.md`](./dependencies/kit.md)'s "Theming" section covers this directly - the kit's own `Themes.mdx` and component docs first, the official ONLYOFFICE site for whatever the kit doesn't cover (page chrome, wordmark, general brand tone).

Either way the integration contract underneath doesn't move: wrapper-sized editor, `editorConfig`/`events` shape, server-side signing. Style is the surface, never the contract.

## The bar

* **An app shell, not a page of controls.** Branded header, a fixed/sticky left nav when the shape includes one, a content column with real gutters and a sane max width. A bare heading over a naked table is the tell of a test harness.
* **No browser defaults anywhere.** Every button, input, select, link, table, dialog is styled - via the kit's components, not native ones re-skinned.
* **Every control, every state:** rest, hover, `:focus-visible`, active, disabled, in-flight. Never `outline: none` without a replacement ring.
* **Adjacent states are distinct from each other, not just from rest.** A hover tint and a selected tint that are both near-white/near-identical pass every per-state check individually and still read as broken together - a selected row looks unselected once nothing is hovered. Pick states from the same token set but far enough apart to tell apart at a glance; compare rest/hover/selected side by side, not each state's CSS in isolation.
* **A popover/dropdown/menu is never clipped by a scrollable or `overflow`-anything ancestor.** `overflow-x: auto` alone still forces `overflow-y` to compute as `auto`, clipping vertically too - invisible until someone opens the menu near an edge. Render through a portal to a top-level node, positioned from the trigger's own on-screen rect; re-position or close on scroll/resize. Applies to every popover-shaped thing, not just file-list dropdowns.
* **Every async region, three states:** loading (skeleton or in-place spinner, no layout jump), empty (a real first-run state saying what to do next - the state the demo *opens* in), error (what failed and what to do).
* **The file list follows the answered layout - no silent fallback to a table.** Table: aligned columns, tabular numerals, one clear primary action per row, destructive actions visually distinct and confirmed. Cards/hybrid: per-item primary action, a visible non-hover-only rename/delete affordance, aligned metadata, the same multi-select/batch-count behavior adapted (a selected border/check overlay in place of a row highlight). Long filenames truncate with an ellipsis and full name on hover/title; selecting several items shows a live, accurate count next to the batch actions it enables.
* **Real progress, never theatre.** Upload exposes real byte progress - render that. Conversion does not: the Conversion API's `percent` is only ever `0` or `100` (per the sibling `web-converter` skill), so show a state (queued/converting/done) or elapsed time, never a synthetic bar. Both stay cancellable mid-flight.
* **The editor fills its surface.** Size the wrapper (never the placeholder - `api.md`): viewport height minus chrome, no letterboxing, no nested scrollbar.
* **Works at phone width.** Nothing overflows the body horizontally; wide tables scroll in their own container; touch targets stay 44×44px minimum with 8px between neighbors. Hover-only row actions need a tap-visible fallback.
* **Motion per the ask-step's answer** - subtle by default (120–200ms on state/entry transitions) unless expressive or none was asked for. `prefers-reduced-motion` is honoured regardless of that answer - an accessibility floor, not part of the style choice.
* **Accessible, because production is.** Semantic elements, real labels tied to inputs, inline errors next to their field, 4.5:1 text contrast, dialogs that trap focus and close on Escape, every action reachable by keyboard - see [`dependencies/kit.md`](./dependencies/kit.md)'s "Install and verify" for why a real kit component still needs this checked, not assumed.
* **One icon set at one weight, never emoji.** Every icon-only button carries a real accessible label. In port mode, use the reference's own filenames.
* **Seeded with real documents** from [`templates.md`](./templates.md), openable on first load.

## Verify by looking at it

Parsers and headless runs cannot see a broken layout: a stylesheet that failed to parse and a component rendered off-screen both pass every structural check. Run the CSS through a real parser, then open the app in a browser at desktop *and* narrow widths and look at it - screenshot it if the environment allows. [`example-checklist.md`](./example-checklist.md) §4 orders these cheapest-first.

**Not self-certified.** A generated UI is done when [`example-checklist.md`](./example-checklist.md)'s §7 UI Bar checklist has actually been run against it and every item passes, per [`SKILL.md`](../SKILL.md)'s Definition of Done - not when it was built with this file open.

## Anti-Patterns

* Styling each component as it's written, with no token pass first.
* Shipping a framework's untouched default look when a brand direction was available.
* The "it works" page: unstyled table, native buttons, `alert()` for errors.
* Implementing a named style from memory instead of deriving values from real examples. **See [`dependencies/kit.md`](./dependencies/kit.md)'s own Anti-Patterns for the kit-specific misses** - hand-rolling instead of using it, treating it as optional, silently picking a license path instead of asking.
* Silently defaulting to ONLYOFFICE's own look (or a guessed style) instead of asking which is wanted, or assuming the collection layout, overall shape, theme mode, or motion intensity instead of asking those too.
* Painting a named style's colours onto a table when the layout question was answered "cards" or "hybrid" - a color pass isn't a substitute for the actual layout.
* A dashboard sidebar that's only a grid column instead of a fixed/full-height sticky shell nav.
* A layout that only holds together at one viewport width.
* Fake progress bars, `alert()`/`confirm()` standing in for dialogs, blank empty states.
* Row actions that only reveal on hover, and icon-only buttons with no accessible name.
* A `position: absolute` popover left as a plain child of a scrollable/`overflow` container instead of portaled - renders fine until opened near an edge, then clips silently.
* A selected-state token picked without holding it next to the hover-state token.
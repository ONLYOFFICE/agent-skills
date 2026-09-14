# ONLYOFFICE Docs Sample UI Design Skill Guide
 
## Context & Purpose
 
The visual and interaction bar for any UI generated alongside an ONLYOFFICE integration — the file manager, the editor page, the dialogs a person actually clicks. A generated sample gets screenshared and judged on sight long before anyone reads its code, so it has to look like a product that shipped, not a harness someone wired up.
 
[`example.md`](./example.md) defines *what* the UI must do; this file defines the standard for *how it looks and behaves*. The official Node.js sample is the **feature floor, never the visual ceiling** — porting its markup faithfully reproduces a decade-old demo, which is not what "something I can show the team on Friday" means.
 
## Reference Documentation Map
 
* **Feature set and reference views:** [`example.md`](./example.md)'s "Optional Sample UI" — which screens and controls have to exist, and the fidelity rules that apply *only* in port mode below.
* **Design collections, for a style the user named** — look the style up in real examples before implementing it: galleries like [Dribbble](https://dribbble.com), [Awwwards](https://www.awwwards.com), [Land-book](https://land-book.com), [Mobbin](https://mobbin.com), [Godly](https://godly.website), [siteInspire](https://www.siteinspire.com), [Lapa Ninja](https://www.lapa.ninja), [Refero](https://refero.design), [Collect UI](https://collectui.com); systems like [Material Design 3](https://m3.material.io), [Apple HIG](https://developer.apple.com/design/human-interface-guidelines), [shadcn/ui](https://ui.shadcn.com), [Tailwind UI](https://tailwindui.com).
* **Brand fallback, for when they named nothing — read both, don't recall either:**
  1. The **Node.js example's own front end**, which is ONLYOFFICE's real design language expressed in code: [`index.ejs`](https://github.com/ONLYOFFICE/document-server-integration/blob/main/web/documentserver-example/nodejs/views/index.ejs), [`editor.ejs`](https://github.com/ONLYOFFICE/document-server-integration/blob/main/web/documentserver-example/nodejs/views/editor.ejs), [`jscript.js`](https://github.com/ONLYOFFICE/document-server-integration/blob/main/web/documentserver-example/nodejs/public/javascripts/jscript.js), plus whatever stylesheets `index.ejs` actually links out of `public/stylesheets/` — read the links rather than guessing filenames ([`example-checklist.md`](./example-checklist.md) §2.2). A local pinned checkout, if the user has one, beats the branch above.
  2. **https://www.onlyoffice.com** — the live site, for current brand values and anything the example's CSS doesn't cover: page chrome, wordmark, typography, tone.
* **Editor surface sizing:** [`api.md`](./api.md) — init replaces the placeholder with an iframe, so the size lives on a wrapper around it.
* **Editor placeholder inside a component framework:** [`api.md`](./api.md)'s "Inside a Component Framework" section — a framework-owned placeholder element crashes the framework's own render layer the moment anything re-renders around it (a mode/co-editing dropdown, most commonly), which is exactly the kind of "glitch" a UI generated in one of these frameworks needs to be clicked through and checked for, not just looked at once after first load.
* **Seed and create-new content:** [`templates.md`](./templates.md) — real vendored documents, not placeholder files.
* **Verification:** [`example-checklist.md`](./example-checklist.md) §2, §4 — the asset-fidelity and look-at-it-yourself steps.

## Documentation Query Rules
 
* **Baseline:** This guide is self-sufficient — a design standard, not a wrapped API.
* **Always fetch, never recall:** the design collections above when a style was named, the ONLYOFFICE site when one wasn't. Those two lookups are the only external reads this file expects; everything else is a judgment call it's meant to settle.
* **Empty or unreachable isn't a cue to fabricate.** If a lookup comes back thin, empty, or blocked, retry once with a different query or source before falling back to the nearest documented value in this file — and say so in the response, rather than presenting a guess as if it had been sourced.

## Pick the mode before writing any CSS
 
| What the request is | Mode |
| :--- | :--- |
| "Port the official example", "same as the Node sample", a diff against a pinned checkout | **Faithful port** — the reference *is* the spec: reuse its CSS/DOM verbatim under [`example.md`](./example.md)'s fidelity rules and change nothing for taste |
| "Sample app", "demo", "something to show the team", or any named look/brand/design system | **Designed app** — the reference supplies the feature list; the surface is designed to the bar below |
 
**Default to designed app.** Someone asking for a demo is asking for something presentable; a faithful port is a narrower, explicitly-requested deliverable. Either way the *feature* coverage is the same — the modes differ only in whether the visual layer is transcribed or designed.
 
## Decide the design once, before the first component
 
Per-component styling is how incoherence gets in: the pieces lifted from a reference look designed, everything added fresh looks bare, and nobody notices until it's on a projector. Settle the system first, in one place — CSS custom properties, a theme file, whatever the stack uses — then build every component against it:
 
* **Palette** — surface, elevated surface, border, primary/secondary text, accent (+ hover/active), success, danger. Enough for states, not a rainbow.
* **Type scale** — four or five sizes with real line heights, a 16px+ base for body text, one font stack, one accent weight.
* **Spacing scale** — a single ramp (4px or 8px based). Ad-hoc pixel values are what makes a layout feel loose.
* **Radius, border, shadow, focus ring** — one value each, reused. Mixed radii read as a merge of two designs.
* **Collection layout** — how does *this* style actually browse a list of things? A dense enterprise console reaches for a table; a media/streaming-style brand (Spotify, album grids, playlist tiles, cover art) reaches for a **grid of cards**; a file-sync product often uses a hybrid (icon + row). This is a layout decision, not a color/spacing token, but it gets decided the same way and at the same time as the tokens below — from what the real examples the named style points to actually show for a comparable collection, not assumed by default. "The file list is a data table" further down in [The bar](#the-bar) is the safe default *when nothing else was named or shown* — it is **not** a rule that overrides a style whose own real examples clearly browse things as cards instead. **If the user named Spotify / streaming / media, build workspace cards (or a tile grid), not a dense data table with Spotify colours painted on.** Getting this one wrong is invisible in code review (a card grid and a table are both "styled," both pass a static check) and only shows up as "this doesn't look like the thing I asked for" once someone looks at it.
* **App-shell chrome** — when the archetype is a dashboard (auth gate, sidebar nav, file library), the left nav is a real shell column: `position: fixed` (or sticky at full viewport height with an explicit width), not a CSS-grid track that only *looks* like a sidebar on one breakpoint. The content column scrolls beside it; the nav does not scroll away with the file list.
Where those values come from depends on one question — **did the user name a style?** Never answer either branch from memory: a misremembered brand colour, or a "glassy" surface with guessed blur and opacity, reads as a bug rather than a style.
 
### They named a style — that's the direction, and ONLYOFFICE branding is not it
 
A named direction arrives as either or both of:
 
* **A surface treatment** — glassmorphism, minimalism, neo-brutalism, neumorphism, flat/material, dark-first, editorial, terminal/retro, and so on.
* **An archetype that also expands the screens** — "a complex dashboard with authentication", an admin console, a SaaS landing page, mobile-first. This changes *what exists*, not just how it looks: a sign-in and sign-up flow, a nav shell with sidebar and user menu, settings, per-view empty and loading states. Build that structure too, rather than restyling a single-page file list and calling it a dashboard.
**Look it up before implementing it.** Fetch real examples from the collections above and derive the tokens from what they actually show — for glassmorphism, the real blur radii, layer opacities, border highlights and the busy backdrop that makes glass legible at all; for minimalism, the actual whitespace ratios and how restrained the palette really is; for a dashboard, the density, nav width and card rhythm that production consoles use. A from-memory pastiche of a named style is the failure mode this step exists to prevent.
 
### They named nothing — fall back to ONLYOFFICE's own identity
 
Ground it in the two real sources linked above, in this order, reading both rather than reconstructing either:
 
1. **The Node.js example's front end** — `index.ejs`/`editor.ejs`/`jscript.js` and the stylesheets they link. Those colour values, spacing steps, radii and shadows *are* ONLYOFFICE's design tokens, not an approximation of them: lift the numbers, then design a better surface with them than the example itself has.
2. **The official ONLYOFFICE site** for everything that CSS never touches — page chrome around the file-list UI, logo and wordmark treatment, typographic choices, general brand tone — and to confirm a value looks current rather than left over from an older revision of the example.
Either way the integration contract underneath doesn't move: wrapper-sized editor, `editorConfig`/`events` shape, server-side signing. Style is the surface, never the contract.
 
## The bar
 
* **An app shell, not a page of controls.** Branded header, a fixed/sticky left nav when the archetype includes one (see "App-shell chrome" above), a content column with real gutters and a sane max width, consistent page padding. A bare heading over a naked table is the tell of a test harness.
* **No browser defaults anywhere.** Every button, input, select, link, table and dialog is styled. One native control beside a styled one reads as broken, not as minimal.
* **Every control, every state:** rest, hover, `:focus-visible`, active, disabled, in-flight. Never `outline: none` without a replacement ring — that silently breaks keyboard use.
* **Every async region, three states:** loading (skeleton or in-place spinner, no layout jump), empty (a real first-run state saying what to do next — this is the state the demo *opens* in), error (what failed and what to do, not a swallowed console line).
* **The file list follows the collection-layout decision — do not silently fall back to a table.** When nothing was named, a data table is fine: aligned columns, tabular numerals for size and date, muted secondary text, one clear primary action per row, destructive actions visually distinct and confirmed before they run. When the named style's own real examples browse collections as cards/tiles (Spotify-style demos included), build that grid and **do not ship a `.file-table` with brand colours** — that fails the named-style bar even if every other token is right. Hold cards to the same bar: every card still needs its per-item primary action, a visible way to trigger rename/delete without a hover-only affordance nobody without a cursor can reach, aligned metadata (not each card free-floating its own layout), and the same multi-select/batch-count behavior adapted to a card grid (a selected-state border/check overlay in place of a row highlight). Long filenames truncate with an ellipsis and the full name on hover/title rather than wrapping and breaking row height; selecting several items shows a live, accurate count ("3 selected") next to the batch actions it enables.
* **Real progress, never theatre.** Upload and conversion both expose real numbers — the Conversion API returns its own `percent` per poll ([`additional/conversion/response.md`](./additional/conversion/response.md)). Render those. A synthetic bar that finishes before the work does is worse than an honest spinner. Both stay cancellable mid-flight — nothing traps the user until the work finishes on its own schedule.
* **The editor fills its surface.** Size the wrapper (never the placeholder — see [`api.md`](./api.md)): viewport height minus the app chrome, no letterboxing, no nested scrollbar.
* **Works at phone width.** Nothing overflows the body horizontally; wide tables scroll inside their own container; touch targets stay comfortably tappable (44×44px minimum, at least 8px between neighbors). Any row action revealed only on `:hover` needs a tap-visible fallback — touch has no hover.
* **Motion, sparingly.** 120–200ms on state and entry transitions, and honour `prefers-reduced-motion`.
* **Accessible, because production is.** Semantic elements, real labels tied to inputs — never a placeholder standing in for one — inline errors next to the field they describe rather than only a top banner, 4.5:1 text contrast, dialogs that trap focus and close on Escape, every action reachable by keyboard.
* **One icon set at one weight, never emoji standing in for icons.** Mixed sets are the fastest way to look unfinished — a folder row using 📁 instead of a real icon is another. Every icon-only button still carries a real accessible label, not just a hover tooltip. In port mode, use the reference's own filenames rather than inventing plausible ones.
* **Seeded with real documents** from [`templates.md`](./templates.md), openable on first load. An empty list or lorem-ipsum files undercut the demo you were asked for.

## Verify by looking at it
 
Parsers and headless runs cannot see a broken layout: a stylesheet that failed to parse and a component rendered off-screen both pass every structural check. Run the CSS through a real parser, then open the app in a browser at desktop *and* narrow widths and look at it — screenshot it if the environment allows. [`example-checklist.md`](./example-checklist.md) §4 orders these cheapest-first.
 
## Anti-Patterns
 
* Styling each component as it's written, with no token pass first — the surest route to a patchwork.
* Shipping a framework's untouched default look when a brand direction was available.
* The "it works" page: unstyled table, native buttons, `alert()` for errors.
* Implementing a named style from memory — "glassy-ish", "sort of brutalist" — instead of deriving its real values from examples, or guessing ONLYOFFICE's colors and typeface instead of reading the reference CSS and the live site.
* Defaulting to ONLYOFFICE branding *over* a style the user actually asked for. Their direction wins; the brand is the fallback for when there wasn't one.
* Painting a named style's colours onto a dense data table when that style's real examples browse as cards/tiles (the classic "Spotify palette, Excel layout" miss).
* A dashboard sidebar that is only a grid column / flows with content instead of a fixed or full-height sticky shell nav.
* A layout that only holds together at the one viewport width the author had open.
* Fake progress bars, `alert()`/`confirm()` standing in for dialogs, and blank empty states.
* Emoji filling in for a real icon set, and icon-only buttons with no accessible name.
* Row actions that only reveal on hover — invisible the moment there's no cursor to reveal them.
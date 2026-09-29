# Styling a plugin's surfaces

How a plugin comes to look like ONLYOFFICE Apps, and how it avoids restyling ONLYOFFICE Apps on the way. The kit's own components and their layout mechanics are in [ui-kit.md](ui-kit.md); this file is what applies whether the markup is a kit `Button`, a plain `div` or HTML the plugin generated.

The one fact behind everything below: a plugin's stylesheet is not scoped to the plugin. `plugin.css` is linked into the **main document's** head, after the portal's own stylesheets, so an unprefixed rule restyles the product ([Scoped CSS](#scoped-css)) — and the portal's rules reach into your markup in return ([What beats your rules](#what-beats-your-rules)).

Contents: [Where a style can come from](#where-a-style-can-come-from) · [Conventions](#conventions) · [Colors](#colors) · [Scoped CSS](#scoped-css) · [What beats your rules](#what-beats-your-rules)

## Where a style can come from

Three sources, in this order — each one is reached for only when the one above it cannot express the thing:

1. **A kit prop.** The kit's components already carry the portal's sizes, weights and states; a prop is also the only form that follows a re-theme without being told ([ui-kit.md](ui-kit.md)). Raw HTML controls never: an unstyled `<button>` or `<input>` is the one thing that immediately looks foreign.
2. **An inline `style`.** Layout the kit does not own — a flex column, a width, a gap — belongs here. It is scoped by construction, which is its main virtue in a document you share with the portal.
3. **A stylesheet**, for what inline `style` cannot express at all: `:hover`/`:focus`, pseudo-elements, keyframes, media queries, and markup you did not author. Make it a `.module.css`, for the reason in [Scoped CSS](#scoped-css).

Colors at every one of the three come from the portal's variables, never a literal ([below](#colors)).

## Conventions

The portal's own measurements. Literal px is normal — there are no spacing tokens.

- Typography inherits Open Sans **13px / 400**; secondary lines 12px; emphasis `fontWeight={600}` (700 is headings). Headings come from `Heading` (`level` = tag, `size` = look; an `h1` at `medium` is the usual page title).
- 16px outer padding in dialogs and panels (what an aside leaves to the plugin: [modal-dialog.md](components/modal-dialog.md)). A section page needs none of its own on a desktop — the section pads it 19px above, 16px below, 20px inline-start and 3px inline-end, left for the scrollbar ([article-navigation-item.md](items/article-navigation-item.md#where-it-renders)) — but from 1023.9px down it drops the top padding (`padding-block: 0 16px`; sides 24px/0, and 24px/8px under 600px), and a plugin page has no section header above it, so a heading sits flush against the top edge on a tablet. Give the root `padding-block-start: 16px` under `@media (max-width: 1023.9px)` and nowhere else: unconditional, it doubles the desktop gutter, which the preview shows because it reproduces the desktop padding. 8–12px between controls. Radius 3px on controls, 6px on dialogs.
- Widths to lay out against: info panel body ≈ 337px; modal 400px; aside 480px; section page — full width, cap text at ~640px. What a modal will and will not grow to is in [modal-dialog.md](components/modal-dialog.md).

## Colors

For anything you color yourself, use the portal's CSS variables — they flip with the theme and follow a re-branded accent. A hardcoded hex breaks in the other theme.

| Variable | Use for |
|---|---|
| `--text-color` | primary text |
| `--info-panel-members-subtitle-color` | **secondary text** — a caption, a subtitle, a metadata line ([below](#secondary-text-is-not-the-disabled-grey)) |
| `--text-disable-color` | a control the user cannot use — **not** secondary text ([below](#secondary-text-is-not-the-disabled-grey)) |
| `--accent-main` | accent (never hardcode `#4781d1` — admins re-brand it) |
| `--background-color` / `--background-service-color` | main surface / secondary panel |
| `--border-service-color` | **the** divider and border color |
| `--input-error-color` | error text and borders |
| `--status-icon-color-positive` / `--status-warning` | success / warning |

Traps: `--error-color`, `--success-color` and `--border-color` **do not exist** (an invalid `var()` silently inherits); `--warning-color` exists but resolves to the error red.

### Secondary text is not the disabled grey

`--text-disable-color` reads like "muted text" and is the wrong variable for it: it is the
colour of a control that cannot be used, and it **flips with the theme** — `#a3a9ae` on the
light one, `#5c5c5c` on the dark one (`components/checkbox/Checkbox.module.scss/index.css`). Against
the dark theme's `#333` surfaces that second value is about **1.9:1**, below every readability
floor: a caption set in it is legible while you develop against the light theme and close to
invisible the moment someone switches. Nothing reports it — the text is there, in a colour of
the portal's own palette, so neither the validator nor a stylesheet check has anything to
object to.

The portal's own secondary lines — the info panel's member subtitles — use
`--info-panel-members-subtitle-color`, which the theme root declares as `#a3a9ae` in **both**
themes (`components/theme-provider/ThemeProvider.scss/index.css`), ~5.3:1 on the dark background. Use
it for a caption, a subtitle or a metadata line, and keep `--text-disable-color` for what its
name says.

**Read both themes before trusting any colour**: the theme root declares a handful of
variables, and the rest come from the component the rule sits in — so a variable's value is a
pair, and the pair is in that component's `.module.scss/index.css`, under `.dark .<hash>` and
`.<hash>` ([ui-kit.md](ui-kit.md)).

**A kit `color` prop is a CSS value, not a token** — with one exception. `Text` puts `color` straight into the element's inline `style`, so `color="accent"` is invalid CSS and the text silently inherits whatever colour surrounds it: pass `color="var(--accent-main)"`. `Link` is the exception — it maps the literal `"accent"` to `var(--accent-main)` itself, so both spellings work there. When a kit prop takes a colour and its `.d.ts` says `string`, assume the value reaches `style` unchanged and give it a real CSS value; the component's `.module.scss/index.css` settles it in one look.

When the theme is needed as a **fact** — a whole palette for generated markup, an asset in two versions, a canvas — `useTheme()` from the kit returns `{ theme, isBase, currentColorScheme }`; `isBase` (`true` = light) is already resolved, there is no `prefers-color-scheme` to consult.

## Scoped CSS

CSS modules versus plain stylesheets, and how both end up in one `plugin.css`, are explained in [Styling plugin](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/styling-plugin.md) — its build examples are the SDK's webpack template, and a scaffolded project does the same through Vite. What that page does not say is why the module is the only safe form here. `plugin.css` lands in the portal's `<head>` *after* the portal's own stylesheets, so at equal specificity your rule wins: an unprefixed `pre {}` or `.card {}` restyles the product itself ([portal.md](portal.md#what-actually-breaks-the-portal)). The validator only reports how the stylesheet is imported and built; the rules themselves are read by the browser pass, which plants portal-shaped markup beside the plugin and reports every rule of yours that matches it (`preview-leak`). That covers the shapes the portal's DOM is mostly made of, not every selector — so a stylesheet is still either read by hand or made impossible by construction:

- **A CSS module** — `styles.module.css`, imported as `import styles from "./styles.module.css"` and used as `className={styles.row}`. The build hashes every class name, so there is nothing to remember and nothing to get wrong. **Prefer this**: it is the only form that cannot go wrong unread. The generated `vite.config.ts` builds `css.modules.generateScopedName` out of the manifest `name` so the hashed classes carry the plugin's prefix too; a hand-written config needs the same line.
- **A prefix on every class**, taken from the manifest `name` (`archive-manager` → `.archive-manager-row`) — for a plain `.css` file, which the validator can only warn about. Never a bare type selector, `*`, `:root`, `html` or `body` at the top level, and never an unprefixed class: those match the portal's DOM, not yours.

Only the **leftmost** selector has to carry the scope; descendants inside a root you own are free, and that is how generated markup gets styled:

```css
.archive-manager-tree { display: grid; gap: 4px; }
.archive-manager-tree pre { white-space: pre; }
.archive-manager-row:hover { background: var(--background-service-color); }
```

Custom properties go on your own root, never `:root`. Keyframe names are global too — prefix them. Reviewing a plugin, run the browser pass and then read whatever it could not reach against this section; a `css` warning from the validator only means the stylesheet is in a form static checks cannot judge.

## What beats your rules

Scoping keeps your rules off the portal's DOM. It does not keep the portal's rules off yours, and the asymmetry catches generated markup: a property set on your wrapper only **inherits**, and any portal rule aimed at the descendant itself — the kit's `.body { white-space: pre-line }`, which is why a modal body double-spaces generated HTML — outranks the inherited value. So markup you did not author is styled descendant by descendant from a root you own:

```css
.myplugin-rendered, .myplugin-rendered * { white-space: normal; }
.myplugin-rendered pre, .myplugin-rendered pre code { white-space: pre; }
.myplugin-rendered p, .myplugin-rendered li { line-height: 20px; margin: 0; }
.myplugin-rendered { color: var(--text-color); }
```

Composed JSX does not notice any of this — it is HTML from a markdown renderer, a sanitiser or an API that needs the treatment ([dependencies.md](dependencies.md) for what that renderer costs).

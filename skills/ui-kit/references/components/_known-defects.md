<!-- synced-from: docspace-ui-kit-react 4.0.0 docs/known-defects.md -->
<!-- do-not-edit: regenerate with `node tools/sync-ui-kit.mjs --from <kit> --write`; correct the text in the kit -->
<!-- body-sha256: bb629efa1e129819363838f118830585e95404abeac73b231794cad216b897b1 -->

> Synced from the kit's own `docs/known-defects.md` at 4.0.0. Where this page and [SKILL.md](../../SKILL.md) disagree, the skill's rule wins until the kit is corrected.

# Known defects

Found while rewriting the component READMEs against
[`README_TEMPLATE.md`](https://github.com/ONLYOFFICE/docspace-ui-kit-react/blob/df87c36e/README_TEMPLATE.md). Each is a fault in the component, not in its
documentation: the READMEs describe the behaviour as it is, and this list is what should change so
that the description can change with it.

This file replaces `docs/behaviour-notes.md`, the seed list the rewrite worked from, whose entries
have all landed in their components' READMEs.

Every item below was re-verified on 2026-09-23 against the merged
`feature/component-readme-template` tree, with the line it lives on.

## Accessibility

- **`TextInput` takes every field out of the tab order.**
  `components/text-input/sub-components/Input.tsx:26` defaults `tabIndex` to `-1`, so a form built
  from the kit's inputs cannot be filled in from the keyboard unless every field is given an
  explicit `tabIndex`. This is the most serious item here.
- **`FieldContainer` renders its label with an empty `htmlFor`.**
  `components/field-container/FieldContainer.tsx:72` and `:89`. No label in any form built from it
  is associated with its control, so clicking the label focuses nothing and a screen reader
  announces the field unnamed.
- **A `Textarea` in a `FieldContainer` cannot be named at all.** The two defects above leave
  every control unassociated with its label, and a `TextInput` can be patched from outside
  because `TextInputProps` extends `React.InputHTMLAttributes` — `aria-label` reaches the input.
  `TextareaProps` (`components/textarea/Textarea.types.ts:3`) is a closed object type: it
  neither sets an `aria-*` of its own nor accepts one, and it has no `name` or `aria-labelledby`
  either. So a multi-line field has no way to be named short of writing a second, duplicate
  `<label>` beside the visible one. Found by the A7 spot test: an agent given the three READMEs
  named the single-line field and correctly reported the multi-line one as unnameable.
- **`ModalDialog` cannot be given an accessible name.** `role="dialog"` and `aria-modal` sit on the
  click-to-close element, and unknown props — an `aria-label` among them — are spread onto the
  internal `AsideHeader`, and only when a header is rendered. The advice "label it yourself" cannot
  be followed from outside the component. The fix is in `Modal.tsx`: move the role onto the content
  element and let it take the caller's `aria-*`.

## Leaks

- **`ModalDialog` adds a listener on cleanup.** `components/modal-dialog/index.tsx:135` calls
  `window.addEventListener("touchend", onSwipeEnd)` inside the effect's teardown, where every
  sibling line calls `removeEventListener`. Each re-run leaves another listener behind, and the
  effect depends on `visible`, `onClose`, `onBackClick` and both display-type props.

## Code that only looks as though it runs

- **`ThemeProvider` fetches the colour theme with a function that sends no request.**
  `providers/theme/useTheme.ts:93` awaits
  `CommonSettingsApiAxiosParamCreator().getPortalColorTheme()`, whose declared return type is
  `Promise<RequestArgs>` — the param creator builds a URL and options, it does not call the
  portal. The result is cast to `CustomColorThemesSettingsDto`, `.themes` on it is `undefined`,
  and the branch quietly does nothing. So the accent palette is never loaded, in the portal
  either, unless `colorTheme` is passed in.

  It costs more than a dead branch: the import puts `@onlyoffice/docspace-api-sdk` — and
  `axios`, which that package depends on — into every application that mounts `ThemeProvider`,
  which is every application that uses the kit at all. Either call the operation properly
  (`CommonSettingsApi(...).getPortalColorTheme()`) behind something the portal supplies, or
  drop the fetch and make `colorTheme` the only way in. Found while writing the `ui-kit`
  skill's setup page.

## Documentation that outlived its subject

- **The three provider READMEs were never brought to the template.**
  `providers/theme/README.md` still says the theme reaches children through
  `ThemeProviderComponent` and the CSS-in-JS library this package dropped. The component it
  names carries none of it and has not for some time — it writes `data-theme` and `data-dir`
  on `<html>` and the `light`/`dark` and `ltr`/`rtl` classes on `<body>`. `check-readme` never
  saw it: its scope is `components/**` and `docs/*.md`. The three pages ship in the package
  and are copied into the `ui-kit` skill, so they are read. Widen the validator's scope to
  `providers/**/README.md` and rewrite the three against `README_TEMPLATE.md`.

## Props that are declared and never read

Each is documented as ignored in its README, so nobody is misled today; removing them is a breaking
change someone should schedule.

- **`FieldContainer`** — `icon` (`FieldContainer.types.ts:21`), `helpButtonHeaderContent` (`:32`)
  and `offsetRight` (`:47`; the component hard-codes `offsetRight={0}` internally).
- **`WithTooltipProps`** — `tooltipPlace` and `tooltipFitToContent`
  (`components/tooltip/Tooltip.types.ts:136`, `:138`) are declared, stripped from the forwarded
  props by `omitTooltipProps`, and read nowhere.

The READMEs of the components rewritten in phase A4 name many more dead props — `Section` alone
carries about twenty-five, `Article` twelve, `Navigation` six. Those are portal-internal components
whose props mirror a portal store, so the decision there is different in kind and is not listed
here.

## Stylesheet

- **The section header has no height and no background.** `components/section/Section.module.scss`
  declares `--section-header-height` and `--section-header-bg` under `.header :global(.light)`,
  which compiles to `.header .light` — a selector that matches a `.light` element _inside_ the
  header, and nothing does. Both `height` and `min-height` therefore resolve to an invalid `var()`
  and are dropped, so the header sizes to its content instead of the intended 69/61/53px, and the
  section's background resolves to nothing. The nesting wants inverting, as every other file in the
  kit writes it.
- **The bottom of a long `Aside` body cannot be scrolled to.** `components/aside/Aside.module.scss:45`
  makes the panel `position: fixed; height: 100%` and leaves it block-level, and `index.tsx:44`
  renders `AsideHeader` and then `<Scrollbar>{children}</Scrollbar>` with no height of its own — so
  the scrolling holder sizes itself to the whole panel rather than to what is left under the header,
  and its last ~53px sit below the panel's bottom edge. A list long enough to scroll ends with items
  the reader cannot reach. Making `.aside` a flex column and letting the scroller take the remaining
  space fixes it for every consumer at once; today each application patches the scroller's inline
  height itself. Found by the `ui-kit` skill's eval run, building a members panel from the READMEs.

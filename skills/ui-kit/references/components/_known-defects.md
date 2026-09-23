<!-- synced-from: docspace-ui-kit-react 4.0.0 (fafb716c) docs/known-defects.md -->
<!-- do-not-edit: regenerate with `node tools/sync-ui-kit.mjs --from <kit> --write`; correct the text in the kit -->
<!-- body-sha256: 344919f14c1ea7f0b2c7953afe738ac6dcb17ff51d8159cc6f8a23d4574bb2a7 -->

> Synced from the kit's own `docs/known-defects.md` at 4.0.0. Where this page and [SKILL.md](../../SKILL.md) disagree, the skill's rule wins until the kit is corrected.

# Known defects

Found while rewriting the component READMEs against
[`README_TEMPLATE.md`](https://github.com/ONLYOFFICE/docspace-ui-kit-react/blob/fafb716c/README_TEMPLATE.md). Each is a fault in the component, not in its
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

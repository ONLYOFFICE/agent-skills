# Symptom → cause

Every entry here is something the kit does silently: no exception, no warning, nothing in the
console unless it says so.

## Nothing renders as it should

| What you see | Why | Fix |
|---|---|---|
| Every component unstyled | The bundler is not following the CSS each module imports — the kit excluded from transformation, or marked external | Stop excluding it. `styles.css` is the fallback for builds that genuinely cannot, and it ships ~730 KB |
| Colours wrong, or nothing has a background | No `ThemeProvider`, so `<body>` carries no `light`/`dark` class and the components' variables are never declared | Mount it — [`setup.md`](setup.md) |
| Skeletons invisible on a dark surface | Their colours are fixed black at 10%/15% opacity, not themed | Pass `backgroundColor` and `foregroundColor` |
| A component's own `style` also restyles its error text | `FieldContainer` spreads `style` onto the container **and** the error message | Style a wrapper of your own instead |

## Labels and text

| What you see | Why | Fix |
|---|---|---|
| Buttons or toasts with empty labels, `[i18n] Missing translation for key …` in the console | No `TranslationProvider`, or it was given no `translations` — the helper returns `""` when it finds no instance | Pass the Map — [`i18n.md`](i18n.md) |
| A field has no label although `labelText` is set | `FieldContainer`'s `labelVisible` defaults to `false` and the whole label block is behind it | Pass `labelVisible` |
| No error message under an invalid field | It needs `hasError` **and** `errorMessage` | Pass both |
| A toast with no title line | The default title is translated at call time, came back empty, and an empty title renders nothing | Mount the provider; passing `null` deliberately looks identical |

## It does not open, or does not close

| What you see | Why | Fix |
|---|---|---|
| A panel or dialog never appears | The visibility prop is not the one that component reads. There are four names and the wrong one is ignored in silence | `visible`, `isOpen`, `opened`, `open` — the table is in [`overlays.md`](overlays.md) |
| A dialog's slot content is missing | `ModalDialog.Header`/`.Body`/`.Footer` must be **direct** children; wrapped in a fragment or a component of your own they vanish, and any other child is dropped | Put them directly inside `<ModalDialog>` |
| Effects inside a closed dialog keep running | `visible` toggles classes; it mounts and unmounts nothing | Render `<ModalDialog>` conditionally as well |
| A drop-down opens in the wrong place | It positions itself by measuring `forwardedRef`; without it there is no anchor | Pass the ref of the element it hangs from |
| A drop-down never closes | Nothing closes it by itself: `open` is yours, and there is no default event list and no Escape handling | Pass `clickOutsideAction` and `eventTypes` |
| Typing anywhere stops working while a menu is open | The open menu's key handler is on `window` and prevents the default of every key before reading it | `enableKeyboardEvents={false}` |
| `toastr` does nothing | No `<Toast />` is mounted; the call is queued against a container that does not exist | Mount one, once |
| A toast set to 300ms stays five seconds | Any timeout below 750 is silently replaced with 5000 | Use `0` for never, or ≥ 750 |

## Layout

| What you see | Why | Fix |
|---|---|---|
| Fields 32px apart in a column with `gap: 16` | `FieldContainer` brings its own `margin: 0 0 16px`, and a gap adds to it | Drop the gap, or pass `removeMargin` on every field |
| A toggle overlapping the next row | `ToggleButton` occupies no space: its contents are absolutely positioned | Wrap it in an element with an explicit height, ≥ 16px |
| A textarea that will not fill its field | Inside a `FieldContainer`, the container shrank: a `FormWrapper` or a flex row centres or shrink-wraps it. Placed directly in a flex row, the textarea itself shrinks | Give the `FieldContainer` `width: 100%`; a textarea that is itself a flex item takes a class through `wrapperClassName` with `flex: 1 1 auto; min-width: 0`. Not `style`: it lands on the inner scroller, which is already full width, and changes nothing |
| An input stuck at 173px | That is `TextInput`'s base width | `scale` |
| A drop-down list 200px wide under a wide button | `manualWidth` defaults to 200px | `scaledOptions` — and even then the first open can still be 200px |
| Two footer buttons of different widths | One of them is wrapped in an element of yours, so it is no longer an equal flex item | Put the wrapper's style on the button; `Button` forwards `style` |
| A card ignoring its container's width | `FormWrapper` fixes min- and max-width together | Override `--form-wrapper-min-width` **and** `--form-wrapper-max-width` |
| Virtualised rows laid out at zero width | `InfiniteLoader` measures an element found by the literal id `#rowContainer` or `#table-container` | Put the id on the wrapper, or do not use it |

## Keyboard and screen readers

| What you see | Why | Fix |
|---|---|---|
| Clicking a label focuses nothing; the field is announced unnamed | `FieldContainer` was given `labelText` but no `labelFor` | `labelFor` on the container, the same string as `id` on the control |
| A `Textarea` is announced unnamed | Nothing names it: no `labelFor` points at its `id`, and it carries no `aria-label` | `labelFor` on the container and the same string as `id` on the textarea — its `id` lands on the `<textarea>` itself — or `aria-label` when there is no visible caption |
| A dialog is announced without a name | Nothing was passed to name it | `aria-labelledby` pointing at the header's `id`, or `aria-label` |
| Tab skips one control | Something passed `tabIndex={-1}`; or it is `InputBlock`, `SearchInput` or `PasswordInput`, which default to `-1`; or it is a `DropDownItem` | Remove the `tabIndex`, or pass `tabIndex={0}` to the three `InputBlock` controls; on a listbox option the `-1` is correct and the container holds focus |
| Arrow keys do nothing in a `ComboBox` | Its key handler looks for options by a test id its own options never carry | Click, or build the list yourself |

## Imports

| What you see | Why | Fix |
|---|---|---|
| The build fails on an import from the root: `"makeAutoObservable" is not exported by "__vite-optional-peer-dep:mobx"` | The root barrel re-exports `billing` and `uploader`, which import `mobx`, `mobx-react`, `react-router` and `axios` — optional peers the application does not have | Import every component from its subpath |
| `import { Section } from "…/components/section"` is `undefined` | Nine components are default exports on their subpath, and that folder has no named export of them | `import Section from "…/components/section"` |
| An import resolves but the component fetches from a portal that is not there | It is portal-internal — `selectors/*`, `billing`, `uploader`, `ai-agent`, `api`, `providers/api` | [`public-api.md`](public-api.md) |
| Portal-internal names importable from the root with no warning | The root barrel re-exports `./uploader` and `./billing` | Do not use them; `check-usage.mjs` flags them |
| A path into `dist/` stops resolving after an upgrade | The `exports` map is the public surface; build paths are not covered | Import the subpath |
| `PUBLIC_DIR/...` does not resolve | It is a DocSpace client webpack alias, not part of this package | Your own asset, or `@onlyoffice/apps-ui-kit/assets/…` |
| An icon name renders nothing | `IconButton`'s `iconName` is a URL, not a key into an icon set — and a kit asset is a component, not a URL, though it type-checks there | `iconNode={<CrossIcon />}` for a kit asset; `iconName` only for a URL of your own |

## When the kit's page says something else

A component's page — its README in the installed package, or its page on the docs site — is
the kit's own text. Where it contradicts a rule here, the rule is the one that was checked
against the source last, and the kit's page is what should be corrected.

A fault in a component is described on that component's page, under "Behaviour the types don't
state" or "Accessibility". There is no separate list of them: the kit kept one until every entry
in it was fixed, and then removed it rather than leave a second place to go stale.

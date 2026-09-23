# Symptom → cause

Every entry here is something the kit does silently: no exception, no warning, nothing in the
console unless it says so.

## Nothing renders as it should

| What you see | Why | Fix |
|---|---|---|
| Every component unstyled | The bundler is not following the CSS each module imports — the kit excluded from transformation, or marked external | Stop excluding it. `styles.css` is the fallback for builds that genuinely cannot, and it ships 727 KB |
| Colours wrong, or nothing has a background | No `ThemeProvider`, so `<body>` carries no `light`/`dark` class and the components' variables are never declared | Mount it — [`setup.md`](setup.md) |
| Dark theme fine except the toasts | The container renders into `#root`; your root element has another id, so the toasts land on `document.body`, outside the themed element | Give the root element the id `root` |
| Skeletons invisible on a dark surface | Their colours are fixed black at 10%/15% opacity, not themed | Pass `backgroundColor` and `foregroundColor` |
| A component's own `style` also restyles its error text | `FieldContainer` spreads `style` onto the container **and** the error message | Style a wrapper of your own instead |

## Labels and text

| What you see | Why | Fix |
|---|---|---|
| Buttons or toasts with empty labels, `[i18n] Missing translation for key …` in the console | No `TranslationProvider`, or it was given no `translations` — the helper returns `""` when it finds no instance | Pass the Map — [`i18n.md`](i18n.md) |
| A field has no label although `labelText` is set | `FieldContainer`'s `labelVisible` defaults to `false` and the whole label block is behind it | Pass `labelVisible` |
| No error message under an invalid field | It needs `hasError` **and** `errorMessage` | Pass both |
| A toast with a gap where its title would be | The default title is translated at call time and came back empty | Mount the provider, or pass `null` to drop the title |

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
| A textarea that will not fill its field | It has a max-width and no width | `style={{ width: "100%" }}`, plus `flex: 1 1 auto; min-width: 0` in a row |
| An input stuck at 173px | That is `TextInput`'s base width | `scale` |
| A drop-down list 200px wide under a wide button | `manualWidth` defaults to 200px | `scaledOptions` — and even then the first open can still be 200px |
| Two footer buttons of different widths | One of them is wrapped in an element of yours, so it is no longer an equal flex item | Put the wrapper's style on the button; `Button` forwards `style` |
| A card ignoring its container's width | `FormWrapper` fixes min- and max-width together | Override `--form-wrapper-min-width` **and** `--form-wrapper-max-width` |
| Virtualised rows laid out at zero width | `InfiniteLoader` measures an element found by the literal id `#rowContainer` or `#table-container` | Put the id on the wrapper, or do not use it |

## Keyboard and screen readers

| What you see | Why | Fix |
|---|---|---|
| Tab skips every field | `TextInput` and `Checkbox` default `tabIndex` to `-1` | `tabIndex={0}` on every control |
| Clicking a label focuses nothing; the field is announced unnamed | `FieldContainer` renders `htmlFor=""` | Repeat the label as `aria-label` on the control |
| A `Textarea` cannot be named at all | Its props are a closed object type: no `aria-*`, no `name` | There is no workaround. Report it |
| A dialog announced without a name | `role="dialog"` sits on the click-to-close element and an `aria-label` is spread onto the internal header | There is no workaround. Report it |
| Arrow keys do nothing in a `ComboBox` | Its key handler looks for options by a test id its own options never carry | Click, or build the list yourself |

## Imports

| What you see | Why | Fix |
|---|---|---|
| `import { Section } from "@onlyoffice/apps-ui-kit"` does not resolve | Nine components are default exports, and `export *` does not carry a default | Import from the subpath: `import Section from "…/components/section"` |
| An import resolves but the component fetches from a portal that is not there | It is portal-internal — `selectors/*`, `billing`, `uploader`, `ai-agent`, `api`, `providers/api` | [`public-api.md`](public-api.md) |
| Portal-internal names importable from the root with no warning | The root barrel re-exports `./uploader` and `./billing` | Do not use them; `check-usage.mjs` flags them |
| A path into `dist/` stops resolving after an upgrade | The `exports` map is the public surface; build paths are not covered | Import the subpath |
| `PUBLIC_DIR/...` does not resolve | It is a DocSpace client webpack alias, not part of this package | Your own asset, or `@onlyoffice/apps-ui-kit/assets/…` |
| An icon name renders nothing | `IconButton`'s `iconName` is a URL, not a key into an icon set | Pass a URL, or the imported SVG module |

## When the page says something else

Every page under `references/components/` is a copy of the kit's own README, and its header
says so. Where one of them contradicts a rule here, the rule here is the one that was checked
against the source last — and the kit's page is what should be corrected. The defects this
skill knows about are listed in [`components/_known-defects.md`](components/_known-defects.md).

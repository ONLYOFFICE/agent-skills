# Choosing a component

The kit's catalogue — `docs/components.md`, shipped inside the package — lists all 109
components with a row each, and its *close calls* table settles the common confusions (dialog
or aside, text or heading, loader or skeleton); the docs site groups the same components under
[UI](https://api.onlyoffice.com/docspace/ui-kit/ui.md), one page per group. This page is the
part a catalogue cannot state: which of these
components were built for an application like yours, and which are the DocSpace portal's own
furniture that merely happens to ship.

## Most of the kit is a file manager

Of the 109 documented components, 11 are marked portal-internal and will not work outside
DocSpace at all: `Article`, `Section`, `Navigation`, `Filter`, `RoomType`, `PortalLogo`,
`ImageEditor`, `AvatarEditorDialog`, `RoomLogoCoverDialog`, `OperationsProgressButton` and
`TwoStateToggle`. They read a portal store, a device type they are told about, or a
translation function the portal passes down.

Many of the remaining 98 are public only in the sense that they resolve and render. `Rows`,
`Tiles` and `Table` are the portal's file listing in three shapes; `Selector` is its picker;
`Badge`, `RoomIcon` and `RoomLogo` describe rooms. Nothing stops you using them, but they ask
for the portal's data shapes and carry the portal's behaviour, and a plain element of your own
is usually smaller and always more predictable.

**The ones an application of its own reaches for most**, and what they cost nothing to use:

| Job | Component |
|---|---|
| Buttons and links | `Button`, `IconButton`, `Link` |
| A form | `FieldContainer` with `TextInput`, `Textarea`, `ComboBox`, `Checkbox`, `ToggleButton`, `RadioButtonGroup` |
| Text | `Text`, `Heading`, `Label` |
| A dialog or a panel | `ModalDialog`, `Aside` |
| A menu | `DropDown` with `DropDownItem`, `ContextMenu` |
| A message | `toastr` with one mounted `Toast`, `Snackbar`, `StatusMessage` |
| Waiting | `Loader` with an explicit `type`, `RectangleSkeleton`, `CircleSkeleton`, `ProgressBar` |
| Nothing to show | `EmptyView` |
| Small identity bits | `Avatar`, `Badge`, `Tag` |

## Listing things

This is where the wrong choice costs the most, because all three portal families compile,
render, and then behave in ways nothing in their types suggests.

```
Is it the DocSpace file list you are rebuilding?
├─ no  → your own markup. A flex column of Text/Avatar rows is smaller than any of these,
│        and `Table` only pays off with columns the user sorts, resizes or hides.
└─ yes → list view      → `Rows` (RowContainer + Row + RowContent)
         card view      → `Tiles` (TileContainer + the four tile kinds)
         columnar view  → `components/table`
```

What makes them portal furniture rather than list components:

- **`Rows`** reads its children by position and by prop name — `RowContent` takes its columns
  as indexed children, and anything past the second is hidden below a breakpoint — and the
  virtual container measures itself through a literal element id, so two of them on a page
  fight over it.
- **`Tiles`** decides where a child goes by reading that child's `item` prop, and **silently
  drops any child without one**. Your own markup between the tiles does not appear. Its
  skeletons are not re-exported and live at `components/tiles/sub-components/skeletons`.
- **`Table`** persists column widths in `localStorage` under ids that are literals, measures
  the container and rewrites a CSS grid on every resize. One per page.

None of the tiles is keyboard-operable: each is a `div` with click handlers.

## Picking things out of a long list

`Selector` is the generic panel: you fetch a page at a time, it virtualises the rows and asks
for the next page. It has **no visibility prop** — it fills the box you put it in, and
`useAside` is the only switch that makes it a panel. To open it over the page, wrap it in
`ModalDialog` yourself.

The portal's ready-made pickers — `selectors/People`, `selectors/Room`, `selectors/Files`,
`selectors/Groups` — are portal-internal: they fetch through the DocSpace REST client and a
MobX store. Outside the portal they do not work, and importing them pulls both in. Build the
fetching yourself and hand the pages to the generic `Selector`.

For a short, fixed list of options, none of this: that is `ComboBox`.

## Before reaching outside the kit

A few things the kit deliberately does not have, so that looking for them stops early:

- **No form component and no validation.** `FormWrapper` is a white card of a fixed width,
  not a `<form>`. See [`forms.md`](forms.md).
- **No date input.** `DatePicker`, `TimePicker` and `Calendar` are the parts; the field
  around them is yours.
- **No destructive button variant.** A delete confirmation is an ordinary `primary` button
  with `--accent-button` overridden on the button itself.
- **No toast without a mount point.** `toastr.*` does nothing until one `<Toast />` is
  rendered somewhere in the tree.
- **No icon component with a name.** `IconButton`'s `iconName` is a URL, not a key into a
  set. The kit's own icons under `@onlyoffice/apps-ui-kit/assets/` are React components:
  pass one as JSX to `iconNode`, never to `iconName`.

## When the component you want is portal-internal

Read [`public-api.md`](public-api.md) for the boundary and what each module drags in. The
short form: if the page for a component says `status: portal-internal`, or the import is from
`selectors/`, `billing`, `uploader`, `ai-agent`, `api`, `document-editor`, `providers/api` or
`utils/socket`, it is not for an application of your own — and the two of them the root barrel
re-exports, `billing` and `uploader`, reach you without any error to warn you.

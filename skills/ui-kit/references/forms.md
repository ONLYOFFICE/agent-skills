# Building a form

Each control's own page is under `references/components/`; this page is what only shows up
when they are put together. Read it before writing a form of more than one field.

## The shape of a field

A field is a `FieldContainer` wrapping one control. The container draws the label, the
required marker and the error line; the control draws itself and nothing else.

```tsx
import { useState } from "react";
import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";
import {
  InputSize,
  InputType,
  TextInput,
} from "@onlyoffice/apps-ui-kit/components/text-input";

export function NameField() {
  const [name, setName] = useState("");
  const hasError = name.trim() === "";

  return (
    <FieldContainer
      isVertical
      labelVisible
      labelText="Room name"
      isRequired
      hasError={hasError}
      errorMessage="Enter a name"
    >
      <TextInput
        scale
        tabIndex={0}
        type={InputType.text}
        size={InputSize.base}
        value={name}
        onChange={(event) => setName(event.target.value)}
        hasError={hasError}
        aria-label="Room name"
      />
    </FieldContainer>
  );
}
```

Five things in that block are not optional, and four of them are silent when missed.

| Written | Left out |
|---|---|
| `labelVisible` | No label, no required marker, no help button. `labelText` alone renders nothing and reports nothing — the default is `false` |
| `tabIndex={0}` | The field cannot be reached by keyboard: the input defaults to `tabIndex = -1` |
| `type` and `value` on `TextInput` | Both are required props; TypeScript catches this one |
| `hasError` **and** `errorMessage` | No message. One without the other renders nothing |
| `aria-label` on the control | The field is announced unnamed — see below |

## Three defects to work around, every time

These are faults in the kit, recorded in its own
[`known-defects.md`](components/_known-defects.md). Until they are fixed, a form has to
carry the workaround.

1. **Nothing is in the tab order.** `TextInput`'s inner input and `Checkbox` both default
   `tabIndex` to `-1`. Pass `tabIndex={0}` to every control in every field.
2. **The label is associated with nothing.** `FieldContainer` renders its `<label>` with an
   empty `htmlFor`, so clicking a label focuses nothing and a screen reader announces the
   field unnamed. Repeat the label as `aria-label` on the control.
3. **A `Textarea` cannot be named at all.** Its props are a closed object type: no `aria-*`,
   no `name`, no `aria-labelledby` reaches it. There is no workaround short of a second,
   duplicate `<label>` of your own. Say so rather than inventing a prop.

## Spacing: do not add a gap

`FieldContainer` carries `margin: 0 0 16px` of its own. A flex column with `gap: 16` spaces
the fields **32px** apart, because the gap adds to the margin instead of replacing it.

- Stack the fields in a plain column with no `gap`, or
- pass `removeMargin` on every container and own the spacing yourself.

`FormWrapper` — the portal's white card — adds 32px of padding on top of that, and centres
its children, so a control without a width of its own shrinks to its content inside it. Give
every control `scale` in a card.

## Which control

The catalogue's [close calls](components/README.md#the-close-calls) covers the common
confusions. What it cannot show:

| The field is | Use | Because |
|---|---|---|
| One line of text | `TextInput` inside `FieldContainer` | `type` and `value` are required; 173px wide unless `scale` |
| Several lines | `Textarea` with `wrapperClassName` giving `width: 100%` | It has a max-width and no width, so it does not fill its field |
| A choice from a short list | `ComboBox` | Not a native `<select>`: it renders a button and a drop-down |
| A search box over a list | `SearchInput` | Its `onChange` receives the **string**, unlike every other input here |
| On or off, one setting | `ToggleButton` in a wrapper with a height | It occupies no space of its own and overlaps what follows |
| On or off, a list of them | `Checkbox` | Its label wraps; the toggle's does not |
| One of a few options, all visible | `RadioButtonGroup` | |
| A password, an email, a file path | `PasswordInput`, `EmailInput`, `FileInput` | Each wraps `TextInput` and adds its own control |

## What each one does that a form has to know

**`TextInput`** — `onChange` receives the `ChangeEvent`. Without `scale` it is 173px whatever
its container is. `maxLength` defaults to 255.

**`Textarea`** — no width of its own, a max-width of 1200px. The width goes on the outer
wrapper and `wrapperClassName` is the only way to it: the `style` you pass is spread onto the
inner `Scrollbar`, whose own rule is already `width: 100% !important`, so a `style` reads as
though it worked and changes nothing. In a flex row put `flex: 1 1 auto; min-width: 0` in the
same class, or it refuses to shrink.

**`ComboBox`** — selects nothing by itself: `onSelect` hands you the option, `selectedOption`
is yours to store and pass back. The match is by **label**, not key, so two options reading
the same are both selected; `withLabel={false}` compares keys instead. The list is 200px wide
unless `scaledOptions` is set, and the option you are on is rendered greyed out and
unclickable — that is how the current value is shown, not a bug to work around. Its keyboard
handling does not work at all.

```tsx
import { useState } from "react";
import { ComboBox, type TOption } from "@onlyoffice/apps-ui-kit/components/combobox";

const ROLES: TOption[] = [
  { key: "viewer", label: "Viewer" },
  { key: "editor", label: "Editor" },
];

export function RoleField() {
  const [role, setRole] = useState<TOption>(ROLES[0]);
  return <ComboBox options={ROLES} selectedOption={role} onSelect={setRole} scaled scaledOptions />;
}
```

**`SearchInput`** — `onChange(value: string)`. It is debounced by a second by default; a list
filtered in memory wants `refreshTimeout={0}`. `autoRefresh={false}` does not make it
immediate, it stops the callback firing at all. The clear button deliberately does not call
`onChange`, so handle `onClearSearch` too or the list keeps the old term.

**`Checkbox`** — keeps its own checked state, seeded from `isChecked`. A click flips the box
immediately; if your handler rejects the change, passing the same value back does not reset
it. Its change event does not bubble, so a `<form>` listening at the root never sees it.

**`ToggleButton`** — paints where it would have been and takes no space, so it overlaps the
next row. Wrap it in an element with an explicit height, at least 16px. `isLoading` animates
the knob and disables nothing.

## Validating and submitting

The kit has no form component, no validation and no submit handling: `FormWrapper` is a card,
not a `<form>`. Use a `<form>` of your own around the fields.

- Derive `hasError` per field in your own state and pass it to both the `FieldContainer` and
  the control — the container draws the message, the control draws the red border.
- No space is reserved for the error line, so the fields below shift down the first time one
  appears. Reserve the height yourself if that matters.
- Native `required` and the browser's own validation block the submit event before your
  handler runs, and with it the error state the container needs. Put `noValidate` on the
  `<form>` and validate in the handler.
- Make the submit button `primary` and put one primary button on a screen. In a dialog
  footer, primary first and cancel second; both `scale`, both direct children of the footer.

## Read-only and disabled

`isReadOnly` on the inputs and `isDisabled` on the buttons and the `ComboBox`. There is no
form-wide switch: a form that goes read-only while saving passes the flag to every control.

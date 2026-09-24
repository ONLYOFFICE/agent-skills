# Testing a screen built on the kit

Nothing about the kit needs a special test runner. What it does need is the providers, and an
awareness that several of its controls are not reachable the way a testing library expects.

## Render with the providers

A component rendered bare is not merely unthemed — the document carries no `light`/`dark`
class, so none of the component's CSS variables are ever declared, and anything asserting on
computed styles sees empty strings. Wrap the render:

```tsx
import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { ThemeKeys } from "@onlyoffice/apps-ui-kit/enums";
import { ThemeProvider } from "@onlyoffice/apps-ui-kit/providers/theme";
import { TranslationProvider } from "@onlyoffice/apps-ui-kit/providers/translation";
import common from "@onlyoffice/apps-ui-kit/locales/en/Common.json";

const translations = new Map([["en", new Map([["Common", common]])]]);

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialTheme={ThemeKeys.BaseStr} locale="en">
      <TranslationProvider locale="en" translations={translations}>
        {children}
      </TranslationProvider>
    </ThemeProvider>
  );
}

export function renderWithKit(ui: ReactElement) {
  return render(ui, { wrapper: Providers });
}
```

Leave `TranslationProvider` out and the kit's own labels render as empty strings, which makes
`getByText("Done")` fail on a toast for a reason that has nothing to do with the test.

## Finding things

The kit puts `data-testid` on its components — `button`, `aside`, `modal-dialog` and so on —
and each component's page lists the ids it renders under *Test ids*. `getByTestId` is the
reliable handle.

`getByRole` and `getByLabelText` work where the screen was built properly, and that is worth
knowing as a test of the screen rather than of the kit:

- `getByLabelText` finds a field only when `FieldContainer` was given `labelFor` and the control
  the matching `id`. Finding nothing usually means the screen forgot the pair, not that the
  query is wrong.
- `getByRole("dialog", { name })` matches when `ModalDialog` was given `aria-labelledby` or
  `aria-label`. The role is on the dialog surface, not on the click-to-close layer.
- `Checkbox` is the exception: the focusable element is the SVG icon, and the input beneath it
  is hard-coded to `tabIndex={-1}`. So the element with the role is not the one focus lands on,
  and a keyboard test has to aim at the icon.

## Things that behave differently than a test expects

- **`ModalDialog` renders its children whether `visible` is true or false.** A test asserting
  "the body is not in the document while closed" fails unless the dialog itself is rendered
  conditionally. The same fact means effects inside the body run in a closed dialog.
- **`Checkbox` is not controlled.** A click flips the box immediately; if the handler rejects
  the change, passing the same `isChecked` back does not flip it back.
- **`Checkbox`'s change event does not bubble** — the component stops propagation, so a
  listener on the form root never fires.
- **`SearchInput` is debounced by a second.** Either pass `refreshTimeout={0}` in tests or
  advance fake timers; and clearing the field does not call `onChange` at all.
- **Dialogs, drop-downs and toasts render through portals** into `document.body` (the toast
  container into `#root`, falling back to the body). Query with `screen`, not with the
  container the render returned.
- **`ComboBox`'s keyboard handling does not work**, so a test that opens it with Enter tests
  nothing. Click the button and click the option.

## What a test cannot tell you

The kit's stylesheets are real CSS files imported by the components, so jsdom loads none of
their rules: widths, the absolutely positioned `ToggleButton` and the doubled spacing of a
`FieldContainer` in a gapped column are all invisible to a unit test. Those are caught by
looking at the screen, or by `node $SKILL/scripts/check-usage.mjs <project>`, which reads the
code rather than running it.

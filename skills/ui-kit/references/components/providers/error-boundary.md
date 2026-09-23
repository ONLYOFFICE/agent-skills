<!-- synced-from: docspace-ui-kit-react 4.0.0 providers/error-boundary/README.md -->
<!-- do-not-edit: regenerate with `node tools/sync-ui-kit.mjs --from <kit> --write`; correct the text in the kit -->
<!-- body-sha256: 824a19fa8f564124cb167f73ad339f70e5450af347b7dc60496da6333772b3d6 -->

> Synced from the kit's own `providers/error-boundary/README.md` at 4.0.0. Where this page and [SKILL.md](../../../SKILL.md) disagree, the skill's rule wins until the kit is corrected.

# ErrorBoundary

Catches JavaScript errors anywhere in the child component tree and renders a fallback UI instead of crashing the whole application.

## Props

| Prop       | Type                                           | Required | Description                                      |
| ---------- | ---------------------------------------------- | -------- | ------------------------------------------------ |
| `fallback` | `ReactNode \| ((error: Error) => ReactNode)`   | No       | Custom fallback UI; defaults to `ErrorContainer` |
| `onError`  | `(error: Error, errorInfo: ErrorInfo) => void` | No       | Callback invoked when an error is caught         |
| `children` | `React.ReactNode`                              | Yes      | Child components to monitor for errors           |

## Usage

### Default fallback

When no `fallback` is provided, a built-in `ErrorContainer` is rendered with the error message.

```tsx
import { ErrorBoundary } from "@onlyoffice/apps-ui-kit/providers/error-boundary";

<ErrorBoundary>
  <App />
</ErrorBoundary>;
```

### Custom fallback (ReactNode)

```tsx
<ErrorBoundary fallback={<div>Something went wrong. Please reload.</div>}>
  <App />
</ErrorBoundary>
```

### Custom fallback (render function)

The render function receives the caught `Error`, so the fallback can display dynamic details.

```tsx
<ErrorBoundary
  fallback={(error) => <div>Error: {error.message}</div>}
  onError={(error, errorInfo) => sendCrashReport(error, errorInfo)}
>
  <App />
</ErrorBoundary>
```

## How it works

1. Uses a React class component with `getDerivedStateFromError` to catch render errors
2. Calls the optional `onError` callback inside `componentDidCatch` for error reporting
3. Renders the `fallback` prop (or the default `ErrorContainer`) when an error is caught
4. Renders `children` normally when no error has occurred

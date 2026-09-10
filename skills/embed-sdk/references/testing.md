# Testing embedded ONLYOFFICE Apps frames

What can and cannot be asserted, based on a working Playwright suite for the SDK.

## What to assert

The reliable contract is the **generated `iframe.src` URL**, not the DOM inside the frame:

```ts
await page.goto("/");
await page.evaluate((cfg) => window.DocSpace.SDK.initFileSelector(cfg), config);
const frame = page.locator("iframe#ds-frame");
await frame.waitFor({ state: "attached" });
const src = await frame.getAttribute("src");
const url = new URL(src);
expect(url.origin).toBe(config.src);
expect(url.pathname).toContain("/sdk/file-selector");
expect(url.searchParams.get("theme")).toBe(config.theme);
```

Caveats observed in practice:

- **`mode` is not reliably present as a query param** — assert the pathname instead
  (see the mode→path table in [config-reference.md](config-reference.md)).
- Some params appear only when explicitly set — guard with `searchParams.has(...)` before
  asserting; `filter` may arrive JSON-encoded, wrap parsing in try/catch.
- Give the frame time: wait for the iframe to attach; UI inside it needs seconds more.

## What NOT to assert

The DOM inside the ONLYOFFICE Apps iframe (headers, menus, filters) is cross-origin in real
deployments and version-dependent — treat any reach-in as best-effort, wrapped in
try/catch, never as a hard assertion.

## Unit level (host app)

- jsdom is enough for config-level tests: no real iframe or postMessage needed — assert
  what `init*` renders (container, iframe attributes) and what your handlers do with
  simulated event payloads.
- The ESM import registers `window.DocSpace.SDK` as a side effect — tests may rely on the
  global, but remember it's the module, not your code, that sets it.

## System mode in tests

A System frame never finishes loading by itself — call
`window.DocSpace.SDK.frames[frameId].setIsLoaded()` after init or the loader spins forever.

## E2E environment checklist

- The test host origin must be CSP-allow-listed on the target portal (or run same-origin).
- Fixture entity ids (file/room ids) are portal-specific — keep them in one constants file
  and document which portal they belong to.
- The portal must actually serve the SDK version you target:
  `GET {portal}/static/scripts/sdk/{v}/api.js` → 200.

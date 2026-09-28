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

On clients from late 2025 on the System page reports its own load. On an older portal the loader
spins until you call `window.DocSpace.SDK.frames[frameId].setIsLoaded()` after init.

## E2E environment checklist

- The test host origin must be CSP-allow-listed on the target portal (or run same-origin).
- Fixture entity ids (file/room ids) are portal-specific — keep them in one constants file
  and document which portal they belong to.
- The portal must actually serve the SDK version you target:
  `GET {portal}/static/scripts/sdk/{v}/api.js` → 200.

## Self-check protocol — run it before handing the integration over

Ten iterations of "it still does not load" are cheaper to avoid than to debug. After the
code is written, and before reporting success, go through this in order and quote the
results in the report. Every step is scriptable; a Playwright run covers 3–6.

1. **Portal facts.** `node $SKILL/scripts/probe-portal.mjs {portal} --origin {dev origin}`:
   bundle version, frame headers, OAuth discovery, allow-list. Any red line here is the
   portal admin's task, not yours — report it as such.
2. **Configs.** Every `TFrameConfig` you produced passes
   `node $SKILL/scripts/validate-config.mjs '<json>'` with 0 errors.
3. **The frame attaches.** Start the dev server, open the page, wait for
   `iframe#{frameId}` to be attached and assert `new URL(src)`: origin = the portal, pathname =
   the mode's base path (table in [config-reference.md](config-reference.md)), `frameId` in
   the iframe `name` (`frameDocSpace__#{frameId}`).
4. **The console is clean of SDK warnings.** No `SDK Warning: src is empty`, no
   `Message bus is not connected`, no `SDKError` in the console; no `Refused to display`
   / `frame-ancestors` message from the browser (that is the header problem from step 1).
5. **`onAppReady` fires within 15 s**, then `onContentReady`. A frame that attaches but
   never reports ready is a version, header or cookie problem — do not touch the config yet;
   re-read step 1 and the token table in SKILL.md.
6. **One real action per mode you shipped**: manager lists the room (`getFolderInfo()` resolves
   with a `title`); selector `onSelectCallback` fires with the shape you handle; editor/viewer
   shows the document (`onAppReady` in `/doceditor`); system frame `getUserInfo()` returns the
   expected `email` after login; chat shows a composer, not only "Chat history".
7. **Auth failure path.** Wrong password → `login()` resolves with `status !== 200` and your
   UI shows its own error, not a spinner; a data call that fails (a folder the user cannot write)
   rejects with `API_ERROR` and lands in your `catch`. OAuth: kill the token endpoint → `onAuthError`
   fires and your re-login UX appears.
8. **Report** to the user: portal URL and SDK version, connection method (npm/IIFE), the
   origins that must be on the allow-list (dev and prod), the modes used, what step 6
   showed, and every line the skill does not cover that you touched (REST calls, 2FA,
   portal headers).

Playwright skeleton for steps 3–6:

```ts
const warnings: string[] = [];
page.on("console", (m) => { if (/SDK|frame-ancestors|Refused to display/.test(m.text())) warnings.push(m.text()); });
await page.goto("/");
const frame = page.locator("iframe#ds-frame");
await frame.waitFor({ state: "attached" });
expect(new URL((await frame.getAttribute("src"))!).origin).toBe(PORTAL);
await page.waitForFunction(() => (window as any).__appReady === true, null, { timeout: 15_000 }); // set in onAppReady
expect(warnings).toEqual([]);
```

Set `window.__appReady = true` inside your `onAppReady` handler for the test build, or
expose the events through your own state — the SDK does not expose readiness otherwise.

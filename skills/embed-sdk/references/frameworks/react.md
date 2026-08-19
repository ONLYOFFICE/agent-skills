# React recipe

## The StrictMode trap — handle it first

React 18+ StrictMode double-invokes effects in dev: init → destroy → init. Without a
guard the frame breaks or duplicates. Two options:

```tsx
function DocSpaceFrame({ config }: { config: TFrameConfig }) {
  const instanceRef = useRef<SDKInstance | null>(null);

  useEffect(() => {
    const sdk = new SDK();
    instanceRef.current = sdk.init(config);   // re-init on same frameId reuses the instance
    return () => {
      instanceRef.current?.destroyFrame();
      instanceRef.current = null;
    };
  }, []);       // init once; use key= to force remount on identity change

  return <div id={config.frameId} />;
}
```

The registry-based re-init makes the double mount survivable; if you still see artifacts,
disable StrictMode for the embed page (a real production sample ships with it off).

## Patterns that work in production

- **Instance in a ref**, never in state — it's not renderable data.
- **Remount by key**: `<DocSpaceFrame key={roomId} config={...} />` — changing the target
  entity forces a clean destroy/init cycle.
- **Reveal on `onContentReady`**: render the container hidden (CSS class) with your own
  spinner; unhide in `onContentReady`, not `onAppReady`.
- **Keep editor state across tabs**: don't unmount editor frames on tab switch — hide
  them with `display:none` (unmount = destroy = lost editor state). One unique `frameId`
  per document: `` `editor-${file.id}` ``.
- **Callbacks into config**: memoize handlers you pass in `config.events` or build the
  config inside the effect — a new events object per render does nothing until re-init.

## The official wrapper: @onlyoffice/docspace-react

`<DocSpace url={...} config={...} email={...} onRequestPasswordHash={...}
onUnsuccessLogin={...} onSetDocspaceInstance={(i) => ref.current = i} />`

It owns mount/unmount (destroys on unmount) and runs a built-in silent login: hidden
System frame → `getUserInfo` (email match = skip) → `login(email, hash)`; on failure calls
`onUnsuccessLogin`, on missing credentials silently falls back to the cookie session.

Caveats:
- The wrapper **bundles its own copy of the SDK**, and the bundled version does not match
  the wrapper's own version number. Verified: `@onlyoffice/docspace-react@2.1.0` bundles
  `@onlyoffice/docspace-sdk-js@2.0.0` — so the wrapper has **no forms/chat/personal modes
  and no OAuth (`getToken`)** even though a 2.1.0 SDK exists. Always check the real bundled
  version: `node_modules/@onlyoffice/docspace-react/package.json` → `dependencies` →
  `@onlyoffice/docspace-sdk-js`. Then match it against the portal (SKILL.md Step 0).
- Grab the instance via `onSetDocspaceInstance` into a ref to call methods.

Use the wrapper for the credential-replay flow; use the SDK directly for OAuth
(`getToken`), fine-grained lifecycle, or modes the wrapper's bundled SDK predates.

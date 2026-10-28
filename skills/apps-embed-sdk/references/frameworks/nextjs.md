# Next.js recipe

`window.DocSpace` does not exist during SSR/prerender. Everything from the
[React recipe](react.md) applies, plus:

## Client-only embedding

```tsx
"use client";                       // App Router: the embed is a client component

import { useEffect, useRef } from "react";

export default function DocSpacePage() {
  const ref = useRef<any>(null);

  useEffect(() => {
    let instance: any;
    // import inside the effect — the module touches window at import time
    import("@onlyoffice/docspace-sdk-js").then(({ default: SDK }) => {
      instance = new SDK().initManager({ frameId: "ds-frame", src: PORTAL_URL });
      ref.current = instance;
    });
    return () => instance?.destroyFrame();
  }, []);

  return <div id="ds-frame" style={{ height: "700px" }} />;
}
```

Alternative: wrap the frame component and load it with
`dynamic(() => import("./DocSpaceFrame"), { ssr: false })`.

## Portal-hosted IIFE variant

When Step 0 (SKILL.md) says "use the portal bundle", load it with `next/script` and init
on ready:

```tsx
<Script
  src={`${PORTAL_URL}/static/scripts/sdk/2.2.0/api.js`}
  strategy="afterInteractive"
  onReady={() => window.DocSpace.SDK.initManager({ frameId: "ds-frame", src: PORTAL_URL })}
/>
<div id="ds-frame" />
```

Keep `@onlyoffice/docspace-sdk-js` as a devDependency for TypeScript types.

## Checklist

- Never touch `window.DocSpace` in server components, `getServerSideProps`, or module
  top-level of a shared file.
- The dev origin (`http://localhost:3000`) must be CSP-allow-listed on the portal, same
  as production.
- StrictMode is on by default in Next dev — apply the guard from the React recipe.

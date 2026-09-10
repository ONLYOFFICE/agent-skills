# ONLYOFFICE Docs API - Callback Handler Skill Guide

## Context & Purpose

The server-to-server callback (`callbackUrl`) your storage backend must implement: how to interpret lifecycle status, co-editing, force-save, and required response payloads sent by the editing service.

## Reference Documentation Map

* **Callback Handler Overview:** https://api.onlyoffice.com/docs/docs-api/usage-api/callback-handler
* **Parent Skill:** Listed as a required companion service in [`api.md`](../api.md).
* **Source Config:** The endpoint is declared as `editorConfig.callbackUrl` — see [`configuration/editor.md`](../configuration/editor.md).
* **Token Verification:** See [`signature/body.md`](../signature/body.md) ("Callback Handler (Outbox)") for validating the `token` claim on every incoming request.

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for multi-tier lifecycle chains (mail merge hooks, form submission streams, history zip unpacking).

## Required Response Payload

The backend must return this exact response, or the editor's saving flow raises an error:
```json
{
  "error": 0
}
```

## Status Codes (`status`)

Every callback carries an integer `status`; branch on it:

| Status Value | Meaning | Expected Action |
| :--- | :--- | :--- |
| **1** | Being edited | Log user connect/disconnect. |
| **2** | Ready for saving | **CRITICAL:** download from `url`, overwrite storage, save history. |
| **3** | Saving error | Log the error; keep the tracking session state. |
| **4** | Closed with no changes | Release locks; run teardown. |
| **6** | Force-save snapshot | **CRITICAL:** download from `url`, but keep the tab open. |
| **7** | Force-save error | Log the failure; retain state. |

## Request Payload Fields

| Parameter | Type | Required | Description / Constraints |
| :--- | :--- | :--- | :--- |
| **status** | integer | **YES** | 1, 2, 3, 4, 6, or 7. |
| **key** | string | **YES** | Matches the active editing key. |
| **url** | string | No | File download link (status 2, 3, 6, 7). |
| **changesurl** | string | No | Tracked-revision data for history. |
| **users** | string[] | No | Users active in this session. |
| **forcesavetype**| integer | No | Present when `status` is 6 or 7; what triggered the snapshot. |

### `url`'s host is not something your backend controls

Document Server builds `url` from the origin *the browser* used to load and
talk to it during that editing session — not from any address your backend
is configured with. If the browser reached Document Server at a "public"
address (see [`api.md`](../api.md)'s Bootstrap section on why that's often
different from what your backend uses server-to-server), `url` on this
callback will use that same public address, and your backend must be able
to resolve and reach it too — from wherever this handler runs, which may be
a different network namespace than the browser (a container vs. the host,
for instance).

This bites hardest in a local Docker Compose setup: if the browser-facing
address is `http://localhost:8080`, `url` will say `http://localhost:8080/
cache/files/...` — and `localhost` inside your backend's own container
means *that container*, not your host machine, so the download fails with a
connection-refused error, not an auth error. `localhost` specifically can
never work for this, because it's namespace-relative by definition.

**Fix it in the code that downloads, not the network**: your backend already
knows both addresses (its own internal one, and the public one it handed to
the browser) — when a URL Document Server gave you matches the public
origin, swap in the internal origin before fetching, keeping the path and
query untouched (the cache key, md5, expiry, and shardkey Document Server
generated aren't tied to which origin reached it, only to the file). This
needs no host-file entry, no compose networking trick, and no manual setup
on a fresh clone.

This is not a dev-only workaround with a production no-op bolted on — the
same two-address split is a legitimate production topology in its own
right, and the identical rewrite does real work there too. Two cases, one
rule:

* **One public domain for Document Server** (small/simple deployments): the
  internal and public addresses are the same real domain, so the rewrite is
  a no-op — it costs nothing to leave in, and removing it would just be
  removing dead code for no benefit.
* **Split internal/public addresses in production** (Document Server sits
  behind an internal load balancer or private-VPC DNS record your backend
  uses for lower latency and no public egress, while the browser reaches it
  through a separate public domain/CDN/ingress): the rewrite is doing
  exactly the same job it does in local Docker Compose — translating a
  browser-origin URL back to the address this backend can actually route
  to. This is a common, intentional production architecture, not an edge
  case to special-case away.

Either way, configure both addresses (they default to equal, so a simple
deployment needs zero extra configuration) and let the rewrite handle
whichever relationship between them turns out to be true at runtime. See
`internal/documents/adapters/output/onlyoffice`'s `Client.WithPublicOrigin`
in the reference Go sample app for the pattern (rewrite at the HTTP-client
boundary, not scattered through call sites) — and
[`infrastructure/docker.md`](../infrastructure/docker.md) for the Compose
env-var wiring this depends on.

## Example (Express.js)

```javascript
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

// Assumes body-parser middleware: app.use(express.json());
app.post("/api/onlyoffice/callback", async (req, res) => {
  try {
    const { status, url, key, changesurl, history } = req.body;

    switch (status) {
      case 1:
        console.log(`User session update for key: ${key}`);
        break;
      case 2: // Finalized, ready for archival write
      case 6: // Force-save triggered by a user or scheduler
        if (url) {
          const downloadResponse = await fetch(url);
          if (!downloadResponse.ok) {
            throw new Error(`ONLYOFFICE download failed: ${downloadResponse.statusText}`);
          }

          const targetSavePath = path.join("/var/www/storage", `${key}.docx`);
          const fileWriteStream = fs.createWriteStream(targetSavePath);

          await pipeline(downloadResponse.body, fileWriteStream);
          console.log(`File saved for key: ${key}`);
        }
        break;
      case 4:
        console.log(`Editor closed with no changes for key: ${key}`);
        break;
      default:
        console.warn(`Unregistered status: ${status}`);
    }

    return res.json({ error: 0 });
  } catch (error) {
    console.error(`Callback processing error:`, error);
    return res.status(500).json({ error: 1 });
  }
});
```

## Constraints & Anti-Patterns

* **Missing `{"error": 0}`:** ONLYOFFICE retries the callback indefinitely, assuming a network timeout.
* **Skipping token verification:** When JWT is enabled, the body carries a `token`. Verify it *before* downloading, or you're open to data-injection attacks. See [`signature/body.md`](../signature/body.md).
* **Blocking downloads:** Large files can take time — process them asynchronously so you don't block the connection.
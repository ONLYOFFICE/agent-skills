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
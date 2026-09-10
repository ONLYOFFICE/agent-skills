# ONLYOFFICE Docs API - command Skill Guide

## Context & Purpose

The server-to-server **Command Service**: outbound commands your storage backend sends to trigger operations in an active editor session (forcesave, drop user, etc.).

## Reference Documentation Map

* **Base Command Service:** https://api.onlyoffice.com/docs/docs-api/additional-api/command-service
* **Parent Skill:** Listed as a server-to-server automation companion in [`api.md`](../api.md).

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for edge cases like the forgotten-file list (`getForgottenList`).
* **Endpoint:** POST to `https://documentserver/command`.

## Load Balancing

* Since v8.1, append `shardkey` to the URL with the target document key (e.g. `/command?shardkey=Khirz6zTPdfd7`) so a clustered Document Server can route consistently.

## Commands (`c`)

| Command (`c`) | Description | Primary Accompanying Claims |
| :--- | :--- | :--- |
| **forcesave** | Saves the current document snapshot without closing it. | `key` (string) |
| **info** | Returns active editing sessions and stats. | `key` (string) |
| **drop** | Disconnects target user connections. | `key` (string), `users` (string[]) |
| **meta** | Pushes metadata updates to all live editors. | `key` (string), `meta` (object) |
| **version** | Returns the deployed ONLYOFFICE Docs version. | *None* |

## Payload

If JWT is enabled, wrap the full request in a signed token under `token` (inbox case — see [`signature/body.md`](../signature/body.md) and the [`signature.md`](../signature/signature.md) family index):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjIjoiaW5mbyIsImtleSI6IktoaXJ6NnpUUGRmZDcifQ..."
}
```

## Response Error Codes

| Error Code | Meaning |
| :--- | :--- |
| **0** | Success. |
| **1** | `key` missing or not found in memory. |
| **2** | `callbackUrl` assigned at document load is unreachable or invalid. |
| **3** | Internal server error. |
| **4** | No changes since last save (`forcesave` rejected). |
| **6** | Invalid token signature or mismatched secret. |

## Example (Node.js)

```javascript
import jwt from "jsonwebtoken";

async function triggerForceSave(documentKey, jwtSecret) {
  const commandEndpoint = `https://your-documentserver.com{documentKey}`;
  const payloadClaims = {
    c: "forcesave",
    key: documentKey
  };
  const signedToken = jwt.sign(payloadClaims, jwtSecret, { algorithm: "HS256" });
  try {
    const response = await fetch(commandEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token: signedToken })
    });

    if (!response.ok) {
      throw new Error(`Command Gateway failed: ${response.statusText}`);
    }

    const result = await response.json();

    const COMMAND_ERROR_MESSAGES = {
      1: "Command key missing or not found in memory.",
      2: "callbackUrl assigned at document load is unreachable or invalid.",
      3: "Internal server error.",
      4: "No changes since last save (forcesave rejected).",
      6: "Invalid token signature or mismatched secret.",
    };

    if (result.error === 0) {
      console.log(`Force-save executed.`);
    } else {
      // Map every non-zero code individually — collapsing 1/2/3/6 into one
      // "rejected" bucket loses exactly the distinction the table exists for.
      console.error(COMMAND_ERROR_MESSAGES[result.error] ?? `Unrecognized command error ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error(`Failed to dispatch command:`, error);
    throw error;
  }
}
```
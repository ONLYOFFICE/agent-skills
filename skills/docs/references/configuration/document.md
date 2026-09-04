# ONLYOFFICE Docs API - document Skill Guide

## Context & Purpose

The `document` section of the root `config`: file identity, download source, metadata, and permissions.

## Reference Documentation Map

* **Base Document Section:** https://api.onlyoffice.com/docs/docs-api/usage-api/config/document
* **Document Info Sub-section:** https://api.onlyoffice.com/docs/docs-api/usage-api/config/document/info
* **Document Permissions Sub-section:** https://api.onlyoffice.com/docs/docs-api/usage-api/config/document/permissions
* **Reused By:** This exact `document` shape is also the `config` argument to `docEditor.refreshFile(config)` — see [`methods.md`](../methods.md).

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for ambiguous cases, or deep access-matrix/custom-sharing schemas.
* **Routing:** Structural fields, download URL, revision key -> **Base Document Section**. Storage/ownership metadata -> **Document Info**. Per-user action locks -> **Document Permissions**.

## Required Parameters

1. **fileType** (string) - *REQUIRED* — extension of the file to open (e.g. `docx`, `xlsx`, `pptx`, `pdf`), lowercase.
2. **key** (string) - *REQUIRED* — unique document identifier from your service. Max 128 chars; update on every save so editing sessions don't reference stale cache.
3. **title** (string) - *REQUIRED* — filename (with extension) shown to users.
4. **url** (string) - *REQUIRED* — absolute URL the editing service downloads the source file from.

## Core Configuration Options

| Parameter | Type | Default | Description / Constraints |
| :--- | :--- | :--- | :--- |
| **fileType** | string | *None* | File extension. Required. |
| **key** | string | *None* | Unique revision key. Required. |
| **title** | string | *None* | Display filename. Required. |
| **url** | string | *None* | Download URL. Required. |
| **info** | object | `{}` | Optional descriptive metadata block. Detailed below. |
| **permissions** | object | `{}` | Optional per-user restrictions block. Detailed below. |

### `info`
```json
"info": {
  "favorite": false, // Highlights the Favorite icon in the header.
  "folder": "Example Files", // Where the document is stored, for display.
  "owner": "John Smith", // File creator/owner display name.
  "sharingSettings": [ // Visibility of the file to other users.
    {
      "isLink": false, // Show a generic link icon instead of an avatar.
      "permissions": "Full Access", // e.g. "Full Access", "Read Only".
      "user": "John Smith"
    }
  ],
  "uploaded": "2010-07-07 3:46 PM"
}
```

### `permissions`
Governs what the current user can do with the open document. *Note: defaults depend on the editor's `mode` — `"view"` implicitly blocks editing actions unless a permission overrides it.*
```json
"permissions": {
  "comment": true, // View/create/edit comments.
  "copy": true, // Copy content to the clipboard.
  "download": true, // Show the download/export button.
  "edit": true, // Allow edits to sync back.
  "print": true, // Allow printing.
  "review": true // Allow track-changes actions.
}
```

## Example

```javascript
const config = {
  document: {
    fileType: "docx",
    key: "Khir6bWFzXzI",
    title: "Project_Proposal.docx",
    url: "https://your-backend-storage.com",
    info: {
      favorite: true,
      folder: "Q3 Strategy Docs",
      owner: "Jane Doe",
      sharingSettings: [
        {
          isLink: false,
          permissions: "Full Access",
          user: "Jane Doe"
        }
      ],
      uploaded: "2026-08-31 10:00 AM"
    },
    permissions: {
      comment: true,
      copy: true,
      download: true,
      edit: true,
      print: false,
      review: true
    }
  }
};
```
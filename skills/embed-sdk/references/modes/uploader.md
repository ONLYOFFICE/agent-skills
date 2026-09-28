# Uploader mode

A drop-zone UI that uploads files into the folder given by `id`.

```js
sdk.initUploader({
  frameId: "ds-frame",
  src: portalUrl,
  id: targetFolderId,               // upload destination
  isMultipleUpload: true,
  isFolderUpload: false,
  acceptExtensions: ".pdf,.docx",
  maxPerUploadSize: "26214400",     // strings
  maxTotalUploadSize: "104857600",
  linkMainText: "Drop files here",
  secondaryText: "or click to browse",
  extensionsText: "PDF and DOCX only",
  events: {
    onUploadSuccess: (files) => files.map((f) => f.response?.title),   // an array per batch
    onUploadError: ({ error, rejectedFiles }) => {},
    onUploadProgress: ({ fileName, percent }) => {},
  },
});
```

Key points:

- **Uploads happen only through this UI.** The programmatic `instance.upload(file)`
  method works in Forms and Personal and rejects with `SDKError(MODE_MISMATCH)` here — do not
  generate code that calls `upload()` on an Uploader frame.
- `id` is the destination folder id; get one from a file-selector
  (`selectorType: "userFolderOnly"`), `getFolderInfo()` of a manager frame, or your own
  mapping.
- Size limits are strings; texts are plain strings shown in the drop zone.
- The payloads are this mode's own: `onUploadSuccess` gets an **array** of API envelopes
  (`files[0].response.title`, `.id`, `.folderId`, `.file`), `onUploadError` `{ error, rejectedFiles? }`,
  `onUploadProgress` `{ sessionId, fileName, uploadedChunks, totalChunks, percent }` per chunk. Forms and
  Personal send `{ fileName, fileSize }` per `upload()` call instead — [events](../events.md#uploads-uploader-forms-and-personal-modes).

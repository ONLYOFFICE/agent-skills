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
    onUploadSuccess: ({ fileName, fileSize, uploadId }) => {},
    onUploadError: ({ fileName, message, uploadId }) => {},
    onUploadProgress: (p) => {},
  },
});
```

Key points:

- **Uploads happen only through this UI.** The programmatic `instance.upload(file)`
  method works **only in Forms mode** and throws `SDKError(MODE_MISMATCH)` here — do not
  generate code that calls `upload()` on an Uploader frame.
- `id` is the destination folder id; get one from a file-selector
  (`selectorType: "userFolderOnly"`), `getFolderInfo()` of a manager frame, or your own
  mapping.
- Size limits are strings; texts are plain strings shown in the drop zone.
- `onUploadProgress` fires only in this mode; `onUploadSuccess`/`onUploadError` also fire
  in Forms mode.

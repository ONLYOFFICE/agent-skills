# Uploader mode

A drop-zone UI that uploads files into the folder given by `id` (required). The init call, `acceptExtensions`,
`isMultipleUpload` and the progress use case are on the guide page `embedding-modes/uploader-mode.md`; the fields
(`isFolderUpload`, `maxPerUploadSize`, `maxTotalUploadSize`, `linkMainText`, `secondaryText`, `extensionsText`, …)
with their defaults are in `type-aliases/TFrameConfig.md`. What the page does not say, or says wrong:

- **Uploads happen only through this UI.** The programmatic `instance.upload(file)` works in Forms and Personal and
  rejects with `SDKError(MODE_MISMATCH)` here — never generate code that calls `upload()` on an Uploader frame.
- `id` is the destination folder id: from a file-selector (`selectorType: "userFolderOnly"`), from `getFolderInfo()` of
  a Manager frame, or from your own mapping.
- The payloads are this mode's own, and the guide's `file.title` is not one of them (client 4.0.0):

  ```js
  events: {
    onUploadSuccess: (files) => files.map((f) => f.response?.title),   // an ARRAY per batch (TUploaderUploadResult[])
    onUploadError: ({ error, rejectedFiles }) => {},                     // rejectedFiles when validation refused files
    onUploadProgress: ({ fileName, percent }) => {},                     // after every chunk of every file
  }
  ```

  Forms and Personal send `{ fileName, fileSize }` per `upload()` call instead — the two shapes side by side are in
  [events](../events.md#uploads-uploader-forms-and-personal-modes).
- The size limits are strings (`"26214400"`), as the types say; the texts are plain strings shown in the drop zone.
- The page handles `setConfig` only ([methods](../methods.md#method-support-by-embedded-page-client-400)).

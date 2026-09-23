# Create-file dialog

| | |
|---|---|
| Types | `ICreateDialog` |
| Class side | `Actions.showCreateDialogModal` / `updateCreateDialogModal` with `createDialogProps` |
| From a component | `showCreateDialog(props)` |

`showCreateDialog({ title, startValue, visible: true, isCreateDialog: true, extension: ".myext", onSave, onCancel, onClose })` is the portal's own "create file" dialog — focus, validation and buttons for free; the right thing for a [`File`](../items/file-item.md)-scope "new file" flow. `onSave(e, value)` returns an `IMessage`; if it throws, `onError` is awaited ([and without one](../plugins/plugin.md#two-kinds-of-callback)). **`extension` is not appended for you** — it only drives the "don't ask again" checkbox; append it yourself, and create the file with `enableExternalExt: true` ([rest-api.md](../rest-api.md#creating-a-file-whose-extension-the-portal-does-not-own)). `options`/`selectedOption`/`onSelect` add a combobox under the field.

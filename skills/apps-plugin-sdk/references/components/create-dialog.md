# Create-file dialog

| | |
|---|---|
| Types | [`ICreateDialog`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/components/ICreateDialog.md) |
| Class side | `Actions.showCreateDialogModal` / `updateCreateDialogModal` with `createDialogProps` |
| From a component | `showCreateDialog(props)` |

`showCreateDialog({ title, startValue, visible: true, isCreateDialog: true, onSave, onCancel, onClose })` is the portal's own "create file" dialog — focus, validation and buttons for free; the right thing for a [`File`](../items/file-item.md)-scope "new file" flow. `onSave(e, value)` returns an `IMessage`; if it throws, `onError` is awaited ([and without one](../plugins/plugin.md#two-kinds-of-callback)). **`extension` changes nothing the user sees** — the dialog neither shows nor appends it — so append it to the name yourself, and create the file with `enableExternalExt: true` ([rest-api.md](../rest-api.md#creating-a-file-whose-extension-the-portal-does-not-own)).

- **Clean up in `onClose`**, which runs on every close. `onCancel` is for Cancel, Esc, the cross and a click outside — never after a save; what either of them returns is not dispatched.
- **Not in portal settings.** The dialog is drawn by the portal's main shell, which the settings area does not have: from a page under `/portal-settings` or from the plugin's settings aside, `showCreateDialog` opens nothing.

The dialog's own `onChange`, `onSelect`, `onSave` and `onError` are the only callbacks whose `updateCreateDialogModal` is honoured — from `onChange`, the way to show `errorText` or toggle `isCreateDisabled` while the user types. Sent from anywhere else, a menu click included, it is ignored without a word.

**A resolved `onSave` closes the dialog** (`isCloseAfterCreate` defaults to `true`), and an `errorText` returned there closes with it. To refuse a name, throw from `onSave` and answer from `onError`, which leaves the dialog open; the type wants the whole dialog in `createDialogProps`, hence the spread:

```ts
onSave: async (e, value) => {
  if (!value.trim()) throw new Error(t("nameRequired"));
  await createFile(value);
},
onError: (error) => ({
  actions: [Actions.updateCreateDialogModal],
  createDialogProps: { ...dialog, errorText: error.message },
}),
```

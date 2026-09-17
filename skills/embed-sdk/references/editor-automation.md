# Editor automation: executeInEditor and the connector

Contents: What executeInEditor actually does · Creating the connector · `callCommand` vs
`executeMethod` · Passing data with `Asc.scope` · Forms via the Document Builder API ·
Host ↔ editor messaging · Editor config for automation · Verification checklist

Programmatic work inside an embedded editor (filling forms, reading form values, inserting
signatures) goes through `instance.executeInEditor(callback, data?)`. Everything below is
verified against the portal handler (`packages/doceditor/src/hooks/useSDK.tsx`) and the
editor sources (`sdkjs/word/api_plugins.js`, `sdkjs/word/apiBuilder.js`). Do not invent
method names: the connector **does not fail on an unknown `executeMethod` name** — the
callback queue keeps moving and the call looks successful while nothing happens.

## What executeInEditor actually does

The portal handler runs your serialized callback as:

```js
const c = <your callback source>;
c(instance, asc, data);          // three arguments
```

| Argument | What it is |
|---|---|
| `instance` | `window.DocEditor.instances[EDITOR_ID]` — the **DocsAPI editor object**. It has `createConnector()`, `insertText()`, `destroyEditor()`, … It is **not** a connector. |
| `asc` | `window.Asc` of the editor frame (`Asc.scope` lives here). |
| `data` | the second argument you passed to `executeInEditor` (JSON-serialized). |

> SDK 2.2.0 types the callback as `(editor: any, asc: any, data?: any) => void`. SDKs <= 2.1
> declared `(instance, data?) => void`, which was wrong — the real call has `asc` in the middle
> and `data` **third**. Writing `(editor, data) => …` against those types gives you
> `window.Asc` as `data`; ignore the second parameter with `_asc`.

The callback is serialized with `Function.prototype.toString` and re-created with
`new Function` inside the doceditor frame, so:

1. It cannot reference outer-scope variables, closures or imports. Pass everything through
   `data` (second argument of `executeInEditor`) — that is the supported channel.
2. Because the portal itself uses `new Function` in that frame, `unsafe-eval` is already
   allowed there; a CSP block of your own `new Function` is not a realistic failure mode.
   You still do not need it — see the `Asc.scope` channel below.
3. `executeInEditor` is only meaningful in `editor`/`viewer` mode and only once the
   editor is loaded — call it from `onEditorOpen`/`onAppReady`, not immediately after
   `initEditor`.

## Creating the connector

```js
instance.executeInEditor(function (editor, asc, data) {
  const connector = editor.createConnector();          // you create it — nobody does it for you
  connector.attachEvent?.("onDocumentReady", () => {}); // optional
  window.parent.postMessage(data.prefix + ":connectorReady", "*");
  window[data.prefix + "_connector"] = connector;       // keep it for later messages
}, { prefix: "sign" });
```

`createConnector()` requires the editor to be started with the connector feature available
(ONLYOFFICE Apps editors have it; a plain Community Server without the connector license does not —
`createConnector` is then `undefined`, check for it).

The connector exposes two calls:

| Call | What it is for |
|---|---|
| `connector.callCommand(fn, cb?, isRecalc?)` | run **Document Builder API** code (`Api.GetDocument()…`) inside the document; the return value of `fn` arrives in `cb`. **This is the forms API.** |
| `connector.executeMethod(name, args, cb?)` | run a **plugin method** from `api_plugins.js`. For text documents the list is: `GetAllContentControls`, `GetCurrentContentControl(Pr)`, `AddContentControl*`, `RemoveContentControl(s)`, `SelectContentControl`, `MoveCursorToContentControl`, `InsertAndReplaceContentControls`, `GetAllComments`/`AddComment`/…, `SearchAndReplace`, `GetFileHTML`, `Undo`/`Redo`, `IsFillingFormMode`, `IsFillingOFormMode`, `IsEditingOFormMode`, `SetEditingRestrictions`, OLE/addin-field helpers. **There is no `SetFormValue`, `GetFormValue`, `GetAllForms` or `SetFormsData` plugin method** — form work goes through `callCommand`. For PDF documents there are only six plugin methods (`GetAllComments`, `GetCurrentPage`, `GetPageImage`, `GoToPage`, `PasteHtml`, `ReplacePageContent`), none about forms. |

> **Why this trap exists.** api.onlyoffice.com documents a plugin-side "Form API → Api" with
> `GetAllForms`, `GetFormsByTag`, `GetFormValue`, `SetFormValue` and ships a
> "filling-out-the-form" sample calling `connector.executeMethod("SetFormValue", …)`. None
> of these has ever been implemented: no `pluginMethod_SetFormValue` exists in any sdkjs
> release from v6.4 to v9.4, in `web-apps`, or in the PDF editor. Because the dispatcher is
> `api["pluginMethod_" + name]` and falls through to `undefined` when the property is
> missing, the sample "works" — callbacks fire, a counter increments, the document stays
> empty. The same names **do** exist in the Office (Document Builder) API as
> `ApiDocument.GetAllForms()` / `GetFormsByTag()` / `GetFormsByKey()` /
> `GetFormValueByKey()` / `SetFormsData()` — i.e. inside `callCommand`. When a doc page and
> `api_plugins.js` disagree, `api_plugins.js` wins.

### Passing data into callCommand: `Asc.scope`

`callCommand` serializes `window.Asc.scope` along with the function source:
`"var Asc = {}; Asc.scope = " + JSON.stringify(window.Asc.scope) + "; (" + fn.toString() + ")();"`.
So the data channel is:

```js
asc.scope = { values: data.values };                  // in the executeInEditor callback, asc === window.Asc
connector.callCommand(function () {
  const doc = Api.GetDocument();
  for (const form of doc.GetAllForms()) {
    const v = Asc.scope.values[form.GetFormKey()];
    if (v === undefined) continue;
    switch (form.GetFormType()) {
      case "checkBoxForm": form.SetChecked(!!v); break;
      case "pictureForm":  form.SetImage(v.base64, v.wEmu, v.hEmu); break;
      case "comboBoxForm":
      case "dropDownForm": form.SelectListValue(String(v)); break;
      case "dateForm":     form.SetDate(new Date(v)); break;
      default:             form.SetText(String(v));          // textForm, complexForm
    }
  }
  return doc.GetAllForms().length;
}, function (count) { /* filled */ });
```

Rules for the `callCommand` function:

- **Only a function reference.** A string silently returns `undefined`.
- **No closures.** Only `Api`, `Asc.scope` and what you compute inside. Set `Asc.scope`
  right before each `callCommand`; it is a plain object — set `asc.scope` from the
  `executeInEditor` callback, or `window.Asc.scope` from any code running in the frame,
  including `message` handlers (it is the same object). You never need `new Function`.
- JSON only: no `Date`, functions or class instances in `Asc.scope`.
- Keep the callback body free of TypeScript syntax and of names your bundler may rename
  (minifiers can mangle inlined identifiers — keep it as a plain `function`).

## Forms via the Document Builder API (the real surface)

| Call (inside `callCommand`) | Purpose |
|---|---|
| `Api.GetDocument().GetAllForms()` | all form fields; `GetFormsByKey(key)`, `GetFormsByTag(tag)`, `GetFormsByRole(role)` filter; `GetFormValueByKey(key)` reads one value |
| `form.GetFormKey()` / `GetFormType()` / `IsRequired()` / `GetText()` | identity and current value |
| `form.SetText(s)` (text, combo), `SetChecked(b)`, `SelectListValue(s)`, `SetDate(date)`/`SetTime(...)`, `SetImage(base64, wEmu, hEmu)`, `Clear()` | set values by type |
| `Api.GetDocument().GetFormsData()` / `SetFormsData([{ key, value }])` | bulk read/write keyed by form key |
| `Api.GetDocument().ClearAllFields()` | reset |

`GetFormType()` values: `textForm`, `comboBoxForm`, `dropDownForm`, `checkBoxForm`,
`radioButtonForm`, `pictureForm`, `dateForm`, `complexForm`. Image sizes for `SetImage` are
in EMU: `px * 914400 / 96`.

Pitfalls actually observed:

- `SetFormsData` is sometimes reported not to apply from a connector. Prefer the per-form
  loop above (`GetAllForms` + `SetText`/`SetChecked`), and **verify** by reading
  `GetFormsData()` back in the same `callCommand` and returning it to the host. A "fields
  filled" counter that is not derived from re-reading the document is not evidence.
- If `GetAllForms()` returns an empty array, the file is not an ONLYOFFICE form (a plain
  `.docx` with content controls, or a third-party PDF whose AcroForm fields live in the
  separate PDF builder API — `ApiTextField`, `ApiCheckBoxField`, … in `pdf/src/apiPDF.js`).
  ONLYOFFICE Apps form-room PDFs are ONLYOFFICE forms: the official PDF-editor macro samples
  (`autofill-fields`, `count-form-fields`) use exactly `Api.GetDocument().GetAllForms()`.
  Check the mode with `executeMethod("IsFillingFormMode")` / `IsFillingOFormMode`. `GetAllContentControls` is not a
  substitute — it enumerates content controls (structure), not form fields with keys and
  values, and its `InternalId`s are not accepted by any set-value method.
- `callCommand` runs one command per call and recalculates/repaints by default
  (`isRecalc` third argument). There is no "model updated but not repainted" state to fix
  with an empty `callCommand`; if the document does not change, the write did not happen.
- Sequential `callCommand` calls are queued by the connector; do not fire several in
  parallel from one host event — chain them from the previous callback, and guard UI-driven
  fills with a generation counter (`fillGeneration++`; abort when stale).

## Host ↔ editor messaging pattern

The injected code can `window.parent.postMessage("<prefix>:connectorReady", "*")` and the
host can post commands back into the iframe (`iframe.contentWindow.postMessage`). Inside the
frame, a `message` listener reads the command, sets `window.Asc.scope`, and calls
`callCommand` on the connector saved at creation time. Namespace the prefix per feature to
run several automations on one page. Allow a short settle delay (~300 ms) after
`connectorReady` before the first fill; add your own timeout guard around collect
operations — the connector has none.

## Editor config that pairs well with automation

```js
const instance = sdk.initEditor({
  frameId, src, id: fileId,
  editorType: "embedded",
  editorCustomization: { anonymous: { request: false }, integrationMode: "embed" },
  events: {
    onEditorOpen: () => instance.executeInEditor(setupConnector, { prefix: "sign" }),
    onAppError,
  },
});
```

## Verification checklist before shipping

- After a fill, read `GetFormsData()` back and compare with what you sent.
- Log the connector's `executeMethod` names you use and check each one exists in
  `sdkjs/<word|pdf|cell>/api_plugins.js` (`pluginMethod_<Name>`). Unknown names do not
  error.
- Open the file in the portal UI afterwards: the values must be there and survive save.

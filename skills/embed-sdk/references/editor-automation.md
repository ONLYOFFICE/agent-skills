# Editor automation: executeInEditor and the connector

Programmatic work inside an embedded editor (filling forms, reading form values, inserting
signatures) goes through `instance.executeInEditor(callback)` which creates an editor
**connector** (`docEditor.createConnector()`) inside the iframe. The connector exposes
`executeMethod(name, args, cb)` and `callCommand(fn, cb)` (Document Builder API).

These pitfalls come from a working production-grade sample; every one of them fails
silently if ignored.

## Hard constraints

1. **The callback passed to `executeInEditor` is serialized** (`Function.prototype.toString`)
   and transmitted into the iframe. It cannot reference outer-scope variables, closures, or
   imported modules. Inline every value you need (string-template it into the function body).
2. **`callCommand` accepts only a function reference.** Passing a string silently returns
   `undefined` — no error.
3. **`Asc.scope` is NOT available inside `message`-event handlers** within `executeInEditor`.
   To pass data into `callCommand` from a message handler, inline it into the function body
   (e.g. via `new Function(...)`) — but see rule 4.
4. **`new Function()` may be blocked by the editor iframe's CSP** — silently. Provide an
   `Asc.scope` fallback path when you use it outside message handlers.
5. **`SetFormsData` does not work from `callCommand`.** Set fields one by one via
   `executeMethod("SetFormValue", ...)`.
6. **`GetAllForms()` (Document Builder) may return an empty list.** The reliable way to
   enumerate fields is `executeMethod("GetAllContentControls", null, cb)`.

## Sequencing and rendering

7. **`SetFormValue` calls must be chained sequentially.** Parallel calls race and only the
   last value may apply. Chain them (each next call from the previous callback).
8. **`SetFormValue` updates the model but does not repaint.** Finish a fill sequence with
   an empty `callCommand(function () {}, cb)` to force the editor to re-render.
9. If you drive fills from UI events, guard against overlapping runs with a generation
   counter (`fillGeneration++`; abort a chain when its generation is stale).

## Useful methods

| Call | Purpose |
|---|---|
| `executeMethod("GetAllContentControls", null, cb)` | enumerate fields → build a `FormKey → InternalId` map |
| `executeMethod("SetFormValue", [internalId, value], cb)` | set a text/checkbox field |
| `executeMethod("GetFormValue", [internalId], cb)` | read a field value |
| `callCommand(fn, cb)` with `Api.GetDocument().GetAllForms()` → `GetFormType()`, `SetText()`, `SetChecked()`, `SetImage(base64, wEmu, hEmu)` | bulk reset, type detection, image (signature) insertion |

Image sizes for `SetImage` are in EMU: `px * 914400 / 96`.

## Host ↔ editor messaging pattern

The injected connector can `window.parent.postMessage("<prefix>:connectorReady")` and the
host can post commands back into the iframe. Namespace the prefix per feature to run
several automations on one page. Allow a short settle delay (~300 ms) after
`connectorReady` before the first fill; add your own timeout guard around collect
operations — the connector has none.

## Editor config that pairs well with automation

```js
initEditor({
  frameId, src, id: fileId,
  editorType: "embedded",
  editorCustomization: { anonymous: { request: false }, integrationMode: "embed" },
  events: { onAppReady, onAppError },
});
```

On `onAppReady`, get the instance from `sdk.frames[frameId]` and call
`executeInEditor(setupConnector)`.

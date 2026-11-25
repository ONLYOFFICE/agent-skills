# The plugin runtime

`plugins.js` gives the page `window.Asc.plugin`. Three channels reach the editor: commands (code run inside the editor against the `Api` object model), methods (named editor operations), and events (the editor calling the plugin). The pages are [How to call commands](https://api.onlyoffice.com/docs/plugins/interacting-with-editors/overview/how-to-call-commands.md), [How to call methods](https://api.onlyoffice.com/docs/plugins/interacting-with-editors/overview/how-to-call-methods.md) and [How to attach events](https://api.onlyoffice.com/docs/plugins/interacting-with-editors/overview/how-to-attach-events.md); below is how each one fails.

## Commands: `callCommand` and `Editor.RunMacro`

`callCommand(func, isClose, isCalc, callback)` builds a string - `Asc.scope` as JSON, then `(func.toString())()` - and the editor evaluates it in its own context.

- **No closure.** A variable, a helper function or an import from the plugin's file is not defined inside `func`. `ReferenceError` there surfaces in the editor's console, not the plugin's.
- **`Asc.scope` is copied when `callCommand` is called.** Assign it immediately before the call. Changing it afterwards, or in an `await` between, changes nothing the command sees. Functions and class instances do not survive `JSON.stringify`.
- **Return plain data.** The callback receives what `func` returns after serialization: strings, numbers, arrays, plain objects. Returning `paragraph` or `Api.GetDocument()` yields `undefined`.
- **One in flight.** `callCommand` keeps one callback slot. A second call made before the first callback fires replaces it - the first result is lost or delivered to the second handler. Chain the calls or queue them:

```js
let busy = Promise.resolve();
function runCommand(scope, fn) {
  busy = busy.then(() => new Promise((resolve) => {
    window.Asc.scope = scope;                 // copied right now, by this call
    window.Asc.plugin.callCommand(fn, false, true, resolve);
  }));
  return busy;
}
```

- **The `Api` differs per editor.** `Api.GetDocument()` exists in the document editor, `Api.GetActiveSheet()` in the spreadsheet editor, `Api.GetPresentation()` in presentations. A plugin for several editors branches on `window.Asc.plugin.info.editorType` before calling into `Api`.

On 10.0 and later, `Editor.RunMacro(fn, ...args)` passes `args` to `fn` and returns a Promise of its result - no `Asc.scope`, no callback; an exception inside `fn` rejects the Promise. The rules on closures and plain-data results are the same. **So is the single slot:** `RunMacro` builds a command and sends it through `callCommand`, so two `RunMacro` calls in flight swap or lose results exactly like two `callCommand` calls - `await` each before the next, or put them through the same queue. Use it when `minVersion` is `10.0.0` or later; otherwise `callCommand`.

## Methods: `Editor.<Name>` and `executeMethod`

`executeMethod(name, args, callback)` calls a named editor operation (`GetSelectedText`, `PasteHtml`, `AddContextMenuItem`, ...). `args` is always an array - one array argument is `[[...]]` only when the method's single parameter is itself an array. Calls made while one is pending are queued by the runtime. On 10.0 and later the same methods are `Editor.<Name>(...args)`, returning a Promise.

A name that is not a method of that editor does nothing, and its callback still fires - with `undefined`, exactly like a method that returns nothing. No error says the name was wrong: check it against the types or the editor's method list on the docs site.

Insertion that works in every editor: `PasteText` / `PasteHtml`. The PDF editor blocks `InputText`; `PasteHtml` with the text HTML-escaped keeps the surrounding font (9.0 and later).

## Events

| Registered with | Handler stored as | The editor sends it when |
| :--- | :--- | :--- |
| `attachEditorEvent(name, fn)` | `event_<name>` | always - this call also tells the editor the plugin listens |
| `attachEvent(name, fn)` | `onEvent` dispatch | only if `name` is in the variation's `"events"` |
| `Asc.plugin.event_<name> = fn` | `event_<name>` | only if `name` is in the variation's `"events"` |

Use `attachEditorEvent` for editor events (`onTargetPositionChanged`, `onAddComment`, `onParagraphText`, ...) unless the event is listed in `"events"` anyway. Context-menu and toolbar clicks have their own routing - [menus.md](menus.md).

`Asc.plugin.onEnableMouseEvent` is replaced by the runtime before `init`; assign it inside `init` and call the original from it.

## Windows, panels and buttons

- `Asc.plugin.button(id, windowId)` receives the position of the clicked button from the variation's `buttons` (`0`, `1`, ...), or `-1` for a close:
  - **a panel's close** arrives as `button(-1, windowId)`, and the panel stays open until the plugin closes itself;
  - **a window opened with `new Asc.PluginWindow()`** arrives as `button(-1, windowId)` with that window's `id` - close that window, not the plugin. Keep the windows you open by `id` to tell this from the panel's close;
  - **the plugin's own modal window**: from 9.5.0 its close does not reach `button` - the runtime closes the plugin, so cleanup placed under `-1` never runs there. Earlier versions call `button(-1)`.
- Close the plugin with `executeCommand("close", "")` - after the command whose result you need has called back, not before. Without a `button` handler, every button and close closes the plugin.
- A modal window opened from a plugin (`new Asc.PluginWindow()`) is a separate page with its own `plugins.js`; it talks to the plugin through `sendToPlugin`/`attachEvent` messages, not shared variables.
- `ResizeWindow` with a minimum and a maximum size (its third and fourth arguments) makes a window resizable by the user; the limits are the outer size.

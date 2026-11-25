# Debugging and reviewing a plugin

## Review discipline

A review nobody asked to be a rewrite stays a review.

- Run `node scripts/validate-plugin.mjs <plugin-dir>` first and read its findings as leads, not verdicts: a `warning` is something to confirm in the code.
- Report each finding as **symptom -> cause -> change**, ranked by what a user would hit first. Say what you checked and found sound - a review that only lists faults leaves the reader guessing what was looked at.
- Do not report what is not there. A plugin that loads `plugins.js` from the absolute URL, answers every `onContextMenuShow`, and declares its click events is correct on those points even if it looks unusual.
- For a marketplace submission, add the listing checks of [config.md](config.md#what-the-marketplace-adds) and [Submit to marketplace](https://api.onlyoffice.com/docs/plugins/development-workflow/publishing/submit-to-marketplace.md).

**Debug** is the other shape: the corrected code **and** the rule behind the symptom, stated so it can be reused.

## Fault catalogue, by symptom

| Symptom | Cause | Change |
| :--- | :--- | :--- |
| Works inside the marketplace repository, blank or "Asc is not defined" once installed | The page loads `../v1/plugins.js` | Load `https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js` |
| Installs, the button exists, nothing opens | The variation has neither `"type"` nor `isVisual: true`, so it runs as an invisible plugin | Set the kind's `"type"` and its flags ([config.md](config.md)) |
| An installed background plugin does nothing - no menu item, no toolbar tab, no event | A background plugin the user installed is off until it is turned on under **Plugins > Background plugins**; closing it, its own `executeCommand("close", "")` included, turns it off again. Bundled ones start by themselves (9.0.4+) | Turn it on there and retest before reading the code; it is not a code fault |
| A right panel opens on the left, or a background plugin never starts, on an older editor | `"type"` is read from 8.1.0; older editors fall back to the flags | Set the flags to the closest kind and `minVersion` to `8.1.0` |
| A context-menu item appears, clicking it does nothing | `onContextMenuClick` is not in `"events"`, or `attachEditorEvent("onContextMenuClick", ...)` replaced the runtime's click router | List the event in `"events"`; register per-item handlers only with `attachContextMenuClickEvent` |
| The context menu opens late, or only after a pause | A plugin listening for `onContextMenuShow` did not answer for this menu (an early `return`, an exception, an awaited request) | Call `AddContextMenuItem` on every path, `items: []` when there is nothing |
| `AddContextMenuItem` or `AddToolbarMenuItem` throws in the editor's console, nothing appears | The argument is an array (`[[...]]`) or lacks `guid` | One object: `[{ guid, items }]`, `[{ guid, tabs }]` ([menus.md](menus.md)) |
| A handler attached with `attachEvent` never runs | The event is not in `"events"`; `attachEvent` registers nothing with the editor | Add it to `"events"`, or use `attachEditorEvent` |
| `ReferenceError` (or `undefined`) for a variable inside a command | The command is source text run in the editor; it sees no plugin variable | Pass data through `Asc.scope` set right before the call, or `Editor.RunMacro` arguments |
| The command sees an old value | `Asc.scope` was changed after `callCommand` was called | Assign it immediately before each call |
| The callback receives `undefined` where an object was returned | An `Api` object was returned; only plain data survives | Return the fields you need (`paragraph.GetText()`), not the object |
| Results arrive in the wrong handler or go missing when two actions run quickly | Two `callCommand` calls in flight share one callback slot | Chain or queue commands ([runtime.md](runtime.md)) |
| A method "returns nothing" in one editor and works in another | The name is not a method of that editor; the callback fires with `undefined` | Check the method against that editor's types; branch on `info.editorType` |
| Works on a test server, the call does nothing for the customer | A Developer Edition member (`requires` in the types) on a Community Edition build | Use a member both editions have, or state the edition requirement |
| Cleanup under `button(-1)` never runs when the modal window is closed | From 9.5.0 the runtime closes the plugin for that close without calling `button`; only panels and `Asc.PluginWindow` windows get `-1` | Do the cleanup where the work ends, not in the close handler ([runtime.md](runtime.md#windows-panels-and-buttons)) |
| A panel's close button does nothing | `button` ignores `-1`; for a panel the editor waits for the plugin to close itself | On `-1` call `executeCommand("close", "")` |
| A selection panel does not reset when the selection is cleared | `initOnSelectionChanged` re-runs `init` only when a selection is made | Refresh on demand (`GetSelectedText`) or on another event |
| Text inserted into a PDF does nothing | `InputText` is blocked in the PDF editor | `PasteHtml` with escaped text (9.0+) or `PasteText` |
| The type check passes on code with obvious mistakes | `jsconfig.json` without `module`/`moduleResolution` resolves nothing; `Api` is `any` | Use the setup in [types.md](types.md) and test it with a deliberate mistake |
| Two plugins replace each other in the editor | They share a `guid` (a copied `config.json`) | A new `asc.{UUID}` per plugin |

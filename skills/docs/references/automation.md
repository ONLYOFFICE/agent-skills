# ONLYOFFICE Docs API - Automation API: Connector & Window Integration Guide

## Context & Purpose

The **Automation API** enables external web applications to interact with ONLYOFFICE document editors through custom interface elements. It allows developers to build custom panels, handle review workflows, manage comments, sync form values, and control modal windows entirely from outside the editor container.

## Reference Documentation Map

* **Overview & Lifecycle:** https://api.onlyoffice.com/docs/docs-api/usage-api/automation-api
* **Connector Class Methods:** https://api.onlyoffice.com/docs/docs-api/usage-api/automation-api/connector-class
* **Connector Window Methods:** https://api.onlyoffice.com/docs/docs-api/usage-api/automation-api/connector-window

## Documentation Query Rules

* **Baseline:** Per [`api.md`](./api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for the full plugin event catalog (Document/Spreadsheet/Presentation/PDF/Form event sets) that `attachEvent` can subscribe to beyond `onChangeContentControl`.
* **Method catalog:** `executeMethod`/`callCommand` reach into the same editor instance as [`methods.md`](./methods.md) and the Office JavaScript API — this guide covers the connector/window plumbing around them, not the methods themselves.

## Core Rules & Lifecycle Restrictions

* **Availability:** Premium feature available exclusively for **ONLYOFFICE Docs Developer** licenses.
* **Initialization Constraints:** Never call `createConnector()` before the editor fires its `onDocumentReady` event. If external components are initialized later, cache the editor state inside `onDocumentReady` and check it before building the connector.
* **Reusability Engine:** Reuse the single created connector instance for all consecutive operations. Each `createConnector()` invocation generates an independent connector structure with isolated event listeners — and it implicitly calls `connect()` internally, so don't call `connect()` yourself except to resume a connector you've explicitly `disconnect()`ed.
* **Single Listener Per Event:** `attachEvent(name, callback)` allows only **one** listener per event name — a second `attachEvent` call for the same name replaces the first rather than stacking. Use `detachEvent(name)` to remove one before reattaching, and `updateContextMenuItem(items)` to modify menu entries already added via `addContextMenuItem` instead of re-adding them.
* **Concurrent Connectors:** Multiple independent connectors can run at once (e.g. one per modular UI panel), each with its own isolated event subscriptions — this is a valid pattern, not a leak.
* **Cleanup Discipline:** Always invoke `connector.disconnect()` when a module is unmounted or right before destroying the editor instance via `destroyEditor` to prevent memory leaks and clear interface extensions.
* **Reinitialization Strategy:** Reinitializing the editor via `new DocsAPI.DocEditor()` completely invalidates existing instances; a brand-new connector must be generated within the new instance's `onDocumentReady` hook. Note that running `refreshFile` preserves the connector context.

## Target Implementations

### 1. Document Connector Operations
```javascript
let connector;

const config = {
  // ... core configurations (document, editorConfig)
  events: {
    onDocumentReady: () => {
      // 1. Initialize connector instance safely inside ready callback
      connector = docEditor.createConnector();
      
      // 2. Attach specialized external callbacks
      connector.attachEvent("onChangeContentControl", (obj) => {
        console.log("Content Control mutated:", obj);
      });
    }
  }
};

const docEditor = new DocsAPI.DocEditor("placeholder", config);

// --- Interacting via the instance later ---
// Fetching internal structure states safely
connector.executeMethod("GetAllComments", null, (comments) => {
  console.log("Active Document Comments:", comments);
});

// Mutating Document Context explicitly via Office JavaScript API
connector.callCommand(() => {
  const oDocument = Api.GetDocument();
  const oParagraph = Api.CreateParagraph();
  oParagraph.AddText("Hello from Automation API");
  oDocument.InsertContent([oParagraph]);
  return { status: "ok" };
}, (res) => {
  console.log("Execution feedback status:", res);
});
```

### 2. Context Menu & Toolbar Additions
```javascript
// Append elements to Context Menus dynamically inside the 'onContextMenuShow' lifecycle hook
connector.attachEvent("onContextMenuShow", (options) => {
  connector.addContextMenuItem([
    {
      text: "Convert Component Data",
      onClick: () => {
        console.log("Context Action triggered");
      }
    }
  ]);
});

// Append complex actions into the standard Toolbar layout
connector.addToolbarMenuItem({
  tabs: [
    {
      text: "Extensions",
      items: [
        {
          id: "customToolBtn",
          type: "button",
          text: "Sync Metrics",
          hint: "Force document metrics synchronization",
          lockInViewMode: true,
          icons: "./icon.svg",
          items: [
            {
              id: "subActionBtn",
              text: "Execute Full Sync",
              data: "payload_v1",
              onClick: (data) => {
                console.log(`Executing toolbar action for: ${data}`);
              }
            }
          ]
        }
      ]
    }
  ]
});
```

### 3. Modal & Panel Windows Lifecycle Management
```javascript
// Constructing the panel context within the editor container
const modalWindow = connector.createWindow();

// Displaying the window with targeting parameters
modalWindow.show({
  url: "./window/panel.html",
  description: "Advanced Operations Panel",
  type: "panel",
  EditorsSupport: ["word", "cell", "slide", "pdf"],
  isVisual: true
});

// Communicating host-to-frame (Only executable while actively visible via .show())
modalWindow.dispatchEvent("messageName", { payloadKey: "payloadValue" });

// Listening to child frame events inside host application context
modalWindow.attachEvent("onWindowMessage", (message) => {
  console.log("Data packet received from the internal frame window:", message);
});

// --- Inside the Iframe Window Logic (panel.html script) ---
// Subscribing to data vectors inbound from the application environment
window.Asc.plugin.attachEvent("messageName", (message) => {
  console.log("Frame successfully received external message context:", message);
});

// Dispatching responses back upward out of the frame sandbox environment
window.Asc.plugin.sendToPlugin("onWindowMessage", { type: "onWindowReady" });
```

## Connector Method Reference

| Method | Purpose |
| :--- | :--- |
| `attachEvent(name, callback)` | Register a listener (one per event `name`; see Single Listener Per Event above). |
| `detachEvent(name)` | Remove the listener registered for `name`. |
| `executeMethod(name, args, callback?)` | Call a plugin-API editor method (e.g. `GetAllComments`) and receive its result asynchronously. |
| `callCommand(commandFn, callback?, isNoCalc?)` | Run Office JavaScript API code inside the document's execution context; `isNoCalc` skips spreadsheet recalculation for perf-sensitive batches. |
| `addContextMenuItem(items)` / `updateContextMenuItem(items)` | Add new right-click menu entries, or update ones already added. |
| `addToolbarMenuItem(items)` | Add custom tabs/buttons to the toolbar. |
| `createWindow()` | Construct a modal/panel window (see [Modal & Panel Windows Lifecycle Management](#3-modal--panel-windows-lifecycle-management)). |
| `connect()` / `disconnect()` | Resume/suspend event delivery for this connector. `createConnector()` already calls `connect()` for you — only call it again after your own `disconnect()`. |

## Assembly Checklist & Debugging

1. Verify target licenses include **ONLYOFFICE Docs Developer** pricing tiers before relying on the `createConnector` namespace.
2. Ensure command tracking metrics are enabled locally for development tracing via the terminal: `localStorage.setItem("asc_plugin_commands_log", "true");`.
3. Wrap explicit inner logic within `callCommand` parameters inside discrete try/catch operations to safely propagate internal Javascript sandboxed execution exceptions upward to caller callbacks.
4. Always execute `connector.disconnect()` explicitly inside framework unmounting lifecycles.

## Companion Guides

* **Bootstrap & `onDocumentReady`** -> [`api.md`](./api.md)
* **`executeMethod`/`callCommand` targets** -> [`methods.md`](./methods.md)
* **`events`** section (for `onContextMenuShow`, etc.) -> [`configuration/events.md`](./configuration/events.md)
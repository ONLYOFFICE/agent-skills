# PostMessage

To embed a third-party page and talk to it.

| | |
|---|---|
| Types | [`IPostMessagePlugin`](https://api.onlyoffice.com/docspace/plugins-sdk/usage-sdk/coding-plugin/interfaces/plugins/IPostMessagePlugin.md) |
| The portal calls | `setPostMessageCallback` right after `onLoadCallback`, and only if the status is `active` then — [plugin.md](plugin.md#iplugin--always-required) |
| Items | none |

For plugins whose UI is a third-party page in an iframe. The docs page states the direction, which is easy to get backwards — the **portal** hands you `postMessageCallback`, you invoke it to ask the portal for something — and that your own `window.addEventListener("message", …)` is the listening half: put it in a component effect so it cleans up, check `event.origin`, list the origin in `cspDomains`. Sending the other way is plain DOM: `(document.getElementById(id) as HTMLIFrameElement).contentWindow?.postMessage(...)`. The callback's message is typed as `IPostMessageCallbackMessage`, whose `actions` leave out `updateProps`, `updateContext`, `updateStatus`, `saveSettings`, `sendPostMessage`, `closeSelector` and every `update…` but the item refreshes of ContextMenu, InfoPanel, MainButton, ProfileMenu, File and EventListener. That limit is the compiler's only: the portal runs the message through the same dispatcher as a menu click ([actions.md](../react/actions.md#which-actions-work-from-which-callback)).

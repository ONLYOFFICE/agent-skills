# PostMessage

To embed a third-party page and talk to it.

| | |
|---|---|
| Types | `IPostMessagePlugin` |
| The loader calls | `setPostMessageCallback` |
| Items | none |

For plugins whose UI is a third-party page in an iframe. The direction is easy to get backwards — the **portal** hands you `postMessageCallback` via `setPostMessageCallback`; you invoke it to ask the portal to do something. Listening to your iframe is your own `window.addEventListener("message", …)` (a module plugin runs in the portal's window), inside a component effect so it cleans up; check `event.origin`; the origin goes in `cspDomains`. Sending the other way is plain DOM: `(document.getElementById(id) as HTMLIFrameElement).contentWindow?.postMessage(...)`. The callback's message accepts a restricted action set — no `updateProps`, `updateContext`, `updateStatus`, `sendPostMessage`, `saveSettings`, or any `update*` of selector/dialog/media viewer.

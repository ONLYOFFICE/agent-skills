---
type: llm
weight: 2
---

PASS if the answer says that onNotFound fires for an invalid or revoked link (and onNoAccess for an expired one), that onAppReady arrives when the page mounts, and that the public-room page itself sends no file-click events - to react to clicks the integration must use manager mode over the shared room (rootPath "/rooms/share" with the same requestToken) where onFileManagerClick / onEditorOpen are available, or open files in a viewer frame with the same requestToken.
FAIL if it claims onFileManagerClick or onEditorOpen fire from the public-room page, invents an event such as onLinkRevoked or onAccessDenied, or says a missing requestToken produces an event (it produces the page's invalid-link error with no event).

---
type: llm
weight: 2
---

PASS if the answer says that onNotFound fires for an invalid or revoked link (and onNoAccess for an expired one), that onAppReady arrives when the page mounts, and that the public-room page itself sends no file-click events - to react to clicks the integration must use manager mode over the shared room (rootPath "/rooms/share" with the same requestToken) where onFileManagerClick / onEditorOpen are available, or open files in a viewer frame with the same requestToken. The page also sends onFilterSearch (the list's search text changed) and the SDK itself fires onContentReady and onAppError, so an answer that lists those as well is correct, not inventing; they are neither required nor penalised.
FAIL if it claims onFileManagerClick or onEditorOpen fire from the public-room page, invents an event the SDK does not have (such as onLinkRevoked, onAccessDenied or onFileClick), or says a missing requestToken produces an event (it produces the page's invalid-link error with no event).

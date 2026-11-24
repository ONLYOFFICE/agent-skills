---
type: llm
weight: 2
---

PASS if the answer (1) says the editor sends the click to a plugin only when the plugin is registered for onContextMenuClick, and that the fix is to list "onContextMenuClick" in the variation's "events" array in config.json; (2) says attachContextMenuClickEvent only stores the per-item handler, which the runtime's own onContextMenuClick handler (event_onContextMenuClick in plugins.js) looks up by id; (3) says the colleague's attachEditorEvent("onContextMenuClick", ...) replaces that router, so it must be removed - keeping it would stop every per-item handler even after the event is declared.
FAIL if it recommends keeping or adding attachEditorEvent("onContextMenuClick", ...), blames an editor bug, or builds a plugin instead of answering.

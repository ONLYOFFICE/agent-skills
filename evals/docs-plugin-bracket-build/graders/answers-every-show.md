---
type: llm
focus: { source: file, path: scripts/code.js }
weight: 2
---

PASS if the handler for onContextMenuShow calls AddContextMenuItem on every path - with an empty items array when the menu was not opened on a selection - and adds the bracket entry only when options.type is "Selection" (an equivalent check of the selection is acceptable).
FAIL if the handler returns without calling AddContextMenuItem when there is no selection, adds the entry on every menu, or there is no onContextMenuShow handler.

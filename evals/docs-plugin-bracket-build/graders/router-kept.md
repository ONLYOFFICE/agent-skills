---
type: regex
pattern: 'attachEditorEvent\(\s*[\x27"`]onContextMenuClick'
match: not_contains
target: { source: file, path: scripts/code.js }
weight: 2
---

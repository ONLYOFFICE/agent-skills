---
type: regex
pattern: 'AddContextMenuItem[\x27"`]\s*,\s*\[\s*\['
match: not_contains
target: { source: file, path: scripts/code.js }
weight: 1
---

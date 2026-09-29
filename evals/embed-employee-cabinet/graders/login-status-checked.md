---
type: regex
pattern: 'status\s*!==\s*200|url\s*===\s*[\x27"]\/[\x27"]'
target: { source: file, path: src/docspace.ts }
weight: 2
---

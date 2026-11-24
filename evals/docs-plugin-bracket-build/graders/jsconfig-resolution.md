---
type: regex
pattern: '"moduleResolution"\s*:\s*"(bundler|node16|nodenext|Bundler|Node16|NodeNext)"'
target: { source: file, path: jsconfig.json }
weight: 2
---

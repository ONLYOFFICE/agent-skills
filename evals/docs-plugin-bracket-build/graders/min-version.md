---
type: regex
pattern: '"minVersion"\s*:\s*"(8\.[1-9]|9\.|1[0-9]\.)'
target: { source: file, path: config.json }
weight: 1
---

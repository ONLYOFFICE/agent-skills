---
type: regex
pattern: '(?:\bPUT|-X\s*PUT)\s+[\x22\x27\x60]?(?:\{\w+\}|\$\{?\w+\}?|https?:\/\/[^\s\/\x22\x27]+)?\/api\/2\.0\/security\/csp'
flags: i
match: not_contains
weight: 2
---

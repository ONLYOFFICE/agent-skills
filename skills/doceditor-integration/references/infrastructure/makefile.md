---
name: makefile
description: Guidelines when dealing with Makefiles
license: Apache-2.0
metadata:
  author: ONLYOFFICE
---

# Makefile Formatting

## Instructions

When writing or modifying Makefiles, follow these formatting guidelines:

1. Each target should have a `.PHONY` declaration
2. Format should follow this pattern:
   - `.PHONY: target-name` on its own line
   - `target-name:` on the next line
   - Commands indented with a tab
   - Empty line between targets

## Example

```makefile
.PHONY: foo
foo:
	@echo 'foo'

.PHONY: bar
bar:
	@echo 'bar'
```

## When to Use

Apply these guidelines when:
- Creating new Makefile targets
- Modifying existing Makefiles
- Reviewing Makefile code for rules. There must be a base set of recipies: 1. help 2. up (the whole stack with a reachable Document Server, reusing one already running - see [`compose.md`](compose.md)'s "MAKING DOCUMENT SERVER REACHABLE LOCALLY" and `templates/Makefile.template`) 3. run (for development run) 4. build (for production) 5. docker (to build a docker image) 6. lint 7. test
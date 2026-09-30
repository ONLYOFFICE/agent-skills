---
type: llm
weight: 2
---

PASS if the answer (1) says the ContextMenu scope reads usersTypes (plural) and silently ignores the singular usersType, which is why the item shows for everyone, and notes the spelling differs per scope (plural for ContextMenu, InfoPanel, EventListener, ArticleButton, ArticleNavigation; singular for MainButton, ProfileMenu, File); (2) says useCurrentFile() is null in a modal opened from a class-side click because the click message carries no selection, that no other hook returns the clicked entity, and that this is the design rather than a bug; (3) gives the fix: onItemClick stores the id in a module-level variable or passes it through a factory closure, and the dialog body component reads it and fetches in an effect.
FAIL if it calls the null a DocSpace bug, invents a hook or field, or builds or edits a project instead of answering.

---
type: llm
weight: 2
---

PASS if the answer (1) says the ContextMenu scope reads usersTypes (plural) and silently ignores the singular usersType, which is why the item shows for everyone, and says the field name differs by scope (naming the scopes that read the singular - MainButton, ProfileMenu, File - or the ones that read the plural is enough; listing all eight is not required); (2) says useCurrentFile() is null in a modal opened from a class-side click because the click message carries no selection, that no other hook returns the clicked entity, and that this is the design rather than a bug; (3) gives the fix: onItemClick stores the id in a module-level variable or passes it through a factory closure, and the dialog body component reads it and loads the room itself. Saying the values should come from the UserRole enum because UsersType is deprecated and its member names mislead (UsersType.user is a guest, UserRole.user a portal user) is correct SDK 3 advice, not an invention, and neither required nor penalised.
FAIL if it calls the null a DocSpace bug, invents a hook or field (such as a hook returning the clicked item), or builds or edits a project instead of answering.

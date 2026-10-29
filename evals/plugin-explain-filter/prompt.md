---
description: The usersType/usersTypes asymmetry and why useCurrentFile() is null in a click-opened modal.
expected_outcome: ContextMenu reads usersTypes (plural), the singular is skipped silently; the values come from UserRole, since the deprecated UsersType's member names do not match the shown roles; useCurrentFile() is null in a modal opened from a class-side click by design - hand the id over through a module variable or a factory closure.
tags: [apps-plugin-sdk, question]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

quick one about our docspace plugin (sdk 3, portal 4.0). the context menu item on rooms is meant for room admins only so i set usersType: [UsersType.roomAdmin] on it, but everyone sees it, guests included. and when you click it the modal opens fine but useCurrentFile() inside gives null so i can't even load the room. is there a different hook for "the thing i right-clicked", or is this a docspace bug? don't build anything, just tell me what's going on

---
description: Intake page - pick a room through the room selector, remember its id and share token, then drop files into it with the uploader; no page reload.
expected_outcome: One component whose room-selector callback reads the array payload (items[0].id, items[0].requestTokens[0].requestToken), destroys the selector, then initialises an uploader with id = the room; no programmatic upload() on the uploader; every frame destroyed on unmount and on replacement.
tags: [apps-embed-sdk, build]
max_turns: 80
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash, WebFetch]
---

Vue 3 + Vite intake page for our ONLYOFFICE DocSpace portal https://portal.example.com (the portal was upgraded recently; find the version yourself if you can, otherwise say so). The current directory is the empty project root.

The user picks a room through the DocSpace room selector; we store the room id and, if the room has a public share link, its share token. Then the same page shows an uploader that drops files into that room. Everything without a page reload.

Put the whole integration in one single-file component, src/components/RoomIntake.vue, and finish with REPORT.md (portal-side configuration for the admin, SDK connection used, assumptions).

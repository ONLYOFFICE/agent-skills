---
description: Silent hash login through a hidden System frame, a manager scoped to one room sorted A-Z in table view, and an in-app editor modal; the classic connector shape.
expected_outcome: src/docspace.ts probes the session with getUserInfo, logs in with the stored hash and treats status !== 200 as failure; src/pages/Documents.tsx scopes the manager to the room, sorts by "AZ", switches to the table layout with setListView after onAppReady, opens the editor in the app's own modal from onFileManagerClick / onEditorOpen and destroys it on close; REPORT.md names the 2FA limitation and the cross-origin cookie wall.
tags: [apps-embed-sdk, build, heavy]
max_turns: 120
timeout_seconds: 2400
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash, WebFetch]
---

React 18 + TypeScript + Vite app (the current directory is the empty project root) for our ONLYOFFICE DocSpace portal https://portal.example.com - it was upgraded recently, find the version yourself if you can, otherwise say so.

Our backend returns each employee's DocSpace email and a portal-compatible password hash at GET /api/docspace-credentials. Before the Documents page renders, sign the user in to DocSpace silently with those credentials; on failure show a "Reconnect DocSpace" screen instead of the manager. The Documents page shows room 12345 as a table sorted by name A to Z. Clicking a file opens the editor in our own modal, not on the portal.

Keep every call into the SDK in src/docspace.ts and the page in src/pages/Documents.tsx. Finish with REPORT.md: portal-side configuration, SDK connection used, what this login method cannot do, and every assumption.

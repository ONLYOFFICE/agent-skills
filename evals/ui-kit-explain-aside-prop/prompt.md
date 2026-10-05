---
description: Which prop opens Aside, whether ModalDialog and Tooltip share it, and where the answer comes from when nothing is installed.
expected_outcome: Aside and ModalDialog open with `visible`, Tooltip with `isOpen`; a wrong name is ignored silently; the answer cites the docs site page under docspace/ui-kit or the README shipped in the package, and builds nothing.
tags: [ui-kit, question]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, WebFetch]
---

quick one before we start - we're about to put a side panel in our react app with the onlyoffice ui kit, nothing installed here yet. what's the prop that opens Aside, and is it the same one on ModalDialog and Tooltip? and tell me where you got that from, i don't want a guess

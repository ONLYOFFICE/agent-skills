---
description: Manager and System read theme once at load; setConfig({ theme }) needs reload true.
expected_outcome: Explains that the Manager page reads theme from the frame URL at load and ignores a later setConfig without reload; the fix is setConfig({ theme }, true) or re-init; unknown values become Base.
tags: [apps-embed-sdk, question]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

We embed the ONLYOFFICE DocSpace file manager (initManager) in our React app. When the user toggles dark mode I call frame.setConfig({ theme: "Dark" }) on the SDK instance - the promise resolves, but the frame stays light. What am I missing?

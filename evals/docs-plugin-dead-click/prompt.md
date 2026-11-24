---
description: A context-menu item whose click never arrives - the click event is not declared, and registering it with attachEditorEvent breaks the per-item routing.
expected_outcome: The click reaches the plugin only if onContextMenuClick is listed in the variation's "events" in config.json; attachContextMenuClickEvent stores the handler and the runtime's own onContextMenuClick handler routes to it, so registering onContextMenuClick with attachEditorEvent replaces that router and must be removed.
tags: [doceditor-plugins, question]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

onlyoffice docs editor plugin, background one. i add a right click item when text is selected and it shows up in the menu fine, but clicking it does nothing - i have attachContextMenuClickEvent("toTicket", fn) and fn never runs. a colleague said the editor doesn't know we listen so he added Asc.plugin.attachEditorEvent("onContextMenuClick", () => {}) to register it, still nothing. what's going on? just explain, don't build anything

---
description: A Document Server (ONLYOFFICE Docs) editor plugin is neither an Embed SDK nor a DocSpace plugin task; neither skill should fire.
expected_outcome: Claude answers about the ONLYOFFICE Docs plugin framework (config.json, pluginCode, window.Asc.plugin) without invoking apps-embed-sdk or apps-plugin-sdk.
tags: [trigger]
max_turns: 10
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

I want to build an ONLYOFFICE Docs editor plugin (the one that lives inside the document editor toolbar) that inserts our company's signature block at the cursor. Outline the plugin files I need and the API call that inserts the text.

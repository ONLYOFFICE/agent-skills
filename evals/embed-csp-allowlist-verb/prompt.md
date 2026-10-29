---
description: The CSP allow-list is written with POST, not PUT; the read is anonymous.
expected_outcome: GET /api/2.0/security/csp for the current list (no auth), POST to the same path with portal-settings rights to add a domain, and the UI path Developer Tools -> Embed SDK.
tags: [apps-embed-sdk, question]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Our deploy script needs to make sure https://crm.example.com is on our ONLYOFFICE DocSpace portal's list of domains allowed to embed it (the Embed SDK allow-list), and to print the current list first. Which HTTP calls do I make, with what permissions? Keep it short.

---
description: The full plugin build - an ArticleNavigation page with a room list and a people view, a Settings page, an EventListener and an ArticleButton, built and validated to dist/plugin.zip.
expected_outcome: ./ops-workspace holds a module plugin (runtime module, default export) with ArticleNavigation, Settings, EventListener and ArticleButton declared and registered, built with Vite and packed to dist/plugin.zip, validated with validate-plugin.mjs.
tags: [apps-plugin-sdk, build, heavy]
max_turns: 150
timeout_seconds: 3600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

we need our own place inside docspace for the ops team. a screen you get to from the left menu listing every room with how many people are in it - search at the top, a switch to include archived ones, and a way to order them by name or by when they were last touched. there are a few hundred rooms so don't drag all of them in at once, pull more as you go. we tick several rooms and archive them in one go, and since that takes a minute we want to watch it run somewhere that isn't a frozen dialog. clicking a room takes you into it. the same screen needs a second view with the people across those rooms and their role, so nobody has to click into every room to find out who is where. when a search finds nothing, say so properly instead of leaving a blank page. only admins get a screen under portal settings with our webhook url, an environment (production / staging / local), how often to poll in minutes and a switch for notifying on changes - saving must stay impossible while the url isn't https or the minutes aren't between 1 and 60. when someone creates or renames a room the list should notice. a small icon in the sidebar that jumps straight to the list would be nice too. half the team is on dark theme so it has to look right there.

create the project in ./ops-workspace (this directory is empty), build it so dist/plugin.zip exists, and write REPORT.md next to it with what you validated and what is left for us.

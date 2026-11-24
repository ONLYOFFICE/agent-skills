---
description: A small editor plugin built from scratch - a context-menu action on selected text, for servers on 8.3 and 9.1, with type checking set up for whoever maintains it.
expected_outcome: config.json with a background variation ("type" plus the isVisual/isInsideMode/isModal flags, minVersion 8.1.0 or later) whose "events" declare onContextMenuClick; index.html loading plugins.js from https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js; scripts/code.js answering every onContextMenuShow with AddContextMenuItem([{ guid, items }]) - an item only on a selection - and the click through attachContextMenuClickEvent, never attachEditorEvent("onContextMenuClick"); package.json with @onlyoffice/doceditor-plugin-types and jsconfig.json with checkJs, module and moduleResolution.
tags: [doceditor-plugins, build]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash, WebFetch]
---

Build an ONLYOFFICE Docs plugin for the document editor: when you right-click selected text there is an entry that wraps the selection in square brackets, like [this]. Nothing else - no panel, no window. It has to work on our Docs servers, which run 8.3 and 9.1. Also set the folder up so VS Code autocompletes the editor API for whoever maintains it after me.

The current directory is the plugin folder and it is empty. Use these names: config.json, index.html, scripts/code.js for the plugin; package.json and jsconfig.json for the editor setup. Icons are not needed for this task - leave them out of config.json rather than pointing at files that do not exist. Do not run npm install.

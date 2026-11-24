---
description: A variable undefined inside callCommand, and wrong results when commands run back to back.
expected_outcome: The command is sent to the editor as source text, so the plugin's variables do not exist inside it - pass data through Asc.scope, which is copied when callCommand is called (or Editor.RunMacro arguments on 10.0+); callCommand keeps one callback slot, so two commands in flight swap or lose results - chain or queue them.
tags: [doceditor-plugins, question]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

onlyoffice editor plugin question. i have const user = getUserName() at the top of my plugin script and inside callCommand i do paragraph.AddText(user) - i get ReferenceError user is not defined, but i can see it's set! so i moved it to Asc.scope.user = user, which works on the first click, but when people click fast the callback sometimes gets the wrong result, like the result of the other button. is the editor buggy? just explain, don't write me a plugin

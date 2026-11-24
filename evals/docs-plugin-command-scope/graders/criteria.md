---
type: llm
weight: 2
---

PASS if the answer (1) says the callCommand function is sent to the editor as source text and run there, so variables of the plugin script do not exist inside it - by design, not a bug; (2) says Asc.scope is serialized when callCommand is called, so it must be set right before each call; (3) explains the wrong results on fast clicks by callCommand keeping a single callback slot that a second command in flight replaces, and gives the fix: chain the commands or queue them so one runs at a time. Mentioning Editor.RunMacro with arguments on 10.0+ is correct and neither required nor penalised, as long as it is not offered as a way around the shared callback.
FAIL if it calls this an editor bug, explains the fast-click problem without the shared callback (for example only as a race in the document), claims Editor.RunMacro gives each call its own callback or result slot (it is callCommand underneath and shares the same slot), or builds a plugin instead of answering.

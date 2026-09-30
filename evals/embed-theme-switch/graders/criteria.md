---
type: llm
---

PASS if the answer explains that the Manager page reads the theme once, from the frame URL when it loads, so a plain setConfig({ theme }) changes nothing, and gives the fix as setConfig({ theme: "Dark" }, true) (the reload argument re-creates the iframe) or destroying and re-initialising the frame with the new theme; it may add that the values are "Base", "Dark" and "System" and that an unknown value falls back to Base.
FAIL if it blames the SDK version without giving the reload fix, suggests CSS hacks on the iframe as the primary answer, or says theme cannot be changed after initialisation at all.

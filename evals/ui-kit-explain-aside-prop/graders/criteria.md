---
type: llm
weight: 2
---

PASS if the answer (1) names `visible` as the prop that opens Aside and says ModalDialog reads the same one; (2) says Tooltip is different and takes `isOpen`, so the name is per component and a wrong one is ignored with nothing logged; (3) names where it read this — a page of the UI kit documentation under api.onlyoffice.com/docspace/ui-kit, or the component's README inside the installed package — rather than answering from memory; (4) answers instead of scaffolding a project.
FAIL if it offers `isVisible`, `open` or `opened` for Aside, says all three components share one prop, cites no source, or starts building.

---
type: llm
focus: { source: file, path: REPORT.md }
weight: 2
---

PASS if REPORT.md (1) tells the administrator to add the site's origin to the portal's embed allow-list (Developer Tools -> Embed SDK, or the /api/2.0/security/csp API), and (2) states which SDK connection was used (the portal's own script at /static/scripts/sdk/<version>/api.js, or the npm package with a version) and says plainly whether the portal's SDK version could be verified - with an unreachable portal it must say it was not verified.
FAIL if the report is missing, claims the portal version was verified, or omits the allow-list step.

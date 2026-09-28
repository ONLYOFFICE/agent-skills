---
type: llm
focus: { source: file, path: REPORT.md }
weight: 2
---

PASS if REPORT.md (1) says the hash-login path cannot serve accounts with two-factor authentication unless the portal's System page reads the code argument, (2) warns that when the app runs on another origin than the portal the browser withholds the portal cookie (third-party cookie blocking), so the remedy is OAuth getToken or same-site hosting rather than SameSite tweaks, and (3) names the allow-list step for the host origin.
FAIL if the report is missing or presents the hash login as working for every account and every origin without qualification.

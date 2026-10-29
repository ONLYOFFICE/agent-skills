---
description: An existing connector meets two-factor accounts; the answer must know which portal build finishes the second step and how to detect the one that does not.
expected_outcome: Prose plus a snippet - a second login(email, hash, undefined, undefined, code) after a /confirm/ url, status !== 200 as failure, the older-portal fallback, no invented API.
tags: [apps-embed-sdk, question]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Our WordPress plugin logs users into ONLYOFFICE DocSpace with the Embed SDK: a hidden system frame, then getHashSettings -> createHash -> login. Users who have two-factor authentication enabled on the portal cannot log in. Add a field for the 2FA code to the login form, resend the auth request with the code and obtain the session. What exactly do I change? Answer in prose with the code I need; don't scaffold a project.

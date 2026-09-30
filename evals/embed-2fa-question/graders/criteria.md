---
type: llm
weight: 2
---

PASS if the answer (1) says the first login answers with a url under /confirm/ and no session when a second factor is pending, (2) tells the plugin to call login again with the same email and hash plus the one-time code as the fifth argument, (3) treats a result with status other than 200 (or a repeated /confirm/ url) as failure, and (4) states that a portal whose System page predates the code argument (3.x) forwards only email and passwordHash and re-issues the challenge, so the plugin must detect that at runtime and fall back (OAuth getToken, signing in on the portal in another tab, or disabling 2FA for the integration account).
FAIL if the answer presents the code field as working on every portal, invents an SDK method or event that does not exist (such as loginWithCode on the SDK instance, a verifyCode method, or an onTfaRequired event), or tells the plugin to post the plaintext password.

---
type: llm
---

PASS if the answer says the current list is read with GET /api/2.0/security/csp without authentication, that a domain is added with POST to the same path by an account that may edit portal settings (an admin session or an API key with that permission), and mentions the portal UI alternative (Developer Tools -> Embed SDK) or the CSP frame-ancestors consequence.
FAIL if it names PUT or PATCH as the write verb, invents another endpoint, or says the list cannot be changed over the API.

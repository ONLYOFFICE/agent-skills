---
description: Documents for anonymous visitors - a public room listing and a read-only viewer in a modal, share token kept out of the source.
expected_outcome: index.html + app.js + server.js + REPORT.md; the listing is initPublicRoom (id + requestToken) or a manager over /rooms/share; the token comes from the server; the viewer opens by file id with the same token and is destroyed on close; REPORT.md names the allow-list and says the portal version was not verified.
tags: [apps-embed-sdk, build]
max_turns: 80
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash, WebFetch]
---

Build a page for our marketing site where a visitor without any ONLYOFFICE DocSpace account sees the documents of our public room 12345 and can open one read-only in a modal on the same page. Plain HTML + JS, no framework; the current directory is the project root and it is empty.

Constraints and facts:
- Our portal is https://portal.example.com (it was upgraded recently; find out the version yourself if you can, otherwise say you could not).
- The room's share token must not be hardcoded anywhere in the repository: read it from an environment variable on a tiny Node server (server.js) that also serves the static files, and hand it to the page through a small endpoint.
- Put the page in index.html, all browser-side JavaScript in app.js, the server in server.js.
- Finish with REPORT.md in the project root: what the admin must configure on the portal, which SDK version and connection method you used and whether you could verify the portal version, and every assumption you made.

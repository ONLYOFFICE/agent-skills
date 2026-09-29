---
description: Which events the /sdk/public-room page sends, and how a revoked or expired link shows up.
expected_outcome: onAppReady on mount, onNotFound for an invalid or revoked link, onNoAccess for an expired one; no click events from this page (a manager over /rooms/share with requestToken has them); both id and requestToken required.
tags: [embed-sdk, question]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

On our public marketing page we show a ONLYOFFICE DocSpace public room with sdk.initPublicRoom({ frameId, src, id, requestToken }). Which events will the frame actually send me, and which one tells me that the share link was revoked so I can show our own message? Also: can I react when a visitor clicks a file?

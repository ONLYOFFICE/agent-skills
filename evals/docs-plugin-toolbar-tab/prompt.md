---
description: A toolbar tab that never appears because AddToolbarMenuItem got an array of items, as one published example does, and a button click that would not arrive either.
expected_outcome: AddToolbarMenuItem takes one object { guid, tabs } inside the argument array - [{ guid, tabs }] - because sdkjs reads guid and tabs straight off the argument; with [[...]] guid is undefined, the plugin lookup fails and the TypeError about baseUrl follows. Clicks reach attachToolbarMenuClickEvent only when onToolbarMenuClick is listed in the variation's "events" in config.json.
tags: [doceditor-plugins, question]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

onlyoffice docs 9.1, background plugin. i want our own tab on the top toolbar with an "Insert footer" button. i followed the example for adding toolbar items:

```js
let toolbarMenuMainItem = {
  guid: window.Asc.plugin.info.guid,
  tabs: [{ id: "ourTools", text: "Our tools", items: [{ id: "insertFooter", type: "button", text: "Insert footer", hint: "Insert our footer" }] }]
};
window.Asc.plugin.executeMethod("AddToolbarMenuItem", [[toolbarMenuMainItem]]);
window.Asc.plugin.attachToolbarMenuClickEvent("insertFooter", insertFooter);
```

no tab shows up, and the editor's console has `TypeError: Cannot read properties of undefined (reading 'baseUrl')`. what's wrong? and once the tab is there, is there anything else needed for the click to reach insertFooter? just explain, don't build the plugin

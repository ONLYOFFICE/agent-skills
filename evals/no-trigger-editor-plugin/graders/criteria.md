---
type: llm
---

PASS if the answer describes an ONLYOFFICE Docs (Document Server) editor plugin - a config.json manifest, an index.html with pluginCode, window.Asc.plugin and a text-insertion call such as executeMethod("PasteText"/"PasteHtml") or callCommand with the Document Builder API - and does not describe a DocSpace portal plugin (scopes, onLoadCallback, @onlyoffice/docspace-plugin-sdk) or the Embed SDK.
FAIL if it answers with DocSpace Plugins SDK or Embed SDK concepts.

# ONLYOFFICE Docs API - conversion Skill Guide

## Context & Purpose

The **Conversion API**: synchronous HTTP POST requests to the Document Server's converter service for file format conversion (e.g. `docx` -> `pdf`, `csv` -> `xlsx`).

## Reference Documentation Map

* **Base Conversion API:** https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api
* **Parent Skill:** Listed as a server-to-server automation companion in [`api.md`](../../api.md).
* **Request Payload Structure:** https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/request
* **Response Payload Structure:** https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/response
* **System Error Codes Reference:** https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/error-codes
* **Format Conversion Matrix:** https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/conversion-tables
a

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../../api.md) — this guide is self-sufficient.
* **Fallback:** Check live docs only for specialized options (CAD sheet selection, chart extraction sub-options).
* **Endpoint:** POST to `https://documentserver/ConvertService.ashx`.

## Sub-Section Delegations

Route by lifecycle stage:

* **Building the request** -> [`request.md`](./request.md)
* **Parsing the response** -> [`response.md`](./response.md)
* **Handling failures** -> [`errors.md`](./errors.md)
* **Format compatibility** -> [`table.md`](./table.md)
* **Request Token Signature (`token`)** -> [`signature/body.md`](../../signature/body.md) (and the [`signature.md`](../../signature/signature.md) family index)
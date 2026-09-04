# ONLYOFFICE Docs API - Conversion Tables Skill Guide

## Context & Purpose

This guide defines which input and output format pairs are valid for pre-flight validation checks before sending a request to the ONLYOFFICE Conversion API. 

## Reference Documentation Map

* **Format Conversion Matrix Project:** https://github.com/ONLYOFFICE/document-formats
* **Format Conversion Matrix:** https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/conversion-tables
* **Parent Skill:** [`conversion.md`](./conversion.md) family index.

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../../api.md) — this guide is self-sufficient. Use document-formats project as a submodule for conversion matrix
* **Fallback:** Check live docs only for format pairs not listed below.

## Common Format Pairs

| Source (`filetype`) | Allowed Targets (`outputtype`) | Notes |
| :--- | :--- | :--- |
| **docx** | `pdf`, `odt`, `rtf`, `txt`, `html`, `epub` | Standard Word document flow. |
| **xlsx** | `pdf`, `csv`, `ods`, `html` | Spreadsheet formats. |
| **pptx** | `pdf`, `odp`, `potx` | Presentation flattening. |
| **csv** | `xlsx`, `xls`, `ods` | Requires `options.delimiter`. |
| **txt** | `docx`, `pdf`, `odt` | Plain text. |
| **html** | `docx`, `pdf` | Sanitizes markup into static formats. |

## Constraints

* **Submodule** mandatory to use document-formats project as a submodule for conversion matrix.
* **Case:** `filetype`/`outputtype` must be lowercase — `"DOCX"` is rejected.
* **Illegal pairs:** cross-category conversions the server disallows (e.g. `xlsx` -> `epub`) return error `-7` — see [`errors.md`](./errors.md).
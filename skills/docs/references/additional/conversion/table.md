# ONLYOFFICE Docs API - Conversion Tables Skill Guide

## Context & Purpose

Defines which input/output format pairs are valid for Conversion API pre-flight checks. **Authority is the [`ONLYOFFICE/document-formats`](https://github.com/ONLYOFFICE/document-formats) repo** (`onlyoffice-docs-formats.json`), vendored the same way [`templates.md`](../../templates.md) vendors `document-templates` - not this file's summary table, and not a hand-authored list in generated code.

## Reference Documentation Map

* **Format Conversion Matrix Repo (source of truth):** https://github.com/ONLYOFFICE/document-formats - file `onlyoffice-docs-formats.json`
* **Format Conversion Matrix Documentation:** https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/conversion-tables
* **Parent Skill:** [`conversion.md`](./conversion.md) family index.
* **Vendoring pattern to mirror:** [`templates.md`](../../templates.md) (git submodule, pinned commit, read from disk).

## Documentation Query Rules

* **Baseline:** Per [`api.md`](../../api.md) — this guide is self-sufficient. Generated integrations **must** add `document-formats` as a **git submodule** (prefer under `vendor/document-formats/`), pin a commit, and load `onlyoffice-docs-formats.json` for pair checks. Do not copy the table below into source.
* **Fallback:** Check live docs / the submodule tip only for pairs not covered by the pinned JSON.

## Common Format Pairs

Orientation only — **do not hardcode into the integration**; read the vendored JSON instead.

| Source (`filetype`) | Allowed Targets (`outputtype`) | Notes |
| :--- | :--- | :--- |
| **docx** | `pdf`, `odt`, `rtf`, `txt`, `html`, `epub` | Standard Word document flow. |
| **xlsx** | `pdf`, `csv`, `ods`, `html` | Spreadsheet formats. |
| **pptx** | `pdf`, `odp`, `potx` | Presentation flattening. |
| **csv** | `xlsx`, `xls`, `ods` | Requires `options.delimiter`. |
| **txt** | `docx`, `pdf`, `odt` | Plain text. |
| **html** | `docx`, `pdf` | Sanitizes markup into static formats. |

## Constraints

* **Submodule required:** `git submodule add` [`ONLYOFFICE/document-formats`](https://github.com/ONLYOFFICE/document-formats) (pinned commit); load `onlyoffice-docs-formats.json` before `POST /convert`. Same preference as templates: submodule over a live fetch; never request-time network to GitHub.
* **Case:** `filetype`/`outputtype` must be lowercase — `"DOCX"` is rejected.
* **Illegal pairs:** cross-category conversions the server disallows (e.g. `xlsx` -> `epub`) return error `-7` — see [`errors.md`](./errors.md).
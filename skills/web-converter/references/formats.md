# ONLYOFFICE Format Matrix

Read this before writing any code that decides whether a pair is convertible. The human-readable view is [Conversion tables](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/conversion-tables.md); the machine-readable source is the file below.

## What the file is

[`ONLYOFFICE/document-formats`](https://github.com/ONLYOFFICE/document-formats)' `onlyoffice-docs-formats.json` is the same file the Document Server reads: an array where a pair is supported when the entry whose `name` is the `filetype` lists the `outputtype` in its `convert` array. The same entry's `actions` say what the editor does with the format (`auto-convert` is why a legacy `.doc` opens as a conversion, not in place).

## Where it comes from

Take it from `master` only - never a release branch or tag, even one that looks like it matches the server version. Use the whole file:

- in a generated integration, as a git submodule tracking `master`;
- in a one-off script with no repo around it, fetched once at preflight from `https://raw.githubusercontent.com/ONLYOFFICE/document-formats/master/onlyoffice-docs-formats.json`,
- or copied verbatim from `master` with the commit it was taken at recorded next to it.

Never hand-type the pairs, trim the file down to the pairs the task mentions, or re-fetch it per request - each of those drifts from what the server accepts, which is how a newly added format silently goes unsupported.

## What an illegal pair looks like

A pair the matrix doesn't list comes back as `-7` (input error), which reads exactly like a corrupt source in a flat "conversion failed". Checking the matrix first turns it into a message that names the pair, before a request is spent on it.
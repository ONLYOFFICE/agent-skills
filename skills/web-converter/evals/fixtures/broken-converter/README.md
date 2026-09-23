# broken-converter fixture

A small conversion worker (as if built by a contractor and handed over) that wraps the
ONLYOFFICE Conversion API to turn uploaded files into PDFs before indexing. Used by
eval scenario `audit-broken-converter`.

`converter.js` is the whole thing — no server, no queue, just the function a caller
(a queue worker, a script, whatever) invokes per file. It has several real, planted
faults; read [`../../README.md`](../../README.md) for which ones and why they were
chosen to be internally consistent ("mostly works" has to actually follow from the
combination of bugs present).

Keep `requestConversion`'s `filetype`/`outputtype` lowercasing correct when editing
this fixture — one assertion pins that a review doesn't flag it as broken anyway.

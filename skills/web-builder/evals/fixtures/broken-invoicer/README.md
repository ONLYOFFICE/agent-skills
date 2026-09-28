# broken-invoicer fixture

A small invoice generator (as if built by a contractor and handed over) that wraps the
ONLYOFFICE Document Builder API to produce a PDF per paid order. Used by eval scenario
`audit-broken-invoicer`.

`invoicer.js` is the whole thing — no server, no queue, just the function a caller
invokes per order — plus the script template it fills, `scripts/invoice.template.js`. It
has several real, planted faults; read [`../../README.md`](../../README.md) for which ones
and why they were chosen to be internally consistent ("mostly works" has to actually
follow from the combination of bugs present).

Keep two things **correct** when editing this fixture — assertions pin that a review
doesn't flag them anyway: every request, the polls included, is signed with all of its
parameters inside the token payload; and each poll sends `{async: true, key}` with the
key the first response returned. The template's `SaveFile` name and the `urls` key the
code reads must also keep matching (`invoice.pdf`), or every invoice would fail and the
"mostly works" premise breaks. For the same reason the template avoids Office API calls whose
meaning changed between Document Server versions (`Api.CreateTable` swapped its
arguments in 9.4.0): it has to generate on whichever server version the reviewer assumes.

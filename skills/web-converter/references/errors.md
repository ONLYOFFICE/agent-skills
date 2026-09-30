# ONLYOFFICE Error Codes and Retries

The official table is [Error codes](https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/error-codes.md). Check `error` before reading `fileUrl` - an error response carries no `fileUrl` at all.

## One branch per code

Map every negative error code to its own branch or message in the generated code - a table in a doc page is documentation, not implementation. The branch has to decide retries too, and the decision has to reach wherever retries actually happen: `-3`, `-5`, `-7`, `-8`, `-9` and `-10` fail identically on an identical request, so retrying them as-is only delays the answer; `-1`, `-4` and `-6` can be transient; `-2` means move the job to `async`. A job queue (BullMQ `attempts`, Celery `autoretry_for`, a generic retry wrapper) retries every thrown error unless the permanent ones are marked unrecoverable - labelling `-8` `retryable: false` in an error object while the queue still retries it three times is the same bug as not labelling it.

| Code | Meaning | Retry? |
| :--- | :--- | :--- |
| `-1` | Unknown error | may be transient - bounded retry |
| `-2` | Conversion timeout | move the job to `async: true` |
| `-3` | Conversion error | no - identical request, identical failure |
| `-4` | Error while downloading the source | may be transient (but check that `url` is reachable from the Document Server) |
| `-5` | Incorrect password | no - send the file's `password` inside the signed payload |
| `-6` | Error while accessing the conversion result database | may be transient |
| `-7` | Input error - also what an illegal pair comes back as | no - check the pair against [formats.md](formats.md) |
| `-8` | Invalid token | no - fix the signing, never retry as-is |
| `-9` | The converter cannot determine the output format (XML of unknown type) | no - specify the output format explicitly |
| `-10` | Size limit exceeded | no |

Look the meaning of each code up on the official page for the server version in use - the retry column is this skill's, the meanings are the page's.
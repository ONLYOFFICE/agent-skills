# Endpoint Contract (language-neutral)

The routing surface for the Build task shape, in one table — implement each row against the linked file's exact schema; this table is the map, not the schema source. Maps one-to-one onto [`structure.md`](structure.md)'s `adapters/input/http/` folders.

*Bare mentions of `api.md`, `configuration/config.md`, `configuration/document.md`, and `callback/handler.md` below are the sibling **`doceditor`** skill's files, not ones in this directory.*

| Method | Path | Purpose | Required in | Required out | Schema / rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Embeds `DocsAPI.DocEditor` with the assembled config | — | HTML page that loads the API script and constructs the editor | `api.md`, `configuration/config.md` |
| `POST` | `/callback` | Editor callback (save, force-save, error, …) | `status`, `url` (present only for `status` 2/6), a signed `token` | exactly `{"error": 0}` for every status this handler acted on | `callback/handler.md` |
| `GET` | `/download` | Streams the stored file to Document Server | a token/query proving the request is Document Server's own fetch | file bytes | `configuration/document.md`'s `document.url` |
| `POST` | `/upload` | Ingests a locally-uploaded file | multipart file, enforced size limit | stored file id/key | [`example.md`](../references/example.md) |
| `POST` | `/convert` | Converts between formats via the Conversion API | `filetype`, `key`, `outputtype`, `url`, all inside the signed body token, `Accept: application/json` | converted file location, or the async poll's in-progress state (`endConvert: false`) | the sibling **`web-converter`** skill |

## Rules that apply across every row

Repeated here (not just in `SKILL.md`'s Definition of Done) because this table is meant to be read on its own while implementing routes:

- All four non-page endpoints are mounted even when this deliverable's own UI never calls one of them — `/convert` is the one that most commonly goes missing, written as an internal step inside `/upload` and never exposed as its own route. See `example.md`'s Endpoints section.
- JWT secret (and any session/proxy secret) is read from the environment and the process fails at startup if it's unset — never a hardcoded fallback in source. See [`infrastructure/compose.md`](../references/infrastructure/compose.md).
- `document.key` rotates on every save; a stale key reused across an updated file corrupts revision history rather than erroring visibly.
- The callback (`/callback`) verifies its token **before** fetching anything from `url` — acknowledging a forged callback tells the sender it worked.
- Every named error/status code (Command Service's `1`/`2`/`3`/`4`/`6`, the callback's `status`, and — via `web-converter` — conversion's `-1`…`-10`) gets its own branch in the generated code, not a single generic "failed" catch-all.

# Project Skeleton (language-neutral)

*Bare mentions of `signature/signature.md`, `configuration/events.md`, and `methods.md` below are the sibling **`doceditor`** skill's files, not ones in this directory.*

Ports & Adapters layout ([`architecture/hexagonal.md`](../references/architecture/hexagonal.md)) instantiated for an ONLYOFFICE integration - one folder per concern, one file per port/use-case/route. **Names below are neutral placeholders, not a naming convention to port literally** - the folder path already carries the role (`ports/output/`, `use-cases/`, `adapters/input/http/…`), so these deliberately drop the `-port`/`-use-case`/`-route` suffixes an interface/class/file might carry in one specific language. Translate each name into the target language's own casing, file/type-naming, and suffix habits - see the table below - and delete branches a narrower request doesn't need (e.g. no `list-documents` port for a single-document embed with no file list).

```text
<root>/
  domain/
    document.*                     # entity: key, title, fileType, owner, revision
    document-policy.*              # key-rotation rule, who may open/edit/convert
  application/
    ports/
      input/
        open-document.*
        handle-callback.*
        convert-document.*
        list-documents.*           # only when a dashboard exists; used by the ui/ module, not by a backend route
      output/
        document-repository.*      # persistence: metadata + revisions
        document-storage.*         # file bytes (local disk / S3 / …)
        document-server-gateway.*  # Command Service + Conversion API calls
        token-signer.*             # JWT sign/verify, all three vectors
        clock.*
    use-cases/
      open-document.*
      handle-callback.*
      convert-document.*
      list-documents.*
  adapters/
    input/
      http/
        page/
          embed.*                   # GET /editor - backend, not demo
        callback/
          callback.*                # POST /callback
        files/
          download.*                # GET /download
          upload.*                  # POST /upload
        convert/
          convert.*                 # POST /convert
    output/
      repository/
        <backend>/                  # e.g. in-memory/, postgres/, mongo/ - one subfolder per implementation
      storage/
        <backend>/                  # e.g. local/, s3/ - one subfolder per implementation
      gateway/
        document-server/
      signer/
        jwt/
  composition/
    container.*                     # wires concrete adapters into use cases
```

The same base name recurring in a sibling folder (`ports/input/open-document.*` and `use-cases/open-document.*`) is deliberate, not a collision - the folder disambiguates role the way many languages' own package/module systems already do (Go's `ports.OpenDocument` vs `usecases.OpenDocument`, for one).

## Naming conventions by language/platform

This tree's own placeholder scheme (kebab-case, suffix-free) is one valid rendering, not the target - file naming, symbol naming, and whether a role gets its own suffix at all vary by ecosystem. This table translates three representative entries (`document-repository` - an output port; `handle-callback` - a port + its use-case; `callback` - the HTTP adapter) into each; use it as the pattern for every other file in the tree. For TypeScript/JavaScript, Rust, Java, Kotlin, and Go specifically, also see [`hexagonal.md`](../references/architecture/hexagonal.md)'s own Multi-Language Mapping for the broader package/module layout each of these sits inside - Python, PHP, and C#/.NET aren't covered there, so for those three this table stands on its own.

| Language/Platform | File naming | Type/symbol naming | Worked example |
| :--- | :--- | :--- | :--- |
| TypeScript/JavaScript | camelCase or kebab-case (project convention) | PascalCase interface/class | `documentRepositoryPort.ts` exporting `interface DocumentRepositoryPort`; TS commonly keeps the `Port`/`UseCase` suffix since interfaces and their implementations otherwise share a bare name |
| Python | snake_case module | PascalCase class, often a `Protocol`/ABC | `document_repository.py` defining `class DocumentRepository(Protocol)` - suffix usually dropped; the module/package path carries the role |
| Rust | snake_case module file | PascalCase trait/struct | `document_repository.rs` defining `trait DocumentRepository` - suffix dropped, same reasoning as Python |
| Go | short, lowercase, no separator; package name carries context | PascalCase exported interface/type | `ports/document.go`, package `ports`, `type DocumentRepository interface` - Go idiom actively avoids a redundant suffix the package path already implies |
| Java | PascalCase file matching the public type (one type per file) | PascalCase interface/class | `DocumentRepositoryPort.java` (interface) / `PostgresDocumentRepository.java` (adapter) - suffix commonly kept since Java interfaces and classes coexist in the same package |
| Kotlin | PascalCase file matching the type, or a shared file for closely related small types | PascalCase interface/class | `DocumentRepositoryPort.kt` - same convention as Java |
| PHP (PSR-4) | PascalCase file matching the class/interface exactly | PascalCase interface/class | `DocumentRepositoryPort.php` |
| C# / .NET | PascalCase file matching the type | PascalCase type, interfaces prefixed `I` | `IDocumentRepository.cs` - the `I` prefix is C#'s own idiom for the interface/implementation split, standing in for a `Port` suffix |

The HTTP-adapter layer follows the same rule, translating `callback.*` into each framework's own route/handler idiom rather than a literal filename:

| Language/Platform | Typical shape |
| :--- | :--- |
| Node (Express) | `routes/callback.ts`, `router.post("/callback", callbackHandler)` |
| Python (FastAPI/Flask) | `routers/callback.py`, `def handle_callback(...)` |
| Go | `handlers/callback.go`, `func CallbackHandler(w http.ResponseWriter, r *http.Request)` |
| Java/Kotlin (Spring) | `CallbackController.java`/`.kt`, `@PostMapping("/callback")` |
| C#/.NET (ASP.NET) | `CallbackController.cs`, `[HttpPost("callback")]` |
| Rust (Axum/Actix) | `callback.rs`, `async fn handle_callback(...)` |
| PHP | `CallbackController.php` or a routed closure, framework-dependent |

## Rules

- Every route folder under `adapters/input/http/` maps one-to-one to a row in [`endpoints.md`](endpoints.md) - a row with no folder here is an endpoint that isn't mounted ([`example-checklist.md`](../references/example-checklist.md) §6.3).
- Output ports are capabilities, not technologies (`document-storage`, never `s3`) - the concrete technology lives one level deeper, only on the adapter side (`adapters/output/storage/s3/`), per `hexagonal.md`'s "Structuring Files Within ports/adapters".
- `token-signer` covers all three JWT vectors (browser config token, HTTP-body token, `Authorization` header) - one port, dispatched by caller, not three separate ports. See `signature/signature.md`.
- When version history/comparison/restore is in scope, add `application/ports/output/document-history.*` (revision number, actor, snapshot location, content hash) and wire it from the `handle-callback` use case (on save/force-save) - see `configuration/events.md` and `methods.md` for the two distinct event pairs this needs client-side.
- A sample UI, when also requested ([`infrastructure/backend.md`](../references/infrastructure/backend.md)'s decision table), is a **separate, removable** sibling module (`ui/` or `web/`) - never inside `domain/`, `application/`, or `adapters/output/` - wired only through the input adapters' use-case calls, never bypassing them. It owns both the dashboard page and its list/create-new/rename/delete routes, registering them itself, so excluding the module removes all of them while `adapters/input/http/` - the embedding page included - still builds and serves.
- **Every adapter under `adapters/output/` - repository, storage, gateway, signer, clock, all of them - is one swappable implementation of its port, not a foundation to build on**, whether or not this particular deliverable ever swaps it out - see [`hexagonal.md`](../references/architecture/hexagonal.md)'s "Swappable Adapters". Concretely: a demo's `adapters/output/repository/in-memory/` becomes `adapters/output/repository/postgres/` (or `mongo/`, `dynamodb/`, …), a stubbed `adapters/output/gateway/notifications/stub/` becomes `.../real/`, and so on for any port - each swap is that one new folder plus a one-line change in `composition/container.*`, never a change to `domain/`, `application/ports/`, `application/use-cases/`, or any other adapter. If getting there would touch any of those, the port leaked something implementation-specific and needs fixing before the swap, not after.

## Composition root

`composition/container.*` is the only place concrete adapters get instantiated and injected into use cases - no adapter reaches into another adapter directly, and no use case constructs its own port implementation. See `hexagonal.md`'s Anti-Patterns for what this rules out.
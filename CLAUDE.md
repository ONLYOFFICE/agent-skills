# Working in this repository

Skills for Claude Code, published as a plugin marketplace. `CONTRIBUTING.md` is the
working agreement and `README.md` explains what each skill is for; read those before
changing anything under `skills/`.

## Commit messages

Do not add `Co-Authored-By` trailers or any other AI-attribution lines to commit
messages or pull request descriptions. Same rule as `docspace-ui-kit-react` and the
DocSpace client.

One line, imperative, no type prefix -- "Warn that FieldContainer's own margin doubles
against a column gap".

## Before committing

Both are required by `CONTRIBUTING.md`, and both are fast:

```bash
claude plugin validate . --strict
node skills/<name>/scripts/test-validator.mjs   # for every skill that has one
```

`plugin-sdk`'s suite has 90 expectations. Run it after touching anything under
`skills/plugin-sdk/scripts/`, `templates/` or `vendor/` -- it is the only thing that
catches a broken generator, and it covers cases a grep does not: the host-provided
externals are written as regexes (`/^@onlyoffice\/apps-ui-kit(\/.*)?$/`) in
`templates/vite.config`, `evals/fixtures/working-plugin/vite.config.ts` and
`scripts/validator-tests/fixtures.mjs`, so searching for a package name by hand misses
all three.

## The DocSpace UI kit

`skills/plugin-sdk` documents `@onlyoffice/apps-ui-kit` for plugin authors, from a
vendored tarball and hand-written prose. That kit lives in `docspace-ui-kit-react` and
carries a `sync-ui-kit-reference` skill which reports exactly what has drifted here --
package specifier, tarball version, dist paths, component names, prop defaults. Run it
from that repository rather than re-deriving the answer.

The package specifier is shared with DocSpace-client's plugin shim, which throws on any
specifier it does not know. All three repositories carry a `feature/ui-kit-separation`
branch and those branches land together; merging one alone breaks every plugin.

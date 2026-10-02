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
claude plugin validate . --strict        # the marketplace manifest, and only that
claude plugin validate skills --strict   # the SKILL.md files; the line above never reads them
node skills/<name>/scripts/test-validator.mjs   # for every skill that has one
```

Both forms are needed because `validate` picks its mode from the path: given a directory that
holds a `.claude-plugin/` it validates the manifest and stops, and only a directory without one
is walked for skills, agents and commands. Pointing it at a single skill fails -- `skills/ui-kit`
is not a plugin and has no manifest of its own.

Run `plugin-sdk`'s suite after touching anything under
`skills/plugin-sdk/scripts/`, `templates/` or `vendor/` -- it is the only thing that
catches a broken generator, and it covers cases a grep does not: the host-provided
externals are written as regexes (`/^@onlyoffice\/apps-ui-kit(\/.*)?$/`) in
`templates/vite.config`, `evals/fixtures/working-plugin/vite.config.ts` and
`scripts/validator-tests/fixtures.mjs`, so searching for a package name by hand misses
all three.

## The DocSpace UI kit

Two skills describe `@onlyoffice/apps-ui-kit`, and each is kept honest by a different tool.

- **`skills/plugin-sdk`** documents it for plugin authors, from a vendored tarball and
  hand-written prose in `references/ui-kit.md`. The kit carries a `sync-ui-kit-reference`
  skill that reports what has drifted in that file and applies the fixes -- package
  specifier, tarball version, dist paths, component names, prop defaults. Run it from
  `docspace-ui-kit-react` rather than re-deriving the answer. It reads `plugin-sdk` and
  nothing else.
- **`skills/ui-kit`** documents it for applications of their own. It carries no copies of the
  kit's pages: an agent reads a component's README inside the installed package or its page on
  the docs site (`https://api.onlyoffice.com/docspace/ui-kit/`). Its manifest
  (`scripts/data/kit-manifest.json`) is derived from the kit's metadata, and `node
  tools/sync-ui-kit.mjs --from <kit> --check --strict` is what says it has drifted;
  `sync-ui-kit-reference` does not look at this skill at all. The hand-written
  `references/*.md` and the rules in `SKILL.md` have no drift check -- verify a claim there
  against the kit's source before changing it.

The package specifier is shared with DocSpace-client's plugin shim, which throws on any
specifier it does not know. All three repositories carry a `feature/ui-kit-separation`
branch and those branches land together; merging one alone breaks every plugin.

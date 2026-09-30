# What is public, and what merely resolves

The kit ships the whole DocSpace front end, not a curated subset. Everything in it resolves
and imports cleanly; only part of it is meant for an application of your own. The kit's own
account is `docs/public-api.md` in its repository — this is the part a consumer acts on.

## Three tiers

| Tier | What it means | What you get |
|---|---|---|
| Public | Documented, supported for use outside the portal | Semver: a breaking change needs a major and a migration note |
| Portal-internal | Ships in the package and resolves, but is not part of the contract | Nothing. It may move or change in any release |
| Private | Implementation detail | Does not resolve at all |

There is no mechanical boundary between the first two. The `exports` map is one wildcard —
`./*` — serving every module subpath, public and portal-internal alike, so nothing stops the
wrong import from working. The distinction is editorial, and this page is where it is written
down.

## The public surface

| Subpath | What is in it |
|---|---|
| `components/<folder>` | The 98 component folders — the bulk of the value |
| `providers/theme`, `providers/translation`, `providers/error-boundary` | The two providers an application must mount, and an optional error boundary |
| `enums`, `constants`, `types` | Shared enums, constants and type definitions |
| `hooks` | Eleven hooks, also in the root barrel |
| `context` | `ThemeContext`, `InterfaceDirectionContext` |
| `utils` | The barrel only — `utils/socket` is not public |
| `errors` | Error page components (401, 403, 404 …) |
| `styles/*` | The raw Sass sources, for extending the design system |
| `locales/*` | The vendored translation tables |
| `assets/*` | The icon set as modules — subpath-only on purpose, since a barrel would defeat tree-shaking |
| `styles.css` | The whole library's CSS in one file. Only for builds that cannot follow the per-module imports |

The root barrel re-exports the component folders, `utils`, `hooks`, `context`, `enums`,
`constants`, `types`, `providers` and `errors`. `assets` is deliberately not in it.

## Portal-internal, and what each one drags in

| Subpath | Why it will not work for you |
|---|---|
| `selectors` | The People, Room, Files, Groups and MCP pickers. They fetch through the DocSpace REST client and a MobX store |
| `billing` | Portal tariff and payment flows, on the same API layer and stores |
| `uploader` | Depends on `selectors/Files` and `providers/api` |
| `ai-agent` | Depends on `@onlyoffice/ai-chat`, which is not publishable |
| `api` | The portal REST client |
| `providers/api` | The portal API provider, and the only importer of `axios` |
| `providers/Providers` | The composed root: it mounts the API provider and fetches portal settings |
| `document-editor` | A wrapper around `@onlyoffice/document-editor-react` — use that package directly |
| `utils/socket` | The portal's socket client |

Eleven **components** are portal-internal as well, for the same reason — they read a portal
store, a device type they are told about, or a translation function the portal supplies:
`Article`, `Section`, `Navigation`, `Filter`, `RoomType`, `PortalLogo`, `ImageEditor`,
`AvatarEditorDialog`, `RoomLogoCoverDialog`, `OperationsProgressButton`, `TwoStateToggle`.
Each one's page says so in its metadata.

**Two of them reach you without a subpath.** The root `index.ts` re-exports `./uploader` and
`./billing`, so `Uploader`, `MainTariff`, `Wallet`, `PaymentMethod`, `BillingRoot`,
`PaymentStoreProvider` and the rest are importable from `@onlyoffice/apps-ui-kit` itself with
nothing to warn you. `scripts/data/kit-manifest.json` lists all seventeen names under
`portalInternalBarrelNames`, and `check-usage.mjs` flags them.

## The symptom when you get it wrong

Importing a portal-internal module rarely fails at the import. It fails later, and quietly:

- a picker that renders its frame and never lists anything, because the fetch went to a
  portal that is not there;
- a MobX store observed by nothing, so the component never re-renders;
- `axios` and the REST client in your bundle, for a screen that makes no requests;
- a component that throws on first paint because a context the portal mounts is missing.

## Rules that follow from the shape

- **Import by subpath**, `@onlyoffice/apps-ui-kit/components/<folder>`. It resolves for every
  component, and it keeps the bundle to what you use.
- **Never import from `dist/`.** The `exports` map is the public surface and a path into the
  build output is not covered by it; it breaks whenever the build layout changes.
- **A non-module stylesheet has no subpath.** The wildcard serves `<subpath>/index.js` only,
  so a plain `.scss` is reachable only through the module that imports it.
- Twenty-two icons reach the root barrel by accident, re-exported by name from
  `components/quick-actions/icons.ts` and `components/nav-menu/icons.ts`. Import icons from
  `assets/` rather than relying on those names.

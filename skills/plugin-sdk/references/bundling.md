# Bundling

The portal provides exactly five specifiers to a module plugin and rewrites the bundle's imports to its own copies:

```
react   react-dom   react/jsx-runtime   @onlyoffice/docspace-plugin-sdk/react   @docspace/ui-kit
```

Everything else **must be bundled** — a bare import of anything else (`lodash-es`, the SDK root, a `@docspace/ui-kit/…` subpath) makes the loader refuse the plugin with a console error naming it. `react/jsx-dev-runtime` is not on the list either: a development build imports it and is refused, so upload only what `vite build` produced. The reverse is quieter and worse: bundling one of the five installs cleanly and breaks at render — a second React or SDK React entry makes every hook throw (every component blank), a second ui-kit renders light and left-to-right. The SDK **root** is deliberately not external: it is enums and types, and the host does not provide it. The generator's `vite.config.ts` encodes the list; copy its `external` exactly if you write your own. What it costs to bundle anything else is in [dependencies.md](dependencies.md).

**Bundled, and into one file.** Vite writes every dynamic `import()` — yours or a library's, and diagram or format libraries lazy-load their own parts — as a separate chunk beside `plugin.js`. The packer zips `plugin.js` alone, and the portal imports it from a blob URL, where `import("./chunk-….js")` has nothing to resolve against: the first surface that needs the chunk renders blank with a `TypeError` in the console, while the preview, which serves `dist/` whole, shows it working. `build.rolldownOptions.output.codeSplitting: false` (`rollupOptions.output.inlineDynamicImports: true` in older configs) folds the chunks back into `plugin.js`; the generator's config sets it, and the validator refuses a `dist/` with JavaScript beside `plugin.js`.

**There is no `process` on the portal.** Library mode leaves `process.env` in the bundle, so a dependency that reads it (MobX, antd, React Query) fails to load with *process is not defined*. The generator's config `define`s it; copy that if you write your own — the validator runs the bundle in Node, where `process` exists, and does not catch this.

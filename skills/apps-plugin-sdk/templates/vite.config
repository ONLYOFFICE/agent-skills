import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const { name } = JSON.parse(readFileSync(`${__dirname}package.json`, "utf8"));

export default defineConfig({
  plugins: [react()],
  // The portal has no `process`: a library that reads process.env (MobX, antd,
  // React Query) would fail to load.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env": "{}",
  },
  css: {
    // plugin.css lands in the portal's own document: every class carries the plugin name.
    modules: {
      generateScopedName: `${name}__[local]__[hash:hex:6]`,
    },
  },
  build: {
    lib: {
      entry: `${__dirname}src/index.ts`,
      formats: ["es"],
      fileName: () => "plugin.js",
    },
    rolldownOptions: {
      // Supplied by the portal at load time: a bundled copy breaks every hook (React)
      // or the theme (ui-kit). Everything else, the SDK root included, is bundled.
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@onlyoffice/docspace-plugin-sdk/react",
        /^@onlyoffice\/apps-ui-kit(\/.*)?$/,
      ],
      output: {
        // One file: the archive carries plugin.js alone, so a chunk is never reachable.
        codeSplitting: false,
        assetFileNames: (assetInfo: { name?: string }) =>
          assetInfo.name?.endsWith(".css") ? "plugin.css" : (assetInfo.name ?? "asset"),
      },
    },
  },
});

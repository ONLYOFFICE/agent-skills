# preview/

The pieces behind [`../preview-plugin.mjs`](../preview-plugin.mjs) — the browser pass. Nothing here is run directly.

| File | What it is |
|---|---|
| [`harness-files.mjs`](harness-files.mjs) | the throwaway page the project is served as: an HTML shell carrying the portal's global typography and the portal-shaped markup the leak probe needs, an entry that discovers surfaces the way the loader does (`onLoadCallback`, then each scope's getter, then the messages a class-side click returns) and mounts each under the kit's `ThemeProvider` at the width its surface gets, and a Vite config that is the mirror image of the plugin's own — the six host-provided specifiers **bundled**, because there is no portal to supply them |
| [`browser-checks.mjs`](browser-checks.mjs) | what is measured in the page, as one function serialised into it. Returns observations only; the wording of every finding lives in `../preview-plugin.mjs`, so the measurement and the sentence a user reads stay separable |

Two things the DocSpace client provides and the kit does not, so the harness supplies them and says where: the stylesheet that *defines* the theme variables (the kit's `ThemeProvider` sets the `.light`/`.dark` classes but the barrel does not pull the sheet those classes carry), and the rule that applies `--font-family` to the document. Without the first, every `var()` in the plugin's CSS silently falls back and a colour finding would be noise.

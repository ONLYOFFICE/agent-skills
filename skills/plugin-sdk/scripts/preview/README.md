# preview/

The pieces behind [`../preview-plugin.mjs`](../preview-plugin.mjs) — the browser pass. Nothing here is run directly.

| File | What it is |
|---|---|
| [`harness-files.mjs`](harness-files.mjs) | the throwaway page the project is served as: an HTML shell carrying the portal's global typography and the portal-shaped markup the leak probe needs, an entry that discovers surfaces the way the loader does (`onLoadCallback`, then each scope's getter, then the messages a class-side click returns) and mounts each under the kit's `ThemeProviderComponent` — not `ThemeProvider`, which ignores the theme object it is handed and stays light — at the width its surface gets — inside the host's own padding where the host pads the surface itself, with a dashed line marking where the plugin's box begins, so an outer padding of the plugin's own is measured and photographed as the doubled gutter it is — and a Vite config that is the mirror image of the plugin's own — the five host-provided specifiers **bundled**, because there is no portal to supply them |
| [`peer-stubs.mjs`](peer-stubs.mjs) | the kit's peers a plugin project does not install (the socket client, the markdown renderer, the AI chat, the editor wrapper): on the portal the client supplies them, so the harness writes a stub module per missing peer, exporting the names the kit imports from it, and the Vite config aliases the peer to that module |
| [`browser-checks.mjs`](browser-checks.mjs) | what is measured in the page, as one function serialised into it. Returns observations only; the wording of every finding lives in `../preview-plugin.mjs`, so the measurement and the sentence a user reads stay separable |

One thing the ONLYOFFICE Apps client provides and the kit does not, so the harness supplies it and says where: the rule that applies `--font-family` to the document. The stylesheet that *defines* the theme variables needs nothing of the harness: the kit's theme-provider module imports it, so the barrel import of `ThemeProviderComponent` carries it — and without it every `var()` in the plugin's CSS would silently fall back and a colour finding would be noise.

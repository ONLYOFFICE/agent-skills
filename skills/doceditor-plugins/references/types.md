# Types in the plugin folder

[`@onlyoffice/doceditor-plugin-types`](https://github.com/ONLYOFFICE/doceditor-plugin-types) types the whole plugin API per editor: `window.Asc.plugin`, every `executeMethod` and `Editor` method with its arguments, the editor events, and the `Api` object model inside a command. In a plain JavaScript plugin it turns an invented member into an error in the editor and in `tsc`, before anyone opens the document. Its README covers TypeScript projects and plugins for several editors; this page is the JavaScript setup and what the check does not see.

## Setup for a JavaScript plugin

In the plugin folder:

```bash
npm install --save-dev @onlyoffice/doceditor-plugin-types typescript
```

`jsconfig.json` next to `config.json`, here for a document-editor plugin (`/cell`, `/slide`, `/pdf` for the others):

```json
{
  "compilerOptions": {
    "checkJs": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "types": ["@onlyoffice/doceditor-plugin-types", "@onlyoffice/doceditor-plugin-types/word"]
  },
  "include": ["scripts/**/*.js"]
}
```

`module` and `moduleResolution` are not optional. A `jsconfig.json` defaults to `"classic"` resolution, which cannot find a scoped package, and to `skipLibCheck`, which hides that failure: `Api` becomes `any`, the editor shows no errors, and the setup looks like it works while it checks nothing. Verify it once with a deliberate mistake (`Api.GetDocument().NoSuchMethod()`) - `npx tsc -p jsconfig.json` must report it.

Keep `node_modules`, `package.json` and `jsconfig.json` out of what you ship or submit: the plugin needs none of them at run time.

## A plugin for several editors

Include one editor entry point per program - two declare `Api` twice and collide on purpose. For a plugin with `EditorsSupport: ["word", "cell"]`, declare the globals over those editors instead, in `types/globals.d.ts` (and add `"types/**/*.d.ts"` to `include`, drop the editor entry from `types`):

```ts
import type { Api as ApiOf, Editor as EditorOf } from "@onlyoffice/doceditor-plugin-types";

declare global {
    var Api: ApiOf<"word" | "cell">;
    var Editor: EditorOf<"word" | "cell">;
}

export {};
```

`Api` is then the union, so a method only one editor has needs that editor stated - which is exactly where the code branches on `Asc.plugin.info.editorType` anyway.

## What the types say that a reader would miss

- **`requires`** marks members absent from Community Edition builds (for example `AnnotateParagraph` and the annotation events). Check it before recommending a member to someone whose edition you do not know; the call fails or the event never fires on the other edition.
- **`since`** is the editor version a member appeared in, where it is recorded. A missing `since` means "not recorded", not "always there".
- **A returned `Api` object is a type error** inside `callCommand`: the types model that only plain data comes back.

## What the check cannot see

- Whether an event the code listens for is declared in `config.json` `"events"` - see [menus.md](menus.md) and [runtime.md](runtime.md).
- Calls in a branch for another editor in a multi-editor plugin, until that editor is in the union.
- `config.json` itself - point it at the schema (`$schema`, [config.md](config.md)) and run `scripts/validate-plugin.mjs`.

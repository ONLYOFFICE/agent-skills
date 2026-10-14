# Document templates

## Context & Purpose

Source of the **actual binary files** behind two things a generated sample commonly needs and cannot safely hand-author: a **blank starter file per format** (what "create new document" hands the editor) and a **pre-populated demo file per format** (what a fresh install seeds so there's something to open on first run). Both come from the [`ONLYOFFICE/document-templates`](https://github.com/ONLYOFFICE/document-templates).

## Reference Documentation Map

* **Repository:** https://github.com/ONLYOFFICE/document-templates
* **New files location pattern:** `https://github.com/ONLYOFFICE/document-templates/raw/refs/heads/master/new/<locale/default>/<file>.<extension>`
* **Sample files location pattern:** `https://github.com/ONLYOFFICE/document-templates/raw/refs/heads/master/sample/sample.<extension>`
* **Reference consumer (vendoring pattern to copy):** [document-server-integration's `docManager.js`](https://github.com/ONLYOFFICE/document-server-integration/blob/main/web/documentserver-example/nodejs/helpers/docManager.js) - its `createDemo(isSample, fileExt, ...)` reads from a locally vendored `public/assets/document-templates/{new,sample}/` tree, not a live fetch; its `getLang()` is the locale-resolution pattern in **Target Implementations** below.

## Documentation Query Rules

* **Baseline:** Per `api.md` - this guide is self-sufficient. `api.md` itself is the sibling **`doceditor`** skill's file, not one in this directory.
* **Fallback:** Check the live repo only if a locale a user needs is missing from the table below (the set grows over releases) or to confirm a specific file's current byte content before a re-vendor.

## Repository Layout

```
document-templates/
├── new/
│   ├── en-US/
│   │   ├── new.docx
│   │   ├── new.pdf
│   │   ├── new.pptx
│   │   └── new.xlsx
│   ├── default/
│   │   └── (same four files — fallback locale)
│   └── <59 more BCP-47 locale folders>
└── sample/
    ├── sample.docx
    ├── sample.pdf
    ├── sample.pptx
    └── sample.xlsx
```

## Core Rules

* **`new/` is per-locale, `sample/` is not.** Every `new/<locale>/` folder carries the same four blank-but-valid starter files, one per format - localized default styles/placeholder text, not just a translated filename. `sample/` is a single flat set with real placeholder content, used once for demo/seed purposes; it has no locale variants.
* **`default/` is the fallback locale, not a specific language.** Resolve to it when the requested locale folder doesn't exist on disk — don't silently fall back to `en-US`, which is itself a specific locale, not the repo's actual default.
* **File identity is `(locale, format)`, not filename alone.** `new.docx` in `fr-FR/` and `new.docx` in `de-DE/` are different bytes sharing an identical filename - key local storage/lookup by the pair, never by filename in isolation.
* **These are real, valid OOXML/PDF binaries** If a target format isn't covered by this repo, that's a scope question to raise, not a "generate one instead" fallback - a synthetic blank file is exactly the kind of hallucinated-surface failure [`api-testing.md`](./api-testing.md) Phase 1 exists to catch.

## Target Implementations Example

### 1. Locale Resolution (mirrors `docManager.js`'s `getLang()`)
```javascript
const SUPPORTED_LOCALES = new Set([
  "ar-SA", "az-Latn-AZ", "be-BY", "bg-BG", "ca-ES", "cs-CZ", "da-DK", "de-DE",
  "el-GR", "en-GB", "en-US", "es-ES", "eu-ES", "fi-FI", "fr-FR", "gl-ES",
  "he-IL", "hr-HR", "hu-HU", "hy-AM", "id-ID", "it-IT", "ja-JP", "ko-KR",
  "lo-LA", "lv-LV", "ms-MY", "nb-NO", "nl-NL", "pl-PL", "pt-BR", "pt-PT",
  "ro-RO", "ru-RU", "si-LK", "sk-SK", "sl-SI", "sq-AL", "sr-Cyrl-RS",
  "sr-Latn-RS", "sv-SE", "tr-TR", "uk-UA", "ur-PK", "vi-VN", "zh-CN", "zh-TW",
]);

function resolveTemplateLocale(requestedLang) {
  return SUPPORTED_LOCALES.has(requestedLang) ? requestedLang : "default";
}
```

### 2. Template Path Resolution
```javascript
const TEMPLATES_ROOT = path.join(__dirname, "assets", "document-templates"); // vendored copy, see Vendoring below

function templatePath(kind, format, locale = "en-US") {
  // kind: "new" | "sample"
  if (kind === "sample") {
    return path.join(TEMPLATES_ROOT, "sample", `sample.${format}`);
  }
  return path.join(TEMPLATES_ROOT, "new", resolveTemplateLocale(locale), `new.${format}`);
}
```

### 3. Create New Handler (wires into `example.md`'s `index.ejs` buttons)
```javascript
app.post("/create-new", (req, res) => {
  const { fileType, lang } = req.body; // fileType: "docx" | "xlsx" | "pptx" | "pdf"
  const src = templatePath("new", fileType, lang);
  const destName = `New Document.${fileType}`;
  fs.copyFileSync(src, path.join(storageDir, destName)); // fails loudly if src is missing — don't swallow
  res.json({ key: generateRevisionKey(), filename: destName });
});
```

### 4. First-Run Demo Seeding
```javascript
function seedSampleFiles(storageDir) {
  for (const format of ["docx", "xlsx", "pptx", "pdf"]) {
    const dest = path.join(storageDir, `sample.${format}`);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(templatePath("sample", format), dest);
    }
  }
}
```

## Vendoring

Two supported approaches - pick one, don't fetch live at request time either way:
* **Git submodule (prefer this one)**, pinned to a tagged commit, checked out under `assets/document-templates/`.
* **Fetch-once setup script**, run from a `make setup`/`make templates` target (see [`infrastructure/makefile.md`](infrastructure/makefile.md)) - walk the repo's `new/`/`sample/` trees via the GitHub API or a `git archive` of the pinned ref, write to local disk, never invoked from a request handler.

## Locale Table

The full locale set at time of writing (60 BCP-47 tags, plus `default`) - confirm against the live repo per **Documentation Query Rules** before treating a missing entry as unsupported, the set grows over releases:

`ar-SA` `az-Latn-AZ` `be-BY` `bg-BG` `ca-ES` `cs-CZ` `da-DK` `de-DE` `default` `el-GR` `en-GB` `en-US` `es-ES` `eu-ES` `fi-FI` `fr-FR` `gl-ES` `he-IL` `hr-HR` `hu-HU` `hy-AM` `id-ID` `it-IT` `ja-JP` `ko-KR` `lo-LA` `lv-LV` `ms-MY` `nb-NO` `nl-NL` `pl-PL` `pt-BR` `pt-PT` `ro-RO` `ru-RU` `si-LK` `sk-SK` `sl-SI` `sq-AL` `sr-Cyrl-RS` `sr-Latn-RS` `sv-SE` `tr-TR` `uk-UA` `ur-PK` `vi-VN` `zh-CN` `zh-TW`

Every locale folder carries the same four files (`new.docx`, `new.pdf`, `new.pptx`, `new.xlsx`) - the table above is which folders exist, not which formats each contains.

## Assembly Checklist & Debugging

1. Confirm the vendored commit/tag is actually pinned (submodule ref or setup-script constant) - an unpinned `master` fetch is the single most common way this integration silently drifts between environments.
2. After vendoring, verify every locale your app claims to support actually resolved to a directory that exists on disk - a partial/interrupted fetch can leave some locale folders missing while the code path assumes they're all there.
3. Byte-diff a freshly re-vendored file against what's already checked into your fixture set before overwriting it - see **Vendoring** above on why a diff here is signal, not noise.
4. Open every vendored file once in a real ONLYOFFICE Docs instance (or round-trip it through the Conversion API) after vendoring, before wiring it into create-new/seed flows - treat a corrupted download the same as any other invalid-binary static check per [`api-testing.md`](./api-testing.md) Phase 1, since otherwise it only surfaces the first time a user actually clicks that format.

## Companion Guides

* **Consumed by "create new" UI and demo seeding** -> [`example.md`](./example.md) - the `index.ejs` create-new-by-format buttons and the sample UI's reference shape
* **Testing this integration** -> [`api-testing.md`](./api-testing.md) - Phase 1 (valid-binary static check), the Coverage Mandate (create-new-by-format is a per-action test target)
* **Vendoring automation** -> [`infrastructure/makefile.md`](infrastructure/makefile.md) - a `setup`/`templates` target that fetches once, never per-request
* **Process checklist entry** -> [`example-checklist.md`](./example-checklist.md) - Asset Fidelity applies to vendored templates the same way it applies to reused CSS/JS/icons: byte-diffed against the pinned reference, not hand-transcribed
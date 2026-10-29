#!/usr/bin/env node
/**
 * Offline self-test of docs.mjs: the parsers and rewriters that decide what an agent reads.
 * No network — the fixtures below are shaped like the site's llms.txt and its Markdown twins.
 * Exits non-zero on the first mismatch.
 */

import {
  branchOf,
  cleanPage,
  headingBlock,
  looksLikeMarkdown,
  matches,
  pageUrlFrom,
  parseIndex,
  rehost,
  resolveSection,
  score,
  sectionIdOf,
  tocOf,
} from "./docs.mjs";

let failed = 0;
let passed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`ok    ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}\n      expected ${e}\n      actual   ${a}`);
  }
}

const ROOT_LLMS = `# ONLYOFFICE API Documentation

> API documentation.

## ONLYOFFICE Docs

- [Docs API](https://api.onlyoffice.io/docs/docs-api/llms.txt): Integrate ONLYOFFICE Docs.

## ONLYOFFICE DocSpace

- [Embed SDK](https://api.onlyoffice.io/docspace/javascript-sdk/llms.txt): Embed DocSpace in your web app.
- [Plugins SDK](https://api.onlyoffice.io/docspace/plugins-sdk/llms.txt): Extend the DocSpace portal.
`;

const SECTION_LLMS = `# ONLYOFFICE DocSpace: Embed SDK

## Embedding modes

- [Manager mode](https://api.onlyoffice.io/docspace/javascript-sdk/embedding-modes/manager-mode.md): Manager mode embeds the full DocSpace interface.

## SDK usage

- [TFrameConfig](https://api.onlyoffice.io/docspace/javascript-sdk/usage-sdk/type-aliases/TFrameConfig.md): The main configuration object.
- [TListResponse\\<TFolder\\>](https://api.onlyoffice.io/docspace/javascript-sdk/usage-sdk/type-aliases/TListResponse.md): Response wrapper.
`;

const PAGE = `---
custom_edit_url: https://github.com/ONLYOFFICE/docspace-sdk-js/blob/release/v4.0.0/src/types/index.ts
---

import APITable from '@site/src/components/APITable/APITable';

# TFrameConfig

The main configuration object.

## Example

\`\`\`ts
const c = 1;
\`\`\`

## Properties

<APITable>

| Property | Type |
| --- | --- |
| \`frameId\` | string |

</APITable>

### Nested

Text.

## Remarks

Done.
`;

// parseIndex
const root = parseIndex(ROOT_LLMS);
check("parseIndex: three entries under two groups", root.map((e) => [e.title, e.group]), [
  ["Docs API", "ONLYOFFICE Docs"],
  ["Embed SDK", "ONLYOFFICE DocSpace"],
  ["Plugins SDK", "ONLYOFFICE DocSpace"],
]);
check("parseIndex: summary without the colon", root[1].summary, "Embed DocSpace in your web app.");
const section = parseIndex(SECTION_LLMS);
check("parseIndex: escaped angle brackets in a title are unescaped", section[2].title, "TListResponse<TFolder>");

// sectionIdOf / rehost (the fixture hosts are placeholders; the real ones come from sources.json)
const PROD = "https://docs.example.com";
const STAND = "https://stand.example.com";
check("sectionIdOf strips origin and llms.txt", sectionIdOf(`${STAND}/docspace/javascript-sdk/llms.txt`), "docspace/javascript-sdk");
const known = [PROD, STAND];
check("rehost moves a known origin", rehost(`${STAND}/docspace/x/y.md`, PROD, known), `${PROD}/docspace/x/y.md`);
check("rehost leaves a foreign origin alone", rehost("https://github.com/ONLYOFFICE/x", PROD, known), "https://github.com/ONLYOFFICE/x");

// pageUrlFrom
check("pageUrlFrom: site URL with trailing slash gets .md", pageUrlFrom(`${PROD}/docspace/javascript-sdk/embedding-modes/manager-mode/`, PROD), `${PROD}/docspace/javascript-sdk/embedding-modes/manager-mode.md`);
check("pageUrlFrom: .md URL kept, anchor dropped", pageUrlFrom(`${PROD}/a/b.md#c`, PROD), `${PROD}/a/b.md`);
check("pageUrlFrom: site path with a leading slash", pageUrlFrom("/docspace/plugins-sdk/get-started", PROD), `${PROD}/docspace/plugins-sdk/get-started.md`);
check("pageUrlFrom: site path without a leading slash (Git Bash on Windows)", pageUrlFrom("docspace/plugins-sdk/get-started", PROD), `${PROD}/docspace/plugins-sdk/get-started.md`);
check("pageUrlFrom: llms.txt untouched", pageUrlFrom("/docspace/javascript-sdk/llms.txt", PROD), `${PROD}/docspace/javascript-sdk/llms.txt`);
check("pageUrlFrom: a bare name is not a URL", pageUrlFrom("TFrameConfig", PROD), null);
check("pageUrlFrom: words with spaces are not a path", pageUrlFrom("upload / download", PROD), null);

// score
check("score: a word in the title counts twice", score({ title: "Uploader mode", url: "", summary: "upload files" }, ["uploader", "upload"]), 4);
check("score: summary-only words count once, missing words zero", score({ title: "Manager mode", url: "", summary: "embeds the manager" }, ["manager", "uploader"]), 2);

// branchOf
check("branchOf: release branch with a slash", branchOf("https://github.com/ONLYOFFICE/docspace-sdk-js/blob/release/v4.0.0/src/types/index.ts"), "release/v4.0.0");
check("branchOf: develop", branchOf("https://github.com/ONLYOFFICE/docspace-plugin-sdk/blob/develop/src/react/hooks.ts"), "develop");
check("branchOf: no blob", branchOf("https://example.com/x"), null);
check("branchOf: null input", branchOf(null), null);

// cleanPage / tocOf / headingBlock
const { body, editUrl } = cleanPage(PAGE);
check("cleanPage: front matter removed and edit url kept", [body.startsWith("# TFrameConfig"), editUrl], [true, "https://github.com/ONLYOFFICE/docspace-sdk-js/blob/release/v4.0.0/src/types/index.ts"]);
check("cleanPage: Docusaurus import and APITable tags dropped", [body.includes("import APITable"), body.includes("<APITable>")], [false, false]);
check("cleanPage: the table survives", body.includes("| `frameId` | string |"), true);
check("tocOf: headings indented by level", tocOf(body), "TFrameConfig\n  Example\n  Properties\n    Nested\n  Remarks");
check("headingBlock: a section runs to the next heading of the same level", headingBlock(body, "properties"), "## Properties\n\n| Property | Type |\n| --- | --- |\n| `frameId` | string |\n\n### Nested\n\nText.");
check("headingBlock: unknown heading", headingBlock(body, "nothing"), null);

// matches / resolveSection / looksLikeMarkdown
check("matches: every word, any field, case-insensitive", matches(section[1], ["tframeconfig", "configuration"]), true);
check("matches: a missing word fails", matches(section[1], ["tframeconfig", "uploader"]), false);
const ids = ["docs/docs-api", "docspace/javascript-sdk", "docspace/plugins-sdk"];
check("resolveSection: alias", resolveSection("embed-sdk", ids), "docspace/javascript-sdk");
check("resolveSection: skill-name alias", resolveSection("apps-plugin-sdk", ids), "docspace/plugins-sdk");
check("resolveSection: exact id", resolveSection("docspace/plugins-sdk", ids), "docspace/plugins-sdk");
check("resolveSection: unique substring", resolveSection("javascript", ids), "docspace/javascript-sdk");
check("resolveSection: ambiguous substring lists candidates", resolveSection("docspace", ids), ["docspace/javascript-sdk", "docspace/plugins-sdk"]);
check("resolveSection: unknown", resolveSection("nothing", ids), null);
check("looksLikeMarkdown: 200 Markdown", looksLikeMarkdown(200, "# Title\n"), true);
check("looksLikeMarkdown: 200 HTML shell is not Markdown", looksLikeMarkdown(200, "<!doctype html><html>…"), false);
check("looksLikeMarkdown: 404", looksLikeMarkdown(404, "# Not found"), false);

console.log(`\n${passed}/${passed + failed} expectations passed`);
process.exit(failed ? 1 : 0);

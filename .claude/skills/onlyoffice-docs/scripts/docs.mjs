#!/usr/bin/env node
/**
 * Reads the ONLYOFFICE API documentation as Markdown for an agent: which sections the site has,
 * which page answers a question, and the page itself — from the production site, or from the
 * fallback stand while production does not serve the Markdown twins yet.
 *
 *   node docs.mjs status [--json]                  production vs fallback: llms.txt and one .md page per section
 *   node docs.mjs sections [--json]                the sections of the site (from the root llms.txt)
 *   node docs.mjs find <words…> [--section <s>]    pages whose title, URL or summary contain every word
 *   node docs.mjs page <url | /path | Name> [--toc | --heading <text>]   one page as Markdown
 *
 * Options: --host <origin> uses that site and skips the probe; --refresh ignores the cache;
 * --json prints machine-readable output (status, sections, find).
 *
 * The hosts come from the repository's root sources.json (apiSite, apiSiteFallback); without that
 * file the built-in defaults apply. Repository-internal: the plugin does not ship it. Only the docs
 * site is contacted, reads only; answers are cached for an hour under the OS temp directory.
 *
 * Exit codes: 0 done; 1 the request could not be answered (no page, ambiguous name, both hosts
 * down); for `status`: 0 production serves everything, 1 production is incomplete but the
 * fallback serves it, 2 neither host does.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_MANIFEST = path.resolve(HERE, "..", "..", "..", "sources.json");
const DEFAULT_HOSTS = { apiSite: "https://api.onlyoffice.com", apiSiteFallback: "https://api.onlyoffice.io" };
const TIMEOUT_MS = 10_000; // a docs page answers in well under a second; ten seconds covers a slow stand
const CACHE_TTL_MS = 60 * 60 * 1000; // an hour: long enough for a session, short enough to see a deploy
const CACHE_DIR = path.join(os.tmpdir(), "onlyoffice-docs-cache");
const LONG_PAGE_CHARS = 15_000; // ~4k tokens: above this, suggest --toc / --heading
const MAX_FIND_RESULTS = 40;

/** Short names an agent is likely to type for a section, mapped to the section's path on the site. */
export const SECTION_ALIASES = {
  "embed-sdk": "docspace/javascript-sdk",
  "javascript-sdk": "docspace/javascript-sdk",
  "js-sdk": "docspace/javascript-sdk",
  "plugins-sdk": "docspace/plugins-sdk",
  "plugin-sdk": "docspace/plugins-sdk",
  rest: "docspace/api-backend",
  "api-backend": "docspace/api-backend",
  "rest-api": "docspace/api-backend",
  mcp: "docspace/mcp-server",
  "mcp-server": "docspace/mcp-server",
  "docs-api": "docs/docs-api",
  "office-api": "docs/office-api",
  plugins: "docs/plugins",
  macros: "docs/macros",
  ai: "docs/ai",
  "document-builder": "docs/document-builder",
  builder: "docs/document-builder",
  desktop: "docs/desktop-editors",
  "desktop-editors": "docs/desktop-editors",
};

// ---------------------------------------------------------------- pure helpers (tested offline)

/** `- [Title](<page url>.md): summary` lines of an llms.txt, with the `## Group` each sits under. */
export function parseIndex(text) {
  const entries = [];
  let group = "";
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      group = h[1].trim();
      continue;
    }
    const m = line.match(/^-\s+\[(.+?)\]\((https?:\/\/[^)\s]+)\)(?::\s*(.*))?$/);
    if (!m) continue;
    entries.push({ title: m[1].replaceAll("\\", ""), url: m[2], summary: (m[3] ?? "").trim(), group });
  }
  return entries;
}

/** The section id of a URL on the site: `https://docs.example.com/docspace/javascript-sdk/llms.txt` → `docspace/javascript-sdk`. */
export function sectionIdOf(url) {
  try {
    const p = new URL(url).pathname.replace(/^\/+/, "").replace(/\/llms\.txt$/, "");
    return p.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/** The same path on another origin. Only origins the tool knows are rewritten; anything else is returned as is. */
export function rehost(url, origin, knownOrigins) {
  try {
    const u = new URL(url);
    if (!knownOrigins.includes(u.origin)) return url;
    return origin + u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

/**
 * A page URL from what the agent typed: a full URL, a site path (with or without the leading
 * slash — Git Bash on Windows rewrites a leading `/` into a drive path, so `docspace/...` works
 * too) or nothing usable (null). Ensures the `.md` twin.
 */
export function pageUrlFrom(input, origin) {
  let url = null;
  if (/^https?:\/\//.test(input)) url = input;
  else if (input.startsWith("/")) url = origin + input;
  else if (input.includes("/") && !/\s/.test(input)) url = `${origin}/${input}`;
  if (!url) return null;
  url = url.replace(/#.*$/, "").replace(/\/+$/, "");
  if (!/\.md$/.test(url) && !/\.txt$/.test(url)) url += ".md";
  return url;
}

/** The git ref of a `custom_edit_url` such as …/blob/release/v4.0.0/src/types/index.ts → `release/v4.0.0`. */
export function branchOf(editUrl) {
  const m = editUrl?.match(/\/blob\/(.+)$/);
  if (!m) return null;
  const segs = m[1].split("/");
  const stop = segs.findIndex((s, i) => i > 0 && (/^(src|docs|site|packages|lib|libs|test|tests|www)$/.test(s) || /\.[a-z]+$/i.test(s)));
  return (stop > 0 ? segs.slice(0, stop) : [segs[0]]).join("/");
}

/**
 * Strips what the site's build needs and a reader does not: the front matter (kept aside for
 * `custom_edit_url`), Docusaurus `import` lines and `<APITable>` wrappers.
 */
export function cleanPage(text) {
  let body = text.replace(/\r\n/g, "\n");
  let editUrl = null;
  const fm = body.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    editUrl = fm[1].match(/^custom_edit_url:\s*(\S+)/m)?.[1] ?? null;
    body = body.slice(fm[0].length);
  }
  body = body
    .split("\n")
    .filter((l) => !/^import\s.+\sfrom\s+['"]@(site|theme|docusaurus)\/.*['"];?\s*$/.test(l))
    .filter((l) => !/^\s*<\/?APITable>\s*$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { body, editUrl };
}

/** The headings of a page, indented by level. */
export function tocOf(body) {
  return body
    .split("\n")
    .filter((l) => /^#{1,6}\s/.test(l))
    .map((l) => {
      const level = l.match(/^#+/)[0].length;
      return `${"  ".repeat(level - 1)}${l.replace(/^#+\s*/, "")}`;
    })
    .join("\n");
}

/** One section of a page: from the first heading containing `text` to the next heading of the same or a higher level. */
export function headingBlock(body, text) {
  const lines = body.split("\n");
  const needle = text.toLowerCase();
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.toLowerCase().includes(needle));
  if (start < 0) return null;
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,6})\s/);
    if (h && h[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

/** Every word must appear in the title, URL or summary; case-insensitive. */
export function matches(entry, words) {
  const hay = `${entry.title} ${entry.url} ${entry.summary}`.toLowerCase();
  return words.every((w) => hay.includes(w.toLowerCase()));
}

/**
 * How well an entry answers the words: a word in the title counts twice, anywhere else once, so a
 * page named after the thing asked about sorts above a page that only mentions it in its summary.
 */
export function score(entry, words) {
  const title = entry.title.toLowerCase();
  const rest = `${entry.url} ${entry.summary}`.toLowerCase();
  let s = 0;
  for (const raw of words) {
    const w = raw.toLowerCase();
    if (title.includes(w)) s += 2;
    else if (rest.includes(w)) s += 1;
  }
  return s;
}

/** Resolves `--section` input to a section id: an alias, an exact id, or a substring of one. */
export function resolveSection(input, ids) {
  if (!input) return null;
  const key = input.toLowerCase().replace(/^\/+|\/+$/g, "");
  if (SECTION_ALIASES[key]) return SECTION_ALIASES[key];
  if (ids.includes(key)) return key;
  const hits = ids.filter((id) => id.includes(key));
  return hits.length === 1 ? hits[0] : hits.length ? hits : null;
}

/** Whether a fetched body is Markdown rather than the site's HTML shell (a soft 404 or a page without a twin). */
export function looksLikeMarkdown(status, text) {
  return status === 200 && !/^\s*<(!doctype|html|head|body)/i.test(text.slice(0, 300));
}

// ---------------------------------------------------------------- network + cache

function cachePath(key) {
  return path.join(CACHE_DIR, createHash("sha1").update(key).digest("hex") + ".json");
}

function readCache(key, refresh) {
  if (refresh) return null;
  const file = cachePath(key);
  if (!existsSync(file)) return null;
  try {
    const entry = JSON.parse(readFileSync(file, "utf8"));
    return Date.now() - entry.at < CACHE_TTL_MS ? entry.value : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath(key), JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* a read-only temp dir only costs the cache */
  }
}

async function fetchText(url, { refresh = false } = {}) {
  const cached = readCache(url, refresh);
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let result;
  try {
    const res = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { accept: "text/markdown, text/plain, */*" } });
    const text = await res.text();
    result = { status: res.status, text, contentType: res.headers.get("content-type") ?? "" };
  } catch (e) {
    result = { status: 0, text: "", error: e.name === "AbortError" ? "timeout" : e.message };
  } finally {
    clearTimeout(timer);
  }
  if (result.status === 200) writeCache(url, result);
  return result;
}

function loadHosts() {
  if (existsSync(ROOT_MANIFEST)) {
    try {
      const h = JSON.parse(readFileSync(ROOT_MANIFEST, "utf8")).hosts ?? {};
      return { apiSite: h.apiSite ?? DEFAULT_HOSTS.apiSite, apiSiteFallback: h.apiSiteFallback ?? DEFAULT_HOSTS.apiSiteFallback };
    } catch {
      /* fall through to the defaults */
    }
  }
  return { ...DEFAULT_HOSTS };
}

/** The origin to read from: the primary while it serves llms.txt as Markdown, otherwise the fallback. */
async function resolveHost(hosts, { forced, refresh }) {
  if (forced) return { origin: forced.replace(/\/+$/, ""), fallback: false, forced: true };
  const cached = readCache("host-resolution", refresh);
  if (cached) return cached;
  const primary = await fetchText(`${hosts.apiSite}/llms.txt`, { refresh });
  let resolution;
  if (looksLikeMarkdown(primary.status, primary.text)) resolution = { origin: hosts.apiSite, fallback: false };
  else {
    const twin = await fetchText(`${hosts.apiSiteFallback}/llms.txt`, { refresh });
    if (looksLikeMarkdown(twin.status, twin.text)) resolution = { origin: hosts.apiSiteFallback, fallback: true, primaryStatus: primary.status || primary.error };
    else return { origin: null, primaryStatus: primary.status || primary.error, fallbackStatus: twin.status || twin.error };
  }
  writeCache("host-resolution", resolution);
  return resolution;
}

function sourceLine(hosts, res) {
  if (res.forced) return `source: ${res.origin} (given with --host)`;
  if (res.fallback) return `source: FALLBACK ${res.origin} — production ${hosts.apiSite} has no Markdown docs yet (${res.primaryStatus}); the stand may be ahead of or behind the released version, name it when you cite it`;
  return `source: ${res.origin} (production)`;
}

async function loadSections(origin, refresh) {
  const root = await fetchText(`${origin}/llms.txt`, { refresh });
  if (!looksLikeMarkdown(root.status, root.text)) return null;
  return parseIndex(root.text)
    .filter((e) => e.url.endsWith("/llms.txt"))
    .map((e) => ({ id: sectionIdOf(e.url), name: e.title, description: e.summary, group: e.group, url: e.url }));
}

async function loadSectionEntries(section, origin, refresh, knownOrigins) {
  const res = await fetchText(rehost(section.url, origin, knownOrigins), { refresh });
  if (!looksLikeMarkdown(res.status, res.text)) return [];
  return parseIndex(res.text).map((e) => ({ ...e, section: section.id, url: rehost(e.url, origin, knownOrigins) }));
}

// ---------------------------------------------------------------- commands

async function cmdStatus(hosts, opts) {
  const origins = [
    { label: "production", origin: hosts.apiSite },
    { label: "fallback", origin: hosts.apiSiteFallback },
  ];
  const knownOrigins = origins.map((o) => o.origin);
  const roots = {};
  for (const o of origins) {
    const r = await fetchText(`${o.origin}/llms.txt`, { refresh: opts.refresh });
    roots[o.label] = { status: r.status || r.error, markdown: looksLikeMarkdown(r.status, r.text), text: r.text };
  }
  const sectionsFrom = roots.production.markdown ? hosts.apiSite : roots.fallback.markdown ? hosts.apiSiteFallback : null;
  const sections = sectionsFrom ? await loadSections(sectionsFrom, opts.refresh) : [];
  const rows = [];
  for (const s of sections) {
    const row = { section: s.id };
    for (const o of origins) {
      const idx = await fetchText(rehost(s.url, o.origin, knownOrigins), { refresh: opts.refresh });
      const idxOk = looksLikeMarkdown(idx.status, idx.text);
      let pageOk = null;
      let pageUrl = null;
      if (idxOk) {
        const first = parseIndex(idx.text).find((e) => e.url.endsWith(".md"));
        if (first) {
          pageUrl = rehost(first.url, o.origin, knownOrigins);
          const page = await fetchText(pageUrl, { refresh: opts.refresh });
          pageOk = looksLikeMarkdown(page.status, page.text);
        }
      }
      row[o.label] = { llms: idxOk ? "ok" : String(idx.status || idx.error), page: pageOk === null ? "-" : pageOk ? "ok" : "no", pageUrl };
    }
    rows.push(row);
  }
  const complete = (label) => roots[label].markdown && rows.length > 0 && rows.every((r) => r[label].llms === "ok" && r[label].page === "ok");
  const verdict = complete("production") ? "production" : complete("fallback") ? "fallback" : "none";
  if (opts.json) {
    console.log(JSON.stringify({ hosts, roots: { production: roots.production.status, fallback: roots.fallback.status }, sections: rows, verdict }, null, 2));
  } else {
    console.log(`production ${hosts.apiSite}/llms.txt: ${roots.production.markdown ? "ok" : roots.production.status}`);
    console.log(`fallback   ${hosts.apiSiteFallback}/llms.txt: ${roots.fallback.markdown ? "ok" : roots.fallback.status}`);
    if (rows.length) {
      console.log("");
      console.log(`${"section".padEnd(28)} ${"production".padEnd(18)} fallback`);
      console.log(`${"".padEnd(28)} ${"llms.txt / .md".padEnd(18)} llms.txt / .md`);
      for (const r of rows) console.log(`${r.section.padEnd(28)} ${`${r.production.llms} / ${r.production.page}`.padEnd(18)} ${r.fallback.llms} / ${r.fallback.page}`);
    }
    console.log("");
    console.log(
      verdict === "production"
        ? "verdict: production serves llms.txt and Markdown pages for every section — the plugin's links are live"
        : verdict === "fallback"
          ? "verdict: production is incomplete; the fallback stand serves every section — the docs skill reads from it until the site is deployed"
          : "verdict: neither host serves the Markdown docs — only the installed packages' types remain as a source",
    );
  }
  process.exit(verdict === "production" ? 0 : verdict === "fallback" ? 1 : 2);
}

async function withHost(hosts, opts, fn) {
  const res = await resolveHost(hosts, { forced: opts.host, refresh: opts.refresh });
  if (!res.origin) {
    console.log(`neither ${hosts.apiSite} (${res.primaryStatus}) nor ${hosts.apiSiteFallback} (${res.fallbackStatus}) serves llms.txt — the documentation is not reachable from here. Use the types installed in the project (node_modules/@onlyoffice/*/dist/types) and say so.`);
    process.exit(1);
  }
  if (!opts.json) console.log(sourceLine(hosts, res));
  const knownOrigins = [hosts.apiSite, hosts.apiSiteFallback, res.origin];
  await fn(res, knownOrigins);
}

async function cmdSections(hosts, opts) {
  await withHost(hosts, opts, async (res) => {
    const sections = await loadSections(res.origin, opts.refresh);
    if (!sections) {
      console.log("the root llms.txt could not be read");
      process.exit(1);
    }
    if (opts.json) return console.log(JSON.stringify(sections, null, 2));
    let group = "";
    for (const s of sections) {
      if (s.group !== group) {
        group = s.group;
        console.log(`\n## ${group}`);
      }
      console.log(`${s.id.padEnd(26)} ${s.name} — ${s.description}`);
    }
    console.log(`\nfind pages with: docs.mjs find <words> --section <id or alias: ${Object.keys(SECTION_ALIASES).slice(0, 6).join(", ")}, …>`);
  });
}

async function cmdFind(hosts, opts, words) {
  if (!words.length) {
    console.log("usage: docs.mjs find <words…> [--section <s>]");
    process.exit(1);
  }
  await withHost(hosts, opts, async (res, knownOrigins) => {
    const sections = (await loadSections(res.origin, opts.refresh)) ?? [];
    const ids = sections.map((s) => s.id);
    let chosen = sections;
    if (opts.section) {
      const id = resolveSection(opts.section, ids);
      if (!id) {
        console.log(`no section matches "${opts.section}"; run docs.mjs sections`);
        process.exit(1);
      }
      if (Array.isArray(id)) {
        console.log(`"${opts.section}" matches several sections: ${id.join(", ")}`);
        process.exit(1);
      }
      chosen = sections.filter((s) => s.id === id);
    }
    const all = [];
    for (const s of chosen) all.push(...(await loadSectionEntries(s, res.origin, opts.refresh, knownOrigins)));
    const bySc = (a, b) => score(b, words) - score(a, words) || a.title.localeCompare(b.title);
    let hits = all.filter((e) => matches(e, words)).sort(bySc);
    let partial = false;
    if (!hits.length) {
      // nothing carries every word: show what carries most of them, so the agent can pick a page or re-word
      partial = true;
      hits = all.filter((e) => score(e, words) > 0).sort(bySc).slice(0, 10);
    }
    if (opts.json) return console.log(JSON.stringify({ partial, hits }, null, 2));
    if (!hits.length) {
      console.log(`no page mentions ${words.map((w) => `"${w}"`).join(" ")}${opts.section ? ` in ${chosen.map((s) => s.id).join(", ")}` : ""} — try other words, or a type/interface name with docs.mjs page <Name>`);
      process.exit(1);
    }
    if (partial) console.log(`no page contains every word; the closest ${hits.length} by words matched:`);
    for (const e of hits.slice(0, MAX_FIND_RESULTS)) {
      console.log(`- ${e.title} [${e.section}]\n  ${e.url}${e.summary ? `\n  ${e.summary}` : ""}`);
    }
    if (hits.length > MAX_FIND_RESULTS) console.log(`… ${hits.length - MAX_FIND_RESULTS} more; add words or --section to narrow`);
  });
}

async function cmdPage(hosts, opts, target) {
  if (!target) {
    console.log("usage: docs.mjs page <url | /path | Name> [--toc | --heading <text>]");
    process.exit(1);
  }
  await withHost(hosts, opts, async (res, knownOrigins) => {
    let url = pageUrlFrom(target, res.origin);
    if (url) url = rehost(url, res.origin, knownOrigins);
    else {
      // a bare name: a page title or the last URL segment, searched across every section index
      const sections = (await loadSections(res.origin, opts.refresh)) ?? [];
      const name = target.toLowerCase();
      const found = [];
      for (const s of sections) {
        for (const e of await loadSectionEntries(s, res.origin, opts.refresh, knownOrigins)) {
          const slug = e.url.replace(/\.md$/, "").split("/").pop().toLowerCase();
          if (e.title.toLowerCase() === name || slug === name) found.push(e);
        }
      }
      if (found.length === 1) url = found[0].url;
      else if (found.length > 1) {
        console.log(`"${target}" names ${found.length} pages — pass the URL:`);
        for (const e of found) console.log(`- ${e.title} [${e.section}]  ${e.url}`);
        process.exit(1);
      } else {
        console.log(`no page is titled "${target}"; try docs.mjs find ${target}`);
        process.exit(1);
      }
    }
    const page = await fetchText(url, { refresh: opts.refresh });
    if (!looksLikeMarkdown(page.status, page.text)) {
      console.log(`${url} is not available as Markdown on this host (${page.status || page.error}). Run docs.mjs status to see which host serves the section.`);
      process.exit(1);
    }
    const { body, editUrl } = cleanPage(page.text);
    const branch = branchOf(editUrl);
    console.log(`page: ${url}`);
    if (branch) console.log(`generated from: ${editUrl} (branch ${branch})`);
    if (opts.toc) return console.log(`\n${tocOf(body)}`);
    if (opts.heading) {
      const block = headingBlock(body, opts.heading);
      if (!block) {
        console.log(`no heading contains "${opts.heading}"; headings:\n${tocOf(body)}`);
        process.exit(1);
      }
      return console.log(`\n${block}`);
    }
    if (body.length > LONG_PAGE_CHARS) console.log(`note: long page (${Math.round(body.length / 1024)} KB) — next time --toc lists its headings and --heading <text> prints one part`);
    console.log(`\n${body}`);
  });
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const opts = { json: false, refresh: false, toc: false, host: null, section: null, heading: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--refresh" || a === "--no-cache") opts.refresh = true;
    else if (a === "--toc") opts.toc = true;
    else if (a === "--host") opts.host = argv[++i];
    else if (a === "--section") opts.section = argv[++i];
    else if (a === "--heading") opts.heading = argv[++i];
    else rest.push(a);
  }
  return { opts, rest };
}

async function main() {
  const { opts, rest } = parseArgs(process.argv.slice(2));
  const [command, ...args] = rest;
  const hosts = loadHosts();
  switch (command) {
    case "status":
      return cmdStatus(hosts, opts);
    case "sections":
      return cmdSections(hosts, opts);
    case "find":
      return cmdFind(hosts, opts, args);
    case "page":
      return cmdPage(hosts, opts, args[0]);
    default:
      console.log(
        [
          "usage:",
          "  docs.mjs status [--json]                         is the Markdown documentation live on production, on the fallback, or nowhere",
          "  docs.mjs sections [--json]                       the sections of the site",
          "  docs.mjs find <words…> [--section <s>] [--json]  pages whose title, URL or summary contain every word",
          "  docs.mjs page <url | /path | Name> [--toc | --heading <text>]   one page as Markdown",
          "options: --host <origin>  --refresh",
        ].join("\n"),
      );
      process.exit(command ? 1 : 0);
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((e) => {
    console.error(`docs.mjs: ${e.message}`);
    process.exit(1);
  });
}

#!/usr/bin/env node
/**
 * Keeps the plugin's manifests in step. The plugin carries two: plugin.json at the plugin root
 * (Agent Plugins 1.0.0, read by OpenAI, Codex and the other clients of the standard; its
 * OpenAI listing lives under extensions["com.openai"]) and .claude-plugin/plugin.json (read by
 * Claude Code and Anthropic's directory). The marketplace manifest names the plugin a third time.
 *
 *   node tools/check-manifests.mjs              # the working tree
 *   node tools/check-manifests.mjs --ref v0.2.0 # the committed files of a tag or any other revision
 *
 * With --ref every file it reads, the manifests and the icons they name, comes from that
 * revision; tools/build-plugin.mjs passes its own, so the check vouches for what the build ships.
 *
 * Checks:
 *   - the fields both plugin manifests carry are equal: name, version, description, author,
 *     homepage, repository, license, keywords
 *   - the marketplace entry has the same name and description, and metadata.version the same version
 *   - plugin.json uses only the keys the Agent Plugins 1.0.0 schema allows, and a name that fits it
 *   - the OpenAI listing fits the directory's limits (displayName and shortDescription 30
 *     characters, longDescription 4000, developerName 80), capabilities, when given, is an array,
 *     and every icon it names is in the plugin under a ./ path and is what OpenAI accepts: PNG,
 *     JPEG, WebP or SVG, square, 48 px or more (a raster at most 4096), 5 MiB or less
 *     (https://developers.openai.com/plugins/deploy/submission)
 *   - both manifests give the same privacy policy and terms of service, as https:// URLs
 *     (privacyPolicyUrl and termsOfServiceUrl in Claude's, privacyPolicyURL and termsOfServiceURL
 *     in the OpenAI listing), and the listing's websiteURL and supportURL are https:// too
 *   - the icon .claude-plugin/plugin.json names, when it names one, is an image file inside the
 *     plugin (https://code.claude.com/docs/en/plugins-reference#directory-listing-fields) that the
 *     directory's file checks pass: PNG, JPEG, GIF, WebP or SVG, 5 MiB or less
 *     (https://claude.com/docs/plugins/pre-submission-checklist). Anthropic documents no size or
 *     shape for it
 *
 * Exit: 0 in step, 1 a mismatch, 2 a manifest that cannot be read. No dependencies, no network.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = ROOT;
const PORTABLE = path.join(PLUGIN, "plugin.json");
const CLAUDE = path.join(PLUGIN, ".claude-plugin", "plugin.json");
const MARKETPLACE = path.join(ROOT, ".claude-plugin", "marketplace.json");

const SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const PORTABLE_KEYS = ["$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords", "extensions"];
const SHARED_KEYS = ["name", "version", "description", "author", "homepage", "repository", "license", "keywords"];
const NAME = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const LIMITS = { displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80 };
const ASSETS = ["composerIcon", "composerIconDark", "logo", "logoDark"];
const OPENAI_ICON = { formats: ["png", "jpeg", "webp", "svg"], dotSlash: true, square: true, min: 48, max: 4096, bytes: 5 * 1024 * 1024 };
const CLAUDE_ICON = { formats: ["png", "jpeg", "gif", "webp", "svg"], bytes: 5 * 1024 * 1024 };

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(2);
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

const args = process.argv.slice(2);
const refAt = args.indexOf("--ref");
const REF = refAt === -1 ? null : args[refAt + 1];
if (refAt !== -1 && !REF) fail("--ref needs a revision");
if (REF) {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", `${REF}^{commit}`], { cwd: ROOT, stdio: "ignore" });
  } catch {
    fail(`${REF} is not a revision of this repository`);
  }
}

// The file's bytes, from REF when one is given and from the working tree otherwise; null when there is no such file.
function load(file) {
  try {
    if (REF) return execFileSync("git", ["cat-file", "blob", `${REF}:${rel(file)}`], { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] });
    return readFileSync(file);
  } catch {
    return null;
  }
}

// Format and pixel size from the file's own header; null when it is none of the five formats.
function imageInfo(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { format: "png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString("ascii", 0, 4) === "GIF8") return { format: "gif", width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) return { format: "jpeg" };
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { format: "jpeg", width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
    return { format: "jpeg" };
  }
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { format: "webp", width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === "VP8L") return { format: "webp", width: 1 + (b.readUInt32LE(21) & 0x3fff), height: 1 + ((b.readUInt32LE(21) >> 14) & 0x3fff) };
    if (chunk === "VP8 ") return { format: "webp", width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    return { format: "webp" };
  }
  const svg = b.toString("utf8", 0, Math.min(b.length, 4096)).match(/<svg\b[^>]*>/);
  if (svg) {
    const attr = (name) => svg[0].match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
    const [width, height] = [attr("width"), attr("height")].map((v) => (v && /^\d+(\.\d+)?(px)?$/.test(v) ? parseFloat(v) : undefined));
    if (width && height) return { format: "svg", width, height };
    const box = attr("viewBox")?.trim().split(/[\s,]+/).map(Number);
    return box?.length === 4 ? { format: "svg", width: box[2], height: box[3] } : { format: "svg" };
  }
  return null;
}

// What is wrong with the icon at `asset` for a directory with these rules, or [] when nothing is.
function iconProblems(asset, rules) {
  if (typeof asset !== "string" || !asset) return [`must be a path to a file in the plugin`];
  if (rules.dotSlash && !asset.startsWith("./")) return [`must be a path starting with ./`];
  const file = path.resolve(PLUGIN, asset);
  const inside = path.relative(PLUGIN, file);
  const data = inside.startsWith("..") || path.isAbsolute(inside) ? null : load(file);
  if (!data) return [`${asset} is not in the plugin`];
  const info = imageInfo(data);
  if (!info || !rules.formats.includes(info.format)) return [`${asset} is ${info?.format ?? "not an image"}; accepted: ${rules.formats.join(", ")}`];
  const found = [];
  const bytes = data.length;
  if (bytes > rules.bytes) found.push(`${asset} is ${bytes} bytes, the limit is ${rules.bytes}`);
  if (!rules.square) return found;
  if (!info.width || !info.height) return [...found, `${asset}: its size cannot be read`];
  if (info.width !== info.height) found.push(`${asset} is ${info.width}x${info.height}, not square`);
  if (info.width < rules.min) found.push(`${asset} is ${info.width} px, the minimum is ${rules.min}`);
  if (info.format !== "svg" && info.width > rules.max) found.push(`${asset} is ${info.width} px, the maximum is ${rules.max}`);
  return found;
}

function read(file) {
  const data = load(file);
  if (!data) fail(`${rel(file)} not found${REF ? ` at ${REF}` : ""}`);
  try {
    return JSON.parse(data.toString("utf8"));
  } catch (error) {
    fail(`${rel(file)} is not valid JSON (${error.message.split("\n")[0]})`);
  }
}

const portable = read(PORTABLE);
const claude = read(CLAUDE);
const marketplace = read(MARKETPLACE);
const problems = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const key of SHARED_KEYS) {
  if (!same(portable[key], claude[key])) problems.push(`${key} differs: ${rel(PORTABLE)} has ${JSON.stringify(portable[key])}, ${rel(CLAUDE)} has ${JSON.stringify(claude[key])}`);
}

const entry = (marketplace.plugins ?? []).find((p) => p.name === claude.name);
if (!entry) {
  problems.push(`${rel(MARKETPLACE)} lists no plugin named "${claude.name}"`);
} else if (entry.description !== claude.description) {
  problems.push(`${rel(MARKETPLACE)}: the entry's description differs from plugin.json's`);
}
if (marketplace.metadata?.version !== claude.version) problems.push(`${rel(MARKETPLACE)}: metadata.version is ${marketplace.metadata?.version}, the plugin is ${claude.version}`);

if (portable.$schema !== SCHEMA) problems.push(`${rel(PORTABLE)}: $schema must be ${SCHEMA}`);
for (const key of Object.keys(portable)) {
  if (!PORTABLE_KEYS.includes(key)) problems.push(`${rel(PORTABLE)}: "${key}" is not an Agent Plugins key; client-specific data goes under extensions`);
}
if (!NAME.test(portable.name ?? "") || portable.name.length > 64) problems.push(`${rel(PORTABLE)}: name "${portable.name}" does not fit the Agent Plugins pattern`);

const listing = portable.extensions?.["com.openai"]?.interface;
if (!listing) {
  problems.push(`${rel(PORTABLE)}: no extensions["com.openai"].interface — OpenAI would fall back to .codex-plugin/plugin.json`);
} else {
  for (const [field, max] of Object.entries(LIMITS)) {
    const value = listing[field];
    if (typeof value !== "string" || !value) problems.push(`interface.${field} is missing`);
    else if ([...value].length > max) problems.push(`interface.${field} is ${[...value].length} characters, the limit is ${max}`);
  }
  if (listing.capabilities !== undefined && !Array.isArray(listing.capabilities)) problems.push("interface.capabilities must be an array");
  for (const field of ASSETS) {
    if (listing[field] === undefined) continue;
    for (const p of iconProblems(listing[field], OPENAI_ICON)) problems.push(`interface.${field}: ${p}`);
  }
}

const LEGAL = { privacyPolicyUrl: "privacyPolicyURL", termsOfServiceUrl: "termsOfServiceURL" };
for (const [claudeKey, openaiKey] of Object.entries(LEGAL)) {
  if (claude[claudeKey] !== listing?.[openaiKey]) problems.push(`${claudeKey} in ${rel(CLAUDE)} is ${JSON.stringify(claude[claudeKey])}, interface.${openaiKey} is ${JSON.stringify(listing?.[openaiKey])}`);
}
for (const [where, value] of [...Object.keys(LEGAL).map((k) => [k, claude[k]]), ...["websiteURL", "supportURL", ...Object.values(LEGAL)].map((k) => [`interface.${k}`, listing?.[k]])]) {
  if (value !== undefined && !/^https:\/\/[^\s]+$/.test(value)) problems.push(`${where} must be an https:// URL, not ${JSON.stringify(value)}`);
}

if (claude.icon !== undefined) {
  for (const p of iconProblems(claude.icon, CLAUDE_ICON)) problems.push(`${rel(CLAUDE)} icon: ${p}`);
}

for (const p of problems) console.log(`MISMATCH  ${p}`);
if (problems.length) process.exit(1);
console.log(`OK: ${rel(PORTABLE)}, ${rel(CLAUDE)} and ${rel(MARKETPLACE)} agree on ${claude.name} ${claude.version}${REF ? ` at ${REF}` : ""}`);

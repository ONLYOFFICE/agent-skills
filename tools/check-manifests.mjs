#!/usr/bin/env node
/**
 * Keeps the plugin's manifests in step. The plugin carries two: plugin.json at the plugin root
 * (Agent Plugins 1.0.0, read by OpenAI, Codex and the other clients of the standard; its
 * OpenAI listing lives under extensions["com.openai"]) and .claude-plugin/plugin.json (read by
 * Claude Code and Anthropic's directory). The marketplace manifest names the plugin a third time.
 *
 *   node tools/check-manifests.mjs
 *
 * Checks:
 *   - the fields both plugin manifests carry are equal: name, version, description, author,
 *     homepage, repository, license, keywords
 *   - the marketplace entry has the same name and description, and metadata.version the same version
 *   - plugin.json uses only the keys the Agent Plugins 1.0.0 schema allows, and a name that fits it
 *   - the OpenAI listing fits the directory's limits (displayName and shortDescription 30
 *     characters, longDescription 4000, developerName 80), capabilities is an array, and every
 *     icon it names is in the plugin and is what OpenAI accepts: PNG, JPEG, WebP or SVG, square,
 *     48 px or more (a raster at most 4096), 5 MiB or less
 *   - both manifests give the same privacy policy and terms of service, as https:// URLs
 *     (privacyPolicyUrl and termsOfServiceUrl in Claude's, privacyPolicyURL and termsOfServiceURL
 *     in the OpenAI listing), and the listing's websiteURL and supportURL are https:// too
 *   - the icon .claude-plugin/plugin.json names, when it names one, is what Anthropic's directory
 *     accepts: PNG or JPEG, square, 512 to 2048 px, under 2 MB. The directory takes it once, at the
 *     first save in the developer portal; a later change does not reach the listing
 *
 * Exit: 0 in step, 1 a mismatch, 2 a manifest that cannot be read. No dependencies, no network.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
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
const OPENAI_ICON = { formats: ["png", "jpeg", "webp", "svg"], min: 48, max: 4096, bytes: 5 * 1024 * 1024 };
const CLAUDE_ICON = { formats: ["png", "jpeg"], min: 512, max: 2048, bytes: 2 * 1000 * 1000 };

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(2);
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

// Format and pixel size from the file's own header; null when it is none of the four formats.
function imageInfo(file) {
  const b = readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { format: "png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
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
  if (typeof asset !== "string" || !asset.startsWith("./")) return [`must be a path starting with ./`];
  const file = path.join(PLUGIN, asset);
  if (!existsSync(file)) return [`${asset} is not in the plugin`];
  const info = imageInfo(file);
  if (!info || !rules.formats.includes(info.format)) return [`${asset} is ${info?.format ?? "not an image"}; accepted: ${rules.formats.join(", ")}`];
  const found = [];
  const bytes = statSync(file).size;
  if (bytes > rules.bytes) found.push(`${asset} is ${bytes} bytes, the limit is ${rules.bytes}`);
  if (!info.width || !info.height) return [...found, `${asset}: its size cannot be read`];
  if (info.width !== info.height) found.push(`${asset} is ${info.width}x${info.height}, not square`);
  if (info.width < rules.min) found.push(`${asset} is ${info.width} px, the minimum is ${rules.min}`);
  if (info.format !== "svg" && info.width > rules.max) found.push(`${asset} is ${info.width} px, the maximum is ${rules.max}`);
  return found;
}

function read(file) {
  if (!existsSync(file)) fail(`${rel(file)} not found`);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
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
  if (!Array.isArray(listing.capabilities)) problems.push("interface.capabilities must be an array ([] when the plugin has none)");
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
console.log(`OK: ${rel(PORTABLE)}, ${rel(CLAUDE)} and ${rel(MARKETPLACE)} agree on ${claude.name} ${claude.version}`);

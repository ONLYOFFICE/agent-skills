/*
 * (c) Copyright Ascensio System SIA 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
/*
 * The kit's peers a plugin project does not install, stubbed for the browser pass.
 *
 * On the portal the client supplies them - the socket client, the markdown renderer, the AI
 * chat, the document editor wrapper - so the kit declares them as optional peers and a plugin
 * project, which keeps the kit external, never installs them. The harness bundles the kit from
 * the project's node_modules, and Vite stops at the first bare import it cannot resolve. So
 * every peer that is missing becomes a module of its own: it exports the names the kit's own
 * build imports from that peer, each a universal stub - callable, constructible, and answering
 * every property with itself - so the kit's module-scope code runs and only a component that
 * really needs the peer would misbehave. The Vite config aliases the peer, with any subpath,
 * to that module.
 */

import fs from "node:fs";
import path from "node:path";

import { HOST_PROVIDED_SPECIFIERS, UI_KIT_PACKAGE } from "../contract.mjs";

const IMPORT_FROM_RE = /(?:import|export)\s+([^;'"]*?)\s*from\s*["']([^"']+)["']/g;
const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/;

const walkJavaScript = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJavaScript(entryPath, out);
    else if (entry.name.endsWith(".js")) out.push(entryPath);
  }
  return out;
};

/** The named bindings of an import clause; the default export is always provided anyway. */
const namedBindings = (clause) => {
  const braces = clause.match(/\{([^}]*)\}/);
  if (!braces) return [];
  return braces[1]
    .split(",")
    .map((part) => part.replace(/\btype\s+/, "").trim().split(/\s+as\s+/)[0].trim())
    .filter((name) => IDENTIFIER_RE.test(name) && name !== "default");
};

/**
 * Where a package is installed for the project, found the way Node finds it: the nearest
 * node_modules up from the project. Only the project's own was looked at, so in a workspace,
 * where react is hoisted to the root, react itself was reported missing and stubbed.
 */
export const packageDir = (projectDir, packageName) => {
  for (let dir = path.resolve(projectDir); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", ...packageName.split("/"));
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
};

/** A package the harness bundles for real: React and the SDK's React entry are never stubs. */
const isHostProvided = (peer) =>
  HOST_PROVIDED_SPECIFIERS.some((specifier) => specifier === peer || specifier.startsWith(`${peer}/`));

/**
 * The kit's peers the project has not installed, each with the names the kit imports from it.
 * @returns {{ peer: string, names: string[] }[]}
 */
export const collectPeerStubs = (projectDir) => {
  const kitDir = packageDir(projectDir, UI_KIT_PACKAGE);
  if (!kitDir) return [];

  const manifest = JSON.parse(fs.readFileSync(path.join(kitDir, "package.json"), "utf8"));
  const missing = Object.keys(manifest.peerDependencies ?? {}).filter(
    (peer) => !isHostProvided(peer) && !packageDir(projectDir, peer),
  );
  if (missing.length === 0) return [];

  const namesByPeer = peerImports(projectDir, kitDir, manifest);
  return missing.map((peer) => ({ peer, names: namesByPeer[peer] ?? [] }));
};

/**
 * What the kit imports from each of its peers, read from every module of its dist -- some
 * 1,240 files. That only changes with the installed kit, so it is kept in the project's
 * node_modules/.cache, keyed by the kit's version and the time its package.json was written:
 * a reinstall, or a repacked tarball that keeps the version, rewrites it and misses the cache.
 * @returns {Record<string, string[]>}
 */
const peerImports = (projectDir, kitDir, manifest) => {
  const cacheFile = path.join(projectDir, "node_modules", ".cache", "onlyoffice-plugin-preview", "peer-imports.json");
  const key = `${manifest.version}:${fs.statSync(path.join(kitDir, "package.json")).mtimeMs}:${kitDir}`;

  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (cached.key === key) return cached.peers;
  } catch {
    // No cache yet, or an unreadable one: read the kit.
  }

  const peers = Object.keys(manifest.peerDependencies ?? {});
  const namesByPeer = new Map(peers.map((peer) => [peer, new Set()]));
  for (const file of walkJavaScript(path.join(kitDir, "dist"))) {
    const source = fs.readFileSync(file, "utf8");
    for (const [, clause, specifier] of source.matchAll(IMPORT_FROM_RE)) {
      const peer = peers.find((name) => specifier === name || specifier.startsWith(`${name}/`));
      if (!peer) continue;
      for (const name of namedBindings(clause)) namesByPeer.get(peer).add(name);
    }
  }
  const result = Object.fromEntries([...namesByPeer].map(([peer, names]) => [peer, [...names].sort()]));

  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({ key, peers: result }));
  } catch {
    // A read-only node_modules only costs the next run the same scan.
  }
  return result;
};

export const peerStubFileName = (peer) => `${peer.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.js`;

export const peerStubSource = ({ peer, names }) => `// "${peer}" is a peer of ${UI_KIT_PACKAGE} that the portal supplies and a plugin project does
// not install. This stands in for it while the harness bundles the kit: a value that is callable,
// constructible and answers every property with itself, so the kit's module-scope code runs and
// only a component that really needs "${peer}" would misbehave.
const stub = new Proxy(function stub() {}, {
  get: (target, key) => (key === Symbol.toPrimitive ? () => "" : key === "then" ? undefined : stub),
  apply: () => stub,
  construct: () => stub,
});

export default stub;
${names.map((name) => `export const ${name} = stub;`).join("\n")}
`;

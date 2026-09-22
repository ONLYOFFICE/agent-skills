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

import { UI_KIT_PACKAGE } from "../contract.mjs";

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

const packageDir = (projectDir, packageName) => path.join(projectDir, "node_modules", ...packageName.split("/"));

/**
 * The kit's peers the project has not installed, each with the names the kit imports from it.
 * @returns {{ peer: string, names: string[] }[]}
 */
export const collectPeerStubs = (projectDir) => {
  const kitDir = packageDir(projectDir, UI_KIT_PACKAGE);
  const manifestPath = path.join(kitDir, "package.json");
  if (!fs.existsSync(manifestPath)) return [];

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const missing = Object.keys(manifest.peerDependencies ?? {}).filter(
    (peer) => !fs.existsSync(packageDir(projectDir, peer)),
  );
  if (missing.length === 0) return [];

  const namesByPeer = new Map(missing.map((peer) => [peer, new Set()]));

  for (const file of walkJavaScript(path.join(kitDir, "dist"))) {
    const source = fs.readFileSync(file, "utf8");
    for (const [, clause, specifier] of source.matchAll(IMPORT_FROM_RE)) {
      const peer = missing.find((name) => specifier === name || specifier.startsWith(`${name}/`));
      if (!peer) continue;
      for (const name of namedBindings(clause)) namesByPeer.get(peer).add(name);
    }
  }

  return missing.map((peer) => ({ peer, names: [...namesByPeer.get(peer)].sort() }));
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

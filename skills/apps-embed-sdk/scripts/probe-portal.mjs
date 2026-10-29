#!/usr/bin/env node
/**
 * Portal probe for Step 0 of the apps-embed-sdk skill. Network tool: it talks to the portal you
 * name, nothing else, and needs no credentials.
 *
 * Usage:
 *   node probe-portal.mjs https://portal.example.com [--origin https://app.example.com] [--json]
 *
 * What it establishes, in order:
 *   1. which SDK bundles the portal serves (/static/scripts/sdk/{v}/api.js) and whether the
 *      newest one carries the OAuth marker (getToken);
 *   2. the frame headers on /old-sdk/system, /sdk/room-selector and /sdk/chat —
 *      X-Frame-Options and Content-Security-Policy frame-ancestors — and, with --origin,
 *      whether your origin is allowed to embed them;
 *   3. whether OAuth discovery answers (/.well-known/openid-configuration);
 *   4. whether the CSP allow-list API answers anonymously (/api/2.0/security/csp).
 *
 * It ends with recommendations: npm or portal script, which modes the portal can serve,
 * what the portal admin has to change. Exit code 0 = probed, 2 = the portal URL is invalid
 * or unreachable. --json prints the raw findings instead of the report.
 */

const KNOWN_VERSIONS = ["2.2.0", "2.1.0", "2.0.0", "1.0.1"];
const NPM_VERSION = "2.2.0";
const FRAME_PATHS = ["/old-sdk/system", "/sdk/room-selector", "/sdk/chat"];
const TIMEOUT_MS = 8000;

const args = process.argv.slice(2);
const wantJson = args.includes("--json");
const originIdx = args.indexOf("--origin");
const hostOrigin = originIdx >= 0 ? normalizeOrigin(args[originIdx + 1]) : null;
const portalArg = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--origin");

if (!portalArg) {
  console.error("usage: node probe-portal.mjs <portal url> [--origin <host origin>] [--json]");
  process.exit(2);
}
const portal = normalizeOrigin(portalArg);
if (!portal) {
  console.error(`ERROR: "${portalArg}" is not an http(s) URL`);
  process.exit(2);
}

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    const u = new URL(value.includes("://") ? value : `https://${value}`);
    return /^https?:$/.test(u.protocol) ? u.origin : null;
  } catch {
    return null;
  }
}

async function request(url, { method = "GET", headers = {}, body = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, headers, redirect: "manual", signal: controller.signal });
    const text = body && res.ok ? await res.text() : "";
    return { ok: true, status: res.status, headers: res.headers, text, location: res.headers.get("location") };
  } catch (e) {
    return { ok: false, status: 0, error: e.name === "AbortError" ? `timeout after ${TIMEOUT_MS} ms` : e.message };
  } finally {
    clearTimeout(timer);
  }
}

function frameAncestors(csp) {
  if (!csp) return null;
  const directive = csp.split(";").map((d) => d.trim()).find((d) => d.toLowerCase().startsWith("frame-ancestors"));
  if (!directive) return null;
  return directive.split(/\s+/).slice(1);
}

function originAllowed(ancestors, origin) {
  if (!ancestors || !origin) return null;
  const host = new URL(origin).host;
  return ancestors.some((a) => {
    const v = a.replace(/^'|'$/g, "");
    if (v === "*") return true;
    if (v === "self") return false;
    if (v.startsWith("*.")) return host.endsWith(v.slice(1));
    try {
      const u = new URL(v.includes("://") ? v : `https://${v}`);
      return u.host === host;
    } catch {
      return v === host;
    }
  });
}

async function probe() {
  const findings = { portal, hostOrigin, bundles: {}, newest: null, oauthMarker: null, frames: {}, openid: null, cspApi: null };

  const reachable = await request(`${portal}/`, { method: "HEAD" });
  if (!reachable.ok) {
    console.error(`ERROR: ${portal} is unreachable: ${reachable.error}`);
    process.exit(2);
  }

  for (const v of KNOWN_VERSIONS) {
    const r = await request(`${portal}/static/scripts/sdk/${v}/api.js`, { body: findings.newest === null });
    findings.bundles[v] = r.ok ? r.status : `error: ${r.error}`;
    if (r.ok && r.status === 200 && findings.newest === null) {
      findings.newest = v;
      findings.oauthMarker = r.text.includes("getToken");
    }
  }

  for (const p of FRAME_PATHS) {
    const r = await request(`${portal}${p}`, { headers: { Accept: "text/html" } });
    const csp = r.ok ? r.headers.get("content-security-policy") : null;
    const ancestors = frameAncestors(csp);
    findings.frames[p] = r.ok
      ? {
          status: r.status,
          location: r.location,
          xFrameOptions: r.headers.get("x-frame-options"),
          frameAncestors: ancestors,
          hostOriginAllowed: originAllowed(ancestors, hostOrigin),
        }
      : { status: 0, error: r.error };
  }

  const oid = await request(`${portal}/.well-known/openid-configuration`, { body: true });
  if (oid.ok && oid.status === 200) {
    try {
      const j = JSON.parse(oid.text);
      findings.openid = { status: 200, issuer: j.issuer, authorization_endpoint: j.authorization_endpoint, token_endpoint: j.token_endpoint };
    } catch {
      findings.openid = { status: 200, parse: "not JSON" };
    }
  } else {
    findings.openid = { status: oid.ok ? oid.status : 0, error: oid.error };
  }

  const csp = await request(`${portal}/api/2.0/security/csp`, { body: true });
  if (csp.ok && csp.status === 200) {
    try {
      const j = JSON.parse(csp.text);
      findings.cspApi = { status: 200, domains: j.response?.domains ?? null, header: j.response?.header ?? null };
    } catch {
      findings.cspApi = { status: 200, parse: "not JSON" };
    }
  } else {
    findings.cspApi = { status: csp.ok ? csp.status : 0, error: csp.error };
  }

  return findings;
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function report(f) {
  const lines = [];
  const say = (s = "") => lines.push(s);

  say(`Portal: ${f.portal}`);
  say();
  say("SDK bundles (/static/scripts/sdk/{v}/api.js):");
  for (const [v, s] of Object.entries(f.bundles)) say(`  ${v}: ${s}`);
  if (!f.newest) {
    say("  → no known bundle answers 200. Either the URL is not an ONLYOFFICE Apps portal or a proxy hides /static. Stop here and ask the user.");
  } else {
    say(`  → portal SDK version: ${f.newest}${f.oauthMarker ? " (getToken present → OAuth mode available)" : " (no getToken marker → no OAuth mode)"}`);
  }
  say();
  say("Frame headers:");
  for (const [p, r] of Object.entries(f.frames)) {
    if (!r.status) {
      say(`  ${p}: unreachable (${r.error})`);
      continue;
    }
    const xfo = r.xFrameOptions ? `X-Frame-Options: ${r.xFrameOptions}` : "no X-Frame-Options";
    const fa = r.frameAncestors ? `frame-ancestors ${r.frameAncestors.join(" ")}` : "no frame-ancestors";
    say(`  ${p}: ${r.status}${r.location ? ` → ${r.location}` : ""}; ${xfo}; ${fa}`);
    if (f.hostOrigin && r.frameAncestors) {
      say(`    ${f.hostOrigin} ${r.hostOriginAllowed ? "is" : "is NOT"} in frame-ancestors`);
    }
  }
  say();
  say(`OAuth discovery (/.well-known/openid-configuration): ${f.openid.status || `unreachable (${f.openid.error})`}${f.openid.token_endpoint ? ` — token endpoint ${f.openid.token_endpoint}` : ""}`);
  say(`CSP allow-list API (/api/2.0/security/csp): ${f.cspApi.status || `unreachable (${f.cspApi.error})`}${f.cspApi.domains ? ` — domains: ${f.cspApi.domains.join(", ") || "(none)"}` : f.cspApi.status === 401 || f.cspApi.status === 403 ? " — needs an authenticated session or API key" : ""}`);
  say();
  say("Recommendations:");

  if (!f.newest) {
    say("  - No SDK bundle answered. If the user confirms this is an ONLYOFFICE Apps portal that is simply unreachable from here, load the portal script at runtime and try the known versions newest-first (2.2.0, 2.1.0, 2.0.0); keep npm for types only, use nothing that needs a version the portal may lack, and say in the report that the version was not verified.");
  }

  if (f.newest) {
    const cmp = compareVersions(NPM_VERSION, f.newest);
    if (cmp === 0) {
      say(`  - Connect via npm: @onlyoffice/docspace-sdk-js@^${NPM_VERSION} matches the portal. The portal script ${f.portal}/static/scripts/sdk/${f.newest}/api.js is the alternative for pages without a build step.`);
    } else if (cmp > 0) {
      say(`  - npm ${NPM_VERSION} is newer than the portal (${f.newest}): load the portal script ${f.portal}/static/scripts/sdk/${f.newest}/api.js at runtime and keep the npm package for TypeScript types only. Do not use modes or fields the portal lacks.`);
    } else {
      say(`  - The portal (${f.newest}) is newer than npm ${NPM_VERSION}: use the portal script, or upgrade the package.`);
    }
    const modes = compareVersions(f.newest, "2.2.0") >= 0
      ? "manager, editor, viewer, room-selector, file-selector, system, public-room, uploader, forms, chat, personal"
      : compareVersions(f.newest, "2.0.0") >= 0
        ? "manager, editor, viewer, room-selector, file-selector, system, public-room (no uploader, forms, chat, personal or OAuth before 2.2)"
        : "manager, editor, viewer, room-selector, file-selector, system (1.x)";
    say(`  - Modes this portal can serve: ${modes}.`);
    if (f.oauthMarker && f.openid.status === 200) {
      say("  - OAuth is available: prefer getToken over password hashes; it also sidesteps third-party-cookie blocking in cross-origin frames.");
    } else if (f.oauthMarker) {
      say("  - The SDK supports OAuth but discovery did not answer: ask the admin whether the identity service is enabled before designing an OAuth flow.");
    }
  }

  const frameIssues = Object.entries(f.frames).filter(([, r]) => r.status && r.xFrameOptions && !r.frameAncestors);
  if (frameIssues.length) {
    say(`  - ${frameIssues.map(([p]) => p).join(", ")}: X-Frame-Options without a frame-ancestors CSP header. Browsers will refuse to embed these pages regardless of the SDK allow-list — the portal's CSP settings are not reaching the response (empty allow-list, CSP cache, or a proxy stripping headers). Send this line to the portal admin.`);
  }
  if (f.hostOrigin) {
    const denied = Object.entries(f.frames).filter(([, r]) => r.frameAncestors && r.hostOriginAllowed === false);
    if (denied.length) {
      say(`  - Add ${f.hostOrigin} to the portal allow-list (Developer Tools → Embed SDK, or POST /api/2.0/security/csp): it is missing from frame-ancestors on ${denied.map(([p]) => p).join(", ")}.`);
    } else if (Object.values(f.frames).some((r) => r.hostOriginAllowed)) {
      say(`  - ${f.hostOrigin} is allow-listed; CSP is not the problem if the frame still fails — check the token table in SKILL.md (third-party cookies, 2FA).`);
    }
  } else {
    say("  - Re-run with --origin <your host origin> to check the allow-list for the page that will embed the frame.");
  }

  return lines.join("\n");
}

const findings = await probe();
if (wantJson) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  console.log(report(findings));
}

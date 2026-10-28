# ONLYOFFICE Apps Embed SDK skill

Teaches an AI coding agent to embed ONLYOFFICE Apps (formerly DocSpace) into a web
application with the Embed SDK (`@onlyoffice/docspace-sdk-js`, historically the "JavaScript
SDK"): a file manager, an editor or
viewer, a room or file selector, an uploader, the forms gallery, AI chat or a personal files
section — each an iframe configured by a `TFrameConfig` and driven through instance methods
and frame events.

**Ask for** things like "embed our DocSpace file manager in the CRM", "let a visitor fill a
form from a public room on our site", "log the user in to the frame without a second password
prompt", "the frame is blank in the Next.js page".

**What the agent does.** It asks for the portal URL and probes it — SDK version, frame
headers, CSP allow-list — then picks the connection and the mode, writes the config, the
sign-in flow and the event handlers from the references, validates the config offline and runs
the self-check protocol before handing over. The references hold what the SDK's types cannot
say: which of the five "tokens" does what, `sortBy: "Name"` renders an unsorted list, `login()`
resolves on a wrong password, a selector returns its room inside `items[0]`, a cross-origin frame
answers 401 with a live session, which portal builds let `login()` pass a second factor, React
StrictMode breaks the frame in development only.

## Install

Comes with the `onlyoffice-devtools` plugin — see [Install](../../README.md#install). On its own, copy
this directory to where your agent scans for skills (for example `~/.claude/skills/apps-embed-sdk/`),
or hand it `SKILL.md`.

## Scripts

```sh
node scripts/probe-portal.mjs https://portal.example.com --origin https://app.example.com   # what the portal serves, whether your origin may embed it
node scripts/validate-config.mjs '<TFrameConfig JSON>'                                       # one config against the SDK's types; exit 1 on errors
```

The probe reads the portal you name and nothing else; the validator is offline. What each
checks, and how they are kept in step with the SDK: [scripts/README.md](scripts/README.md).

## Targets

Embed SDK **2.2.0** from npm, or the portal's own script (`/static/scripts/sdk/{version}/api.js`)
for pages without a build step and for portals older than the package. Portal behaviour is
recorded against ONLYOFFICE Apps 4.0, with the places where an older portal differs marked.
Node 18 or newer.

## Read more

- [`SKILL.md`](SKILL.md) — the skill itself: pinned facts, the discovery step, the routing table
  into `references/`, the rules.
- [Embed SDK documentation](https://api.onlyoffice.com/docspace/javascript-sdk/get-started) — the
  pages the references link to.
- Changing the skill: [CONTRIBUTING.md](../../CONTRIBUTING.md); its evals: [evals/README.md](evals/README.md).

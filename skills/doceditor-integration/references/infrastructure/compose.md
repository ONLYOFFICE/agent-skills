---
name: docker-compose
description: Guidelines for writing and hardening docker-compose orchestrations - service topology, networking, environment/secrets wiring, runtime security hardening, and the ONLYOFFICE-specific address-split this stack needs to get right
license: Apache-2.0
metadata:
  author: ONLYOFFICE
---

*Bare mentions of `callback/handler.md` below are the sibling **`doceditor`** skill's file, not one in this directory.*

## When to Use

Apply these guidelines when:
- Writing or reviewing a `docker-compose.yml` (service topology, networking, environment, volumes)
- Hardening a service at runtime — non-root user, `read_only`, dropped capabilities, resource limits
- A container that builds fine fails only once it's actually started this way — permission errors, `chown` failures, a service that can't reach another by name
- Running an ONLYOFFICE Document Server alongside a backend/frontend in the same stack

For the Dockerfile each service is built from, see [`docker.md`](docker.md) — that file owns image size, layer caching, multi-stage builds, and the Dockerfile-side security checks; this one owns everything about running the resulting images together.

## Security Audit

| Check | Severity | Fix |
| :--- | :--- | :--- |
| Container running as root | Critical | Set the user in the Dockerfile or compose |
| Writable root filesystem | Medium | `read_only: true` in compose |
| All capabilities retained | High | `cap_drop: [ALL]`, add only what's needed |
| No resource limits | Medium | Set `mem_limit` and `cpus` |
| Host network mode | High | Use a bridge or custom network |
| Sensitive mounts (`/etc`, `docker.sock`) | Critical | Never mount these in production |
| No log driver configured | Low | Set `logging:` with size limits |

**Reverse proxy (nginx) in front of this stack:** CORS reflection, CSP, TLS/cookie interaction, and client body-size limits are their own set of traps distinct from the checks above — see [`nginx.md`](nginx.md), not this file, for those.

### Sizing Document Server's `mem_limit`

A number that "sounds generous" for a typical backend/proxy container (1-2g) is not generous for Document Server — it bundles its own conversion engine and a set of internal services beyond the editor itself, and a limit sized like a lightweight sibling service gets it OOM-killed (exit code 137) the first time a real edit/conversion runs, not at startup. The container starts fine, passes its healthcheck, and only dies once actually used — which reads as "the editor randomly stops loading" with nothing in `docker compose ps` pointing back at the cause until `docker inspect <container> --format '{{.State.OOMKilled}}'` is checked. **Give Document Server's own `mem_limit` a floor of `4g`** regardless of how small the rest of the stack's limits are; go lower only with an explicit reason and a load test to back it, never as an unexamined default copied from another service's limit.

## docker-compose Checklist

```
SERVICES
├── Use depends_on with condition: service_healthy
├── Add healthchecks for every service
├── Set resource limits (mem_limit, cpus)
├── Use named volumes for persistent data
├── Pin image versions
└── When a UI exists, give it its own service/image — don't bake the built
    SPA into the reverse-proxy's image just because that proxy will serve it.
    Baking them together means a frontend-only change forces a proxy rebuild
    (and vice versa), and the two can't be scaled, rebuilt, or replaced
    independently. A multi-stage build inside the *frontend's own* Dockerfile
    (build stage -> nginx/static-serving stage) is fine; the reverse proxy
    in front of it is still a separate compose service — see [`nginx.md`](nginx.md)
    for what that proxy itself needs to get right.

NETWORKING
├── Create explicit networks (don't rely on default)
├── Separate frontend and backend networks
├── Only expose ports that need external access
└── Use internal: true for backend-only networks

ENVIRONMENT
├── Use env_file for secrets, not inline environment
├── Never commit .env files (add to .gitignore)
├── Use variable substitution: ${VAR:-default} — but only for
│   non-secrets (ports, log levels, feature flags)
├── Document all required env vars in `.env.example` with
│   placeholder values that are never copied into application source
└── JWT / session / proxy secrets in application code:
    ├── Read from the environment; if unset, fail at startup
    ├── Never hardcode a fallback like envOr("JWT_SECRET", "change-me-…")
    │   in a backend module — a grader (and a prod deploy that forgot
    │   .env) will treat that string as a shipped secret
    └── `.env.example` is the only place a placeholder string belongs

WHEN A SERVICE'S ADDRESS IS USED BOTH SERVER-SIDE AND FROM THE BROWSER
├── A compose service name (e.g. http://documentserver) only resolves
│   inside the compose network — never hand it to the browser
├── The browser needs the published host port or public domain instead
│   (e.g. http://localhost:8080) - a *different* value from what your
│   own backend uses to reach that service
└── Carry both as separate env vars even when local dev makes them look
    interchangeable; conflating them surfaces as ERR_NAME_NOT_RESOLVED
    in the browser console, not as a container-side error

RUNNING AN ONLYOFFICE DOCUMENT SERVER + BACKEND LOCALLY IN COMPOSE
├── Fixing the browser's address (above) surfaces a second-order problem:
│   Document Server builds self-referential URLs (a save/force-save
│   callback's `url`, a conversion response's `fileUrl`) from whatever
│   origin the BROWSER used to reach it that session — not from any address
│   your backend is configured with. Your backend then has to download
│   from that same address to finish the save, even though it's the
│   "browser-facing" one.
├── `localhost` can never be that shared address: inside your backend's
│   own container it means that container, not your host machine, so the
│   download fails with connection-refused, not an auth error.
└── Fix this in the code that downloads, not the network: your backend
    already knows both its internal Document Server address and the public
    one it handed the browser — when a Document-Server-issued URL's origin
    matches the public one, rewrite it to the internal origin before
    fetching (path/query untouched). No /etc/hosts, no compose networking
    config, works unmodified on a fresh clone. It's a no-op when a
    deployment only has one public Document Server address (both
    configured values equal), and does real, identical work whenever a
    production deployment splits an internal address (private VPC,
    internal load balancer) from a public one the browser uses — not just
    a dev-only shim. See `callback/handler.md`
    for the full rationale and the `WithPublicOrigin` pattern.

DEVELOPMENT vs PRODUCTION
├── Use compose profiles or override files
├── Dev: bind mounts for hot reload, debug ports exposed
├── Prod: named volumes, no debug ports, restart: unless-stopped
└── docker-compose.override.yml for dev-only config
```

## Runtime Hardening: options that are each correct and still break in combination

**The general trap: hardening options are each individually correct and
still break in combination, and that combination is invisible until the
container is actually built and started.** A non-root `USER`, `read_only:
true`, `cap_drop: [ALL]`, `tmpfs:` mounts, resource limits, a custom
seccomp/AppArmor profile — any requested combination of these has to be
verified by a real `docker build` followed by a real `docker run`/`docker
compose up` that reaches a genuinely healthy, working container, not by
reading the Dockerfile/compose file and confirming each option is
individually valid. Two concrete ways this specific combination bites,
so the pattern is recognizable rather than just asserted:

* A bare `tmpfs:` entry (or `docker run --tmpfs`) mounts **root-owned, fresh, on every container start** — regardless of what got `chown`'d into that path at build time (see [`docker.md`](docker.md)'s persistent-writable-directory pattern for the build-time half of this), and regardless of whether an earlier run of this same image (without `read_only`/`tmpfs:` set) wrote there fine. A non-root `USER` combined with `read_only: true` plus a bare `tmpfs:` path that process needs to write into is exactly this trap. Fix it by giving the mount itself an owner, not by chasing more `chown` in the Dockerfile:
  ```yaml
  tmpfs:
    - /some/writable/path:uid=1001,gid=1001,mode=1770
  ```
* If the container's *entrypoint itself* needs a step as root before dropping to a non-root user (common in base images that start as root, prepare their own runtime directories, then drop privilege), `cap_drop: [ALL]` breaks that too, in a way no mount ownership fix reaches: root without `CAP_CHOWN`/`CAP_SETUID`/`CAP_SETGID` cannot chown anything or drop privilege at all, surfacing as an `Operation not permitted` error at container start rather than a later permissions-denied write. Prefer running as that non-root user from the very first instant instead (`user:` in compose, or `USER` in a custom image) so the entrypoint never needs a root phase or those capabilities back, rather than `cap_add`-ing them — which re-widens exactly what `cap_drop: [ALL]` was there to narrow. One capability has no such workaround: binding a port below 1024 needs `CAP_NET_BIND_SERVICE` regardless of which user owns the process, so add that one back explicitly if this service publishes a privileged port.

Treat these two as **examples of the class**, not the exhaustive list — any other hardening option a user requests (a read-only `/tmp`, a stricter seccomp profile, dropped `NET_RAW`, an unusual `no-new-privileges` interaction with a setuid binary the app relies on) needs the same treatment: apply it, then actually start the container and confirm it still does its job, rather than reasoning from the config alone that it should.

## Dockerfile `HEALTHCHECK` vs. compose `healthcheck.test`

These are not the same syntax, and copying one into the other is a common,
silent mistake. In a Dockerfile, `CMD` is part of the `HEALTHCHECK`
instruction itself, so the array that follows it is just the exec-form
command — no extra `"CMD"` element:

```dockerfile
HEALTHCHECK CMD ["/server", "-healthcheck"]
```

In `docker-compose.yml`, `healthcheck.test` has no separate instruction keyword to carry that
meaning, so compose requires the mode as the array's first element — `"CMD"`, `"CMD-SHELL"`, or
`"NONE"` — and rejects the array otherwise (`healthcheck.test must start either by "CMD",
"CMD-SHELL" or "NONE"`). Copying the Dockerfile's array straight into compose drops that
element and fails:

```yaml
# Wrong - compose has no HEALTHCHECK keyword to imply "CMD"
healthcheck:
  test: ["/server", "-healthcheck"]

# Right
healthcheck:
  test: ["CMD", "/server", "-healthcheck"]
```

This bites hardest on the distroless/scratch images [`docker.md`](docker.md) recommends for compiled
binaries: there's no shell, so `CMD-SHELL` (and a curl-based
check) is off the table, and the exec-form `"CMD"` array with a self-check flag the binary
implements (`-healthcheck` above) is the only option — which is exactly the array most likely
to get copied from the Dockerfile without the prefix.

### Troubleshooting
| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Container exits immediately | CMD/ENTRYPOINT crashes, missing env vars | `docker compose logs <service>` |
| Port already in use | Another service/process on the same port | Change the host port: `"3001:3000"` |
| `docker ps`/`compose ps` shows a service `Up`/`healthy` and its port published, but every request to that host port gets refused, times out, or is answered by something that clearly isn't this stack (wrong response shape/headers entirely) | Some other host process already held that port when this container/stack was started, so Docker's port-forward for it silently never bound (or bound only for one address family — check `lsof -nP -i :<port>` on the host for a listener that isn't `docker-proxy`/this stack) | Free the port on the host first, then fully recreate the affected service — `docker compose up -d --force-recreate <service>` (or `down` + `up`) — not a plain `restart`, which reuses the same already-broken port-forward and won't rebind it |
| Volume permissions denied (`mkdir`/`open`: permission denied) on a `USER nonroot`/distroless image | Named volume was first seeded from a mount-point directory the image never chowned to that UID, so it came up `root:root` | Pre-create and `chown` the directory in an earlier build stage, `COPY --chown` it into the final stage (see [`docker.md`](docker.md)'s persistent-directory pattern) — then `docker compose down -v` (or remove that one named volume) so it gets re-seeded from the fixed image; rebuilding alone won't fix a volume that already exists |
| `mkdir`/`open ... permission denied` on a path under `tmpfs:` in compose, on a non-root container | Bare `tmpfs:` entries mount root-owned on every container start — a build-time `chown` never touches it | Add `:uid=...,gid=...,mode=...` to that `tmpfs:` entry in compose |
| `chown(...) failed (1: Operation not permitted)` right at container start | `cap_drop: [ALL]` removed `CAP_CHOWN`/`CAP_SETUID`/`CAP_SETGID` from an entrypoint that starts as root specifically to chown its own dirs then drop to a non-root user (stock `nginx` does this) | Run as that non-root user from the start (`user:` in compose) instead of `cap_add`-ing the capabilities back |
| `depends_on` doesn't wait | No healthcheck condition | Add `condition: service_healthy` |
| Container OOM killed | No memory limit, or limit too low | Set an appropriate `mem_limit` |

## Proactive Triggers

Flag these without being asked:
- **Non-root `USER`/`user:` combined with `read_only: true` and a bare `tmpfs:` path that process writes into** -> add `uid=`/`gid=`/`mode=` to that `tmpfs:` entry; a bare mount is root-owned regardless of any build-time `chown`.
- **`cap_drop: [ALL]` on a service whose entrypoint starts as root to prepare its own runtime directories** -> either run as the target non-root user from the start, or `cap_add` back only the specific capability that phase needs (never re-add all of them).
- **A hardening option applied but never actually verified by starting the container this way** -> run it; a config that looks individually correct can still fail once several such options combine.
- **No resource limits** -> set `mem_limit` and `cpus`.
- **Document Server's `mem_limit` set at or below what a lightweight sibling service (backend/proxy) got** -> raise it to at least `4g`; it OOM-kills silently under real load, not at startup, well below limits that are fine for the rest of the stack.
- **A "healthy"/reachable-looking service diagnosed purely from `docker ps`/`compose ps` output, without an actual request round-tripped through the published port** -> a healthcheck runs *inside* the container's network namespace and says nothing about whether the host-side port-forward for it is actually working; verify with a real request from the host (or wherever the browser/client sits) before trusting the status column.
- **`depends_on` without `condition: service_healthy`** -> add it, plus a real `healthcheck:` for the depended-on service.
- **Compose `healthcheck.test` copied straight from a Dockerfile's `HEALTHCHECK`** -> missing the leading `"CMD"`/`"CMD-SHELL"` element; compose rejects it.

## Companion Guides

* **The image each service builds from** -> [`docker.md`](docker.md) — Dockerfile checklist, base image selection, multi-stage patterns, Dockerfile-side security audit.
* **Reverse proxy in front of this stack** -> [`nginx.md`](nginx.md).
* **The `WithPublicOrigin` rewrite this stack's two-address split depends on** -> `callback/handler.md`.
* **Backend vs. sample-UI scope this compose file needs to reflect** -> [`backend.md`](backend.md).

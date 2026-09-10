---
name: docker
description: Guidelines for writing Dockerfiles and docker-compose configs - image size, layer caching, multi-stage builds, and container security
license: Apache-2.0
metadata:
  author: ONLYOFFICE
---

## When to Use

Apply these guidelines when:
- Writing or reviewing a `Dockerfile`
- Writing or reviewing a `docker-compose.yml`
- The Makefile's `docker` recipe needs an image to actually build (see [`makefile.md`](makefile.md))
- Image size, build speed, or container security come up

## Dockerfile Checklist

```
BASE IMAGE
├── Use specific tags, never :latest in production
├── Prefer slim/alpine/distroless variants over the full image
├── Pin digest for reproducibility in CI: image@sha256:...
└── Match base to runtime needs (don't use python:3.12 for a compiled binary)

LAYER OPTIMIZATION
├── Combine related RUN commands with && \
├── Order layers: least-changing first (deps before source code)
├── Clean package manager cache in the same RUN layer
├── Use .dockerignore to exclude unnecessary files
└── Separate build deps from runtime deps

BUILD CACHE
├── COPY dependency files before source code (package.json, requirements.txt, go.mod)
├── Install deps in a separate layer from the source copy
├── Use BuildKit cache mounts: --mount=type=cache,target=/root/.cache
└── Avoid COPY . . before dependency installation

MULTI-STAGE BUILDS
├── Stage 1: build (full SDK, build tools, dev deps)
├── Stage 2: runtime (minimal base, only production artifacts)
├── COPY --from=builder only what's needed
└── Final image should have NO build tools, NO source code, NO dev deps
```

## Base Image Decision Tree

```
Is it a compiled binary (Go, Rust, C)?
├── Yes -> distroless/static or scratch
└── No
    ├── Need a shell for debugging?
    │   ├── Yes -> alpine variant (e.g., node:20-alpine)
    │   └── No -> distroless variant
    ├── Need glibc (not musl)?
    │   ├── Yes -> slim variant (e.g., python:3.12-slim)
    │   └── No -> alpine variant
    └── Need specific OS packages?
        ├── Many -> debian-slim
        └── Few -> alpine + apk add
```

| Base | Approx. size | Use case |
| :--- | :--- | :--- |
| `scratch` | 0MB | Static binaries (Go, Rust) |
| `distroless/static` | 2MB | Static binaries with CA certs |
| `alpine` | 7MB | Minimal Linux, shell access |
| `distroless/base` | 20MB | Dynamic binaries (C/C++) |
| `debian-slim` | 80MB | Need glibc + apt |
| `python:3.12-slim` | 130MB | Python apps (production) |
| `node:20-alpine` | 130MB | Node.js apps |
| `golang:1.22` | 800MB | Go **build stage only** - never ship it |
| `python:3.12` / `node:20` | 900MB+ | Never use these in production |

## Multi-Stage Build Patterns

### Compiled language (Go, Rust, C++)
```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app/server ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/server /server
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

### Compiled language with a persistent writable directory

The moment the app needs somewhere to write at runtime (uploaded files, a
cache, a database file), the pattern above isn't enough — `distroless` has no
shell, so there's no later stage where you could `mkdir`/`chown` as root. Do
it in the builder stage, which has coreutils, and `COPY --chown` the
already-owned directory across:

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app/server ./cmd/server

# distroless:nonroot's user is UID/GID 65532. Create the writable dir here,
# owned by that UID, so it can be copied into the final stage already
# correct — the final stage can't chown it itself (no shell, no root RUN).
RUN mkdir -p /app/data && chown -R 65532:65532 /app/data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app/server /server
COPY --from=builder --chown=nonroot:nonroot /app/data /data
VOLUME ["/data"]
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

Why this matters even with `--chown`, a bind mount, or a named volume in
compose: when a **named volume** is empty and gets attached for the first
time, Docker seeds it by copying the image's content *and ownership* from
that mount path. If the image never gave that path an owner (a bare
`VOLUME` line, or a directory that only ever got created implicitly),
Docker creates it as `root:root` — and a `USER nonroot` process can never
write into it, no matter how the compose file mounts it. This is invisible
at `docker build` time; it only surfaces at runtime, as `mkdir: permission
denied` on first write, and it repeats on every restart until the volume
itself is recreated (`docker compose down -v`, or removing the named
volume) — rebuilding the image alone does not fix an already-seeded volume.

### Node.js / TypeScript
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false

FROM deps AS builder
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Python
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
COPY --from=builder /install /usr/local
COPY . .
USER appuser
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Secrets, Cache Mounts, Health Checks

```dockerfile
# Secrets: never bake into a layer, never use plain ENV/ARG
RUN --mount=type=secret,id=api_key \
    export API_KEY=$(cat /run/secrets/api_key) && \
    ./configure --api-key=$API_KEY
# docker build --secret id=api_key,src=./api_key.txt .

# Cache mounts: persist package-manager downloads across builds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Health check: orchestrators need this for lifecycle management
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
```

## Security Audit

### Dockerfile
| Check | Severity | Fix |
| :--- | :--- | :--- |
| Running as root | Critical | Add `USER nonroot` after creating the user |
| Using `:latest` | High | Pin to a specific version |
| Secrets in `ENV`/`ARG` | Critical | Use BuildKit secret mounts (`--mount=type=secret`) |
| `COPY` with a broad glob | Medium | Use specific paths, add `.dockerignore` |
| Unnecessary `EXPOSE` | Low | Only expose ports the app uses |
| No `HEALTHCHECK` | Medium | Add one with an appropriate interval |
| Privileged instructions | High | Avoid `--privileged`, drop capabilities |
| Package manager cache retained | Low | Clean in the same `RUN` layer |

### Runtime / compose
| Check | Severity | Fix |
| :--- | :--- | :--- |
| Container running as root | Critical | Set the user in the Dockerfile or compose |
| Writable root filesystem | Medium | `read_only: true` in compose |
| All capabilities retained | High | `cap_drop: [ALL]`, add only what's needed |
| No resource limits | Medium | Set `mem_limit` and `cpus` |
| Host network mode | High | Use a bridge or custom network |
| Sensitive mounts (`/etc`, `docker.sock`) | Critical | Never mount these in production |
| No log driver configured | Low | Set `logging:` with size limits |

## docker-compose Checklist

```
SERVICES
├── Use depends_on with condition: service_healthy
├── Add healthchecks for every service
├── Set resource limits (mem_limit, cpus)
├── Use named volumes for persistent data
└── Pin image versions

NETWORKING
├── Create explicit networks (don't rely on default)
├── Separate frontend and backend networks
├── Only expose ports that need external access
└── Use internal: true for backend-only networks

ENVIRONMENT
├── Use env_file for secrets, not inline environment
├── Never commit .env files (add to .gitignore)
├── Use variable substitution: ${VAR:-default}
└── Document all required env vars

DEVELOPMENT vs PRODUCTION
├── Use compose profiles or override files
├── Dev: bind mounts for hot reload, debug ports exposed
├── Prod: named volumes, no debug ports, restart: unless-stopped
└── docker-compose.override.yml for dev-only config
```

### Troubleshooting
| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Container exits immediately | CMD/ENTRYPOINT crashes, missing env vars | `docker compose logs <service>` |
| Port already in use | Another service/process on the same port | Change the host port: `"3001:3000"` |
| Volume permissions denied (`mkdir`/`open`: permission denied) on a `USER nonroot`/distroless image | Named volume was first seeded from a mount-point directory the image never chowned to that UID, so it came up `root:root` | Pre-create and `chown` the directory in an earlier build stage, `COPY --chown` it into the final stage (see the persistent-directory pattern above) — then `docker compose down -v` (or remove that one named volume) so it gets re-seeded from the fixed image; rebuilding alone won't fix a volume that already exists |
| Build cache not working | `COPY . .` invalidates cache too early | Copy deps first, then source |
| `depends_on` doesn't wait | No healthcheck condition | Add `condition: service_healthy` |
| Container OOM killed | No memory limit, or limit too low | Set an appropriate `mem_limit` |

## Proactive Triggers

Flag these without being asked:
- **`:latest` tag** -> pin to a specific version.
- **No `.dockerignore`** -> create one; at minimum `.git`, `node_modules`, `__pycache__`, `.env`.
- **`COPY . .` before dependency install** -> cache bust; reorder to install deps first.
- **Running as root** -> add a `USER` instruction. No exceptions for production.
- **Secrets in `ENV`/`ARG`** -> use BuildKit secret mounts instead.
- **Image over 1GB** -> needs a multi-stage build; no production image should be this large.
- **No healthcheck** -> add one.
- **`apt-get` without cleanup in the same layer** -> `rm -rf /var/lib/apt/lists/*` in the same `RUN`.
- **`VOLUME`/persistent data dir combined with `USER nonroot`, and the final stage has no shell** (distroless, `scratch`) -> the directory must be created and `chown`'d in a stage that has a shell, then `COPY --chown`'d into the final stage before the `VOLUME` line. A bare `VOLUME ["/app/data"]` with no prior ownership leaves that path `root:root` the first time a named volume seeds from it, and the app can never write to it.
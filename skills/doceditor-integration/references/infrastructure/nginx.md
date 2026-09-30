---
name: nginx
description: Guidelines for configuring Nginx as a reverse proxy in front of a generated web app - TLS termination, CORS, CSP, WebSocket/upgrade handling, client body limits, and the ONLYOFFICE-specific proxying gotchas that don't show up until the editor is actually loaded through it
license: Apache-2.0
metadata:
  author: ONLYOFFICE
---

# Nginx Reverse Proxy Guidelines

*Bare mentions of `api.md` and `callback/handler.md` below are the sibling **`doceditor`** skill's files, not ones in this directory.*

## When to Use

Apply when writing or reviewing an `nginx.conf`/server block that:
- terminates TLS and/or fronts a docker-compose stack as the only publicly exposed service (see [`compose.md`](compose.md)'s docker-compose checklist for the service-topology rule this assumes),
- reverse-proxies to an app backend and/or a static frontend build,
- proxies to an ONLYOFFICE Document Server container so the browser only ever talks to one origin.

## Core Reverse-Proxy Checklist

```
ROUTING
├── One location block per concern (static assets, /api/, Document Server) -
│   don't let one broad regex silently swallow a route meant for another
├── Preserve Host / X-Forwarded-For / X-Forwarded-Proto so upstream apps see
│   the real client address and scheme, not this proxy's
├── proxy_pass trailing slash matters: a trailing "/" on proxy_pass strips
│   the matched location prefix before forwarding; omitting it forwards the
│   full original path - pick deliberately, don't copy one from an unrelated
│   example and assume it's equivalent
└── Set proxy_read_timeout/proxy_send_timeout above the slowest real
    operation behind this proxy (a large-file conversion, not just a
    typical API call) - the default is tuned for neither

SECURITY HEADERS
├── Content-Security-Policy - see CSP section below for the ONLYOFFICE-
│   specific frame-src trap
├── X-Content-Type-Options: nosniff, Referrer-Policy: same-origin (or
│   stricter), Strict-Transport-Security once TLS is actually terminated
└── Don't set X-Frame-Options/frame-ancestors to deny-everything on a page
    that itself embeds the ONLYOFFICE editor iframe - see CSP below
```

## CORS: never reflect the origin unconditionally

Setting `Access-Control-Allow-Origin: $http_origin` (reflecting whatever `Origin` header the request happens to carry) is a common way to get CORS "working" during development, and it's a real vulnerability the moment `Access-Control-Allow-Credentials: true` sits next to it - that combination lets **any** site make authenticated, cookie-bearing requests against the API on a logged-in user's behalf:

```nginx
# Wrong - any origin gets a credentialed CORS pass
add_header Access-Control-Allow-Origin $http_origin always;
add_header Access-Control-Allow-Credentials "true" always;
```

Validate against an explicit allowlist instead - a `map` block keeps this out of every `location`:

```nginx
map $http_origin $cors_origin {
    default "";
    "~^https://app\.example\.com$" $http_origin;
    "~^https://staging\.example\.com$" $http_origin;
}

server {
    location /api/ {
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Credentials "true" always;
        # ... proxy_pass, OPTIONS preflight handling, etc.
    }
}
```

If a backend framework already sets its own CORS headers (Express `cors()`, a Servant/Haskell CORS middleware, ...), decide **once** which layer owns it - nginx or the app - and don't set it in both, since two conflicting `Access-Control-Allow-Origin` headers on the same response is itself a bug and one of them silently overriding the other is not "defense in depth."

## CSP: the editor iframe needs an explicit `frame-src`

A strict `default-src 'self'` Content-Security-Policy silently blocks the ONLYOFFICE editor from ever rendering, because `api.md`'s `DocsAPI.DocEditor` replaces the placeholder with an iframe pointed at the Document Server origin. That origin has to be named:

```nginx
add_header Content-Security-Policy "default-src 'self'; frame-src 'self' https://your-documentserver-public-origin; script-src 'self' https://your-documentserver-public-origin; connect-src 'self' https://your-documentserver-public-origin wss://your-documentserver-public-origin;" always;
```

`connect-src` needs the `wss://` (or `ws://` in local dev) form too, not just `https://` - the editor's real-time co-authoring channel is a WebSocket to that same origin, and a CSP that only allows the `https://` scheme blocks it without ever blocking the initial page load, so the failure only shows up once two users try to co-edit.

### This CSP also blocks every inline style in the app's own pages - not just Document Server's

The header above sets no `style-src` at all, so it falls back to `default-src 'self'`, which forbids *any* inline styling on the app's own pages: a `style="..."` attribute in generated HTML, a `<style>` block, and (in browsers that enforce `style-src-attr`) even a script doing `el.setAttribute('style', ...)`. The browser drops each one silently and logs a CSP violation to the console - there's no server-side error, no failed network request, nothing in `docker compose logs`. What ships instead is an element that looks completely unstyled (default browser chrome: no border, no padding, no background), which reads exactly like "the CSS for this one control is just wrong" rather than "this control's styling was never allowed to apply at all." This is easy to introduce one-off, late in a session, on exactly the kind of small control that gets hand-styled inline instead of given a class - a form input, a status badge, a placeholder width - while every earlier, properly-classed component looks fine.

**Never emit a `style="..."` attribute (or a `<style>` block, or JS that sets one) anywhere in generated markup or scripts, regardless of framework or target language** - every visual property, including one-off inline-looking tweaks like `margin-left: auto` on a single badge, belongs in the external stylesheet as a real class. Setting `element.style.someProperty = value` from JavaScript (as opposed to `setAttribute('style', ...)` with a full string) is the one exception that isn't restricted by `style-src` in any current browser, and is fine for things like a computed progress-bar width. If a concrete request truly requires inline styles (a body pasted from an external, untrusted source, e.g.), that has to come with an explicit, deliberate `style-src` addition to this header (a nonce or hash - never bare `'unsafe-inline'`, which reopens the exact class of injection this CSP exists to close) and a comment explaining why, not a silent gap left in the policy.

## TLS termination and `Secure` cookies

A session/auth cookie marked `Secure` is silently dropped by the browser over plain HTTP - this isn't defense in depth, it's a login that quietly never persists outside `localhost`. If any upstream service sets a `Secure` cookie, TLS has to terminate *somewhere* in this stack (even a self-signed cert generated on first boot for local dev) before that cookie reaches a real client. Don't mark a cookie `Secure` in the backend until something in front of it actually terminates TLS.

## `client_max_body_size`

The default (1MB) rejects realistic office documents outright with a `413` before the request even reaches the app. Size this above the largest file the integration is expected to accept - the upload route and, if conversion is proxied through here, the conversion request's own body - and keep it in an env-substituted value rather than a hardcoded number so it can be raised without editing the config file.

## Proxying the ONLYOFFICE Document Server

**Default to giving Document Server its own origin - a dedicated published port on this same proxy is enough; it doesn't need a separate domain.** A sub-path mount (`/docserver/` on the app's own origin) looks appealing because it lets the CSP below stay at a plain `'self'` with no second origin to name, but Document Server generates some of its own URLs **server-side**, with no awareness of any path prefix it might be mounted under - concretely, the co-editing changes-log cache link (`/cache/files/.../Editor.bin`, handed to the editor's own client-side SDK over the editing WebSocket mid-session) comes back rooted at whatever bare `Host` header this proxy forwarded, never prefixed with `/docserver`. There is no request header that communicates "you're also mounted under this path" for Document Server to honor even if you wanted it to. The result is not a proxying error you'll see in this server's logs at all - the editor loads, opens, and looks completely normal, and then silently fails with a **CSP violation in the browser console** partway through a live session (blocked as a cross-origin script load, since the generated link doesn't match this origin), which reads exactly like "the editor randomly breaks sometimes" with nothing pointing back at the proxy config as the cause. A sub-path mount is not inherently broken for *every* Document Server feature - plain open/edit/save works fine, since those URLs are all client-supplied - but it is fragile in a way that only surfaces once a feature exercises one of Document Server's own self-referential links, so treat "sub-path mount, tested by opening a document once" as unverified, not as passing.

```nginx
# Recommended: Document Server gets its own server block / published port,
# proxied at root with no rewrite - it can never generate a self-referential
# URL your CSP or your routing doesn't already expect.
server {
    listen 8082;
    location / {
        proxy_pass http://documentserver;
        proxy_set_header Host $http_host;  # not $host - Document Server needs the port too
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_http_version 1.1;
    }
}
```

If a sub-path mount is genuinely required (e.g. only one port can be published), the checklist below still applies, but budget time to test every feature that produces a Document-Server-issued link — version history's diff view is one confirmed example - not just the initial open.

* **Rewrite the path correctly** - `proxy_pass` to the container's root with the subpath stripped (`rewrite ^/docserver/(.*)$ /$1 break;` ahead of `proxy_pass http://documentserver;`), and make sure every asset/script/API path the editor's own JS requests resolves back through the same subpath, not a bare root reference.
* **Pass WebSocket upgrade headers** - `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection "upgrade";` on the location(s) that proxy to Document Server. Without these, the editor still loads and looks fine, but real-time co-authoring's socket connection fails silently - the single most common "it works alone but breaks for two users" symptom in a proxied setup.
* **Mind the two-address split** - the browser needs to resolve and reach this proxy's own public address for the Document Server origin (script tag, iframe, WebSocket), while the app's *backend* talks to Document Server over whatever internal address the compose network provides. Conflating them is the `ERR_NAME_NOT_RESOLVED` / `DocsAPI is not defined` failure `api.md`'s Bootstrap section describes, and the mirror-image problem on the callback side is `callback/handler.md`'s `url`-rewrite section. This proxy is usually where the "public" address in that split terminates.

## Docker/Compose Placement

This proxy is its own compose service - see [`compose.md`](compose.md)'s SERVICES checklist for why a frontend's static build shouldn't be baked into this same image, and its Security Audit table for the container-level checks (non-root user, no `:latest`, resource limits) that apply to this service like any other.
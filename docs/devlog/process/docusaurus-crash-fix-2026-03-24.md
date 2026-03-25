# Docusaurus Site Crash Fix — 2026-03-24

## Problem

The Docusaurus user manual at `https://parthenon.acumenus.net/docs/blog/` (and all `/docs/*` routes) returned **HTTP 500** persistently. The nginx error log showed:

```
rewrite or internal redirection cycle while internally redirecting to "/docs/index.html"
```

## Root Cause

Three interrelated bugs in the docs serving pipeline:

### 1. Wrong volume mount (primary)

`docker-compose.yml` mounted `./docs/dist` into the nginx container, but that directory was nearly empty (contained only a `__server` stub). The actual Docusaurus build output lives at `./docs/site/build/`.

```yaml
# Before (broken)
- ./docs/dist:/var/www/docs-dist:ro

# After (fixed)
- ./docs/site/build:/var/www/docs-dist:ro
```

### 2. nginx alias + try_files redirect loop

In `docker/nginx/default.conf.template`, the `/docs/` location block used `alias` with a `try_files` fallback of `/docs/index.html`. When nginx uses `alias`, it strips the location prefix and prepends the alias path. The fallback `/docs/index.html` caused nginx to look for `/var/www/docs-dist/docs/index.html` — a double-nested path that doesn't exist — triggering an infinite internal redirect.

```nginx
# Before (broken)
location /docs/ {
    alias /var/www/docs-dist/;
    try_files $uri $uri/ /docs/index.html;
}

# After (fixed)
location /docs/ {
    alias /var/www/docs-dist/;
    try_files $uri $uri/ /index.html;
}
```

The same bug existed in the OHIF viewer block and was fixed there too.

### 3. deploy.sh built to wrong path

`deploy.sh` ran the `docs-build` Docker service which output to `./docs/dist/` (via the `build:docker` script with `--out-dir /dist`). This diverged from where nginx read. The `docs-build` service volume was updated to output to `./docs/site/build/` instead.

## Files Changed

| File | Change |
|------|--------|
| `docker-compose.yml` | nginx volume: `docs/dist` → `docs/site/build`; docs-build volume: same |
| `docker/nginx/default.conf.template` | `try_files` fallback: `/docs/index.html` → `/index.html` (docs + OHIF) |
| `deploy.sh` | `mkdir` and success message updated to `docs/site/build` |
| `.gitignore` | Removed stale `docs/dist/*` entries |

## Verification

```
curl -s -o /dev/null -w "%{http_code}" https://parthenon.acumenus.net/docs/blog/
# 200
```

## Lesson

When using nginx `alias` directive, `try_files` fallback paths are resolved relative to the alias target, not the original location. Using `/docs/index.html` as fallback with `alias /var/www/docs-dist/` makes nginx look for `/var/www/docs-dist/docs/index.html` — always use `/index.html` (without the location prefix) in aliased blocks.

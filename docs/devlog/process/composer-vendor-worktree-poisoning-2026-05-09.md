# Composer Vendor Worktree Poisoning — Prod Outage

**Date:** 2026-05-09
**Scope:** Production outage post-mortem + `deploy.sh` defensive guard
**Severity:** Total API outage (every authenticated endpoint 500'd)
**Time to detect:** Hours (silent until user hit `/workbench/care-bundles/measures`)
**Time to fix:** ~5 minutes after diagnosis

## Symptom

User reported the `/workbench/care-bundles/measures` page crashing with:

```
Unexpected Application Error!
a.map is not a function
TypeError: a.map is not a function
    at https://parthenon.acumenus.net/assets/index-DLSGx_Jp.js:2:28912
```

Looked like a frontend bug. It wasn't.

## Root Cause

Every PHP request to `parthenon.acumenus.net` was 500'ing with:

```
Warning: require(/tmp/parthenon-observability-shipper/backend/app/Support/helpers.php):
  Failed to open stream: No such file or directory
  in /var/www/html/vendor/composer/autoload_real.php on line 41
```

PR 319 (ObservabilityShipper, merged 2026-05-09) was developed in a git worktree at `/tmp/parthenon-observability-shipper/`. During that work, `composer install` (or `composer dump-autoload`) was run with CWD = the worktree path. Composer's optimized autoloader bakes **absolute host paths** into `vendor/composer/autoload_static.php` for `$files`, `$classMap`, and `$psr4` entries:

```php
// vendor/composer/autoload_static.php (poisoned)
'fb04e733b88d8fd7a183ae6dd7dd3ef7' => '/tmp/parthenon-observability-shipper/backend' . '/app/Support/helpers.php',
0 => '/tmp/parthenon-observability-shipper/backend' . '/tests',
0 => '/tmp/parthenon-observability-shipper/backend' . '/database/seeders',
// ... 5+ such entries
```

The worktree's `backend/vendor/` was then copied/synced into main's `backend/vendor/` (mechanism unclear — likely manual `cp -r` or rsync during merge prep). The php container bind-mounts `./backend:/var/www/html`, so the poisoned vendor went straight into prod.

When the worktree was deleted post-merge, every `require_once` in the autoloader hit a missing path → fatal error → HTML response → frontend's `JSON.parse` returned a string → `data.data.map(...)` exploded.

The frontend's `?? []` defensive default didn't help, because `data.data` was an HTML-string-with-`.data`-property after Axios's JSON parser swallowed the malformed response.

## Why It Slipped Through

- `vendor/` is gitignored, so CI never saw the bad paths
- `composer.json` was unchanged — nothing to flag in PR review
- The worktree existed during PR merge tests; outage triggered only after worktree deletion
- Previous PR 319 CI runs (Backend Pest, Pint, etc.) all passed because CI builds vendor fresh

## Fix Applied

**Immediate (prod):**
```bash
docker compose exec -T php sh -c "cd /var/www/html && composer dump-autoload --optimize"
docker compose exec -T php php artisan config:clear
docker compose exec -T php php artisan cache:clear
```

This regenerated `autoload_static.php` with the correct `/var/www/html/...` paths (composer resolves them against CWD inside the container).

**Defensive (`deploy.sh`):**

Added a sanity check in the PHP section that detects stale `/tmp/*` or `/home/*` absolute paths in `backend/vendor/composer/autoload_static.php` and auto-regenerates:

```bash
AUTOLOAD_STATIC="backend/vendor/composer/autoload_static.php"
if [ -f "$AUTOLOAD_STATIC" ] && grep -qE "'/(tmp|home)/" "$AUTOLOAD_STATIC" 2>/dev/null; then
  warn "Composer autoloader has stale absolute paths — regenerating"
  if docker compose exec -T php sh -c "cd /var/www/html && composer dump-autoload --optimize" >/dev/null 2>&1; then
    ok "Composer autoloader regenerated"
  else
    fail "Failed to regenerate composer autoloader — run manually: docker compose exec php composer dump-autoload --optimize"
  fi
fi
```

`deploy.sh` runs on every prod deploy, so any future occurrence self-heals before the new code goes live.

## Lessons

1. **Never run `composer install` or `composer dump-autoload` from a worktree path.** Always run inside the container (`docker compose exec php composer ...`) or with CWD = main repo. The container path `/var/www/html` is stable across worktrees; host paths are not.
2. **Never rsync/cp `vendor/` between repos.** Vendor is host-path-coupled when optimized. If you need to seed vendor from elsewhere, run `composer dump-autoload` immediately after.
3. **Worktree cleanup is a deploy-blocking event** if vendor was touched. Document it.
4. **Frontend `data.data ?? []` is not a real defense** against backends that return HTML-as-JSON. Add a runtime shape check at the API layer, or fail loudly in the Axios response interceptor when content-type is not JSON.

## Files Changed

- `deploy.sh` — added composer autoload sanity check (lines 451–464)

## Memory

- `~/.claude/memory/feedback_worktree_composer_vendor.md` — recurrence guard for future sessions

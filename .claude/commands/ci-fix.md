Diagnose and fix all CI pipeline failures automatically. Runs in a loop until CI is green.

## Phase 1: Diagnose

Get the latest CI run and identify all failures:

```bash
RUN=$(gh run list --workflow ci.yml --limit 1 --json databaseId,conclusion --jq '.[0]')
echo "$RUN"
```

If the conclusion is "success", report that CI is green and stop.

If the conclusion is "failure", get per-job status:

```bash
RUN_ID=$(echo "$RUN" | jq -r '.databaseId')
gh api repos/sudoshi/Parthenon/actions/runs/$RUN_ID/jobs \
  --jq '.jobs[] | "\(.name): \(.conclusion)"'
```

For each failed job, get the error details:

```bash
JOB_ID=$(gh api repos/sudoshi/Parthenon/actions/runs/$RUN_ID/jobs \
  --jq '.jobs[] | select(.conclusion=="failure") | .id')
gh api repos/sudoshi/Parthenon/actions/jobs/$JOB_ID/logs 2>/dev/null \
  | grep "FAILED\|error TS\|##\[error\]\|SQLSTATE\|Error:" | head -30
```

Classify each error into one of: Pint, PHPStan, Pest, TypeScript, ESLint, Vitest, mypy, pytest, Migration, Build.

## Phase 2: Fix by Category

### Pint (PHP code style) — ALWAYS auto-fix
```bash
# Use Docker Pint (matches CI version) — CRITICAL for version parity
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```
If Docker is not running, use local: `cd backend && vendor/bin/pint`
Note: Local Pint version may differ from CI. Docker Pint matches CI exactly.

### PHPStan (PHP static analysis)
- If errors are from code YOU changed: fix the actual type issues
- If errors are pre-existing or from strict_types additions: regenerate baseline
  ```bash
  cd backend && vendor/bin/phpstan analyse --generate-baseline
  ```
- Never add inline `@phpstan-ignore` — fix the code or use baseline

### Pest (PHP tests)
- Read the failing test AND the controller/service it tests
- Common causes:
  - **Migration failures**: CI missing a schema → add to `.github/workflows/ci.yml` "Create schemas" step
  - **Mock return types**: Service returns `object` but mock returns `array` → cast with `(object)`
  - **Route binding**: Model uses `getRouteKeyName()` → ensure test uses the right key (slug vs id)
  - **RBAC**: User missing permissions → seed `RolePermissionSeeder` and assign correct role
  - **PostGIS unavailable**: Use SAVEPOINT in migration to prevent transaction abort

### TypeScript Build Errors
**CRITICAL: CI uses `npm run build` (Vite) which is STRICTER than `tsc --noEmit`.**
Common CI-only failures that pass locally:
- `useRef<T>()` without argument → `useRef<T | undefined>(undefined)` (React 19 strict)
- Unused imports → remove entirely (don't prefix with `_`)
- `as Record<string, ElementType>` → cast through `unknown` first
- Accessing `.data` on paginated responses → check if type uses `.items` or `.data`

Fix, then verify with BOTH:
```bash
cd frontend && npx tsc --noEmit    # Type check
cd frontend && npx vite build      # Full build (catches more)
```

### ESLint
```bash
cd frontend && npx eslint . --fix  # Auto-fix what's possible
```
Manual fixes needed for:
- `react-hooks/rules-of-hooks`: Move early returns AFTER all hooks
- `react-hooks/exhaustive-deps`: Add missing deps or restructure
- `react-refresh/only-export-components`: Split exports into separate files

### mypy (Python)
```bash
cd ai && mypy app/
```
Add type annotations. Use `Any` only for dynamic third-party types.

### pytest (Python)
```bash
cd ai && PYTEST_CURRENT_TEST=1 pytest -v
```
Common fixes: mock ChromaDB client, fix import paths, match service return types.

## Phase 3: Verify Locally

Run ALL checks that CI runs, in order:

```bash
# Backend
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint --test" \
  && echo "Pint: PASS" || echo "Pint: FAIL"

cd /home/smudoshi/Github/Parthenon/backend \
  && vendor/bin/phpstan analyse \
  && echo "PHPStan: PASS" || echo "PHPStan: FAIL"

# Frontend
cd /home/smudoshi/Github/Parthenon/frontend \
  && npx tsc --noEmit \
  && echo "TSC: PASS" || echo "TSC: FAIL"

# Python
cd /home/smudoshi/Github/Parthenon/ai \
  && python3 -c "import py_compile; py_compile.compile('app/main.py', doraise=True)" \
  && echo "Python syntax: PASS" || echo "Python syntax: FAIL"
```

## Phase 4: Commit, Push, Monitor

Stage ONLY the files you changed (not `.env` or secrets):
```bash
git add <specific-files>
git commit -m "fix(ci): <description of what was fixed>"
git push origin main
```

Then monitor the CI run:
```bash
sleep 210  # CI takes ~3.5 minutes
RUN=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view "$RUN" --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'
```

## Phase 5: Loop Until Green

If any jobs still fail, repeat from Phase 1 with the NEW error details.
Common iteration patterns:
- Fix 1 reveals Fix 2 (e.g., fixing TS exposes ESLint issue)
- CI version differs from local (Pint 1.27 vs 1.29 — always use Docker Pint)
- Cascading model changes (fixing a type breaks a downstream mock)

## Reporting

After CI is green, summarize all fixes in a table:

| Job | Error | Fix | Files Changed |
|-----|-------|-----|---------------|
| Backend/Pint | concat_space | Auto-fixed | 3 files |
| Frontend/Build | TS6133 unused import | Removed import | 1 file |

## Rules

1. **Fix the code, not the linter** — don't add ignores unless it's a genuine false positive
2. **Use Docker Pint** for version parity with CI
3. **Never modify test expectations** to make tests pass — fix the implementation
4. **Never skip hooks** (`--no-verify`) — fix the underlying issue
5. **Stage specific files** — never `git add .` or `git add -A`
6. **One commit per fix iteration** — makes rollback easy
7. **Check for `.env` files** before staging — never commit secrets

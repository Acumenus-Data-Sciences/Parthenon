Perform a code quality sweep on the Parthenon codebase. Find and fix issues that don't change behavior but improve code health.

Focus areas:

1. **Missing type hints** — PHP public methods missing return types or parameter types (PHPStan level 8)
2. **Unused imports** — PHP `use` statements and JS/TS imports that aren't referenced
3. **Dead code** — Functions, methods, or components that are never called
4. **Inconsistent naming** — snake_case in PHP, camelCase in JS/TS, PascalCase for React components
5. **Missing eager loading** — Eloquent queries that access relations without `with()` (N+1 risk)
6. **Hardcoded values** — Magic numbers or strings that should be constants or config values

Steps:

1. Run `cd backend && vendor/bin/phpstan analyse` to find type issues
2. Run `cd frontend && npx tsc --noEmit` to find TypeScript issues
3. Search for common patterns: `grep -rn "->relation_name" --include="*.php"` without nearby `with()`
4. Fix what you find — keep changes minimal and safe
5. Run `make lint` and `make test` to verify nothing breaks
6. Create a branch `chore/code-cleanup`, commit, and push
7. Create a PR with a summary of what was cleaned up

Be conservative — only fix things you're confident won't change behavior.

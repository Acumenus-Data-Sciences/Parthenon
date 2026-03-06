Run a full diagnostic check on the Parthenon codebase and report what's broken or needs attention.

Run each of these checks and collect the results:

1. **PHP formatting:** `cd backend && vendor/bin/pint --test`
2. **PHP static analysis:** `cd backend && vendor/bin/phpstan analyse`
3. **PHP tests:** `cd backend && vendor/bin/pest`
4. **TypeScript types:** `cd frontend && npx tsc --noEmit`
5. **ESLint:** `cd frontend && npx eslint .`
6. **Frontend tests:** `cd frontend && npx vitest run`
7. **Python types:** `cd ai && mypy app/`
8. **Python tests:** `cd ai && pytest`
9. **Docker health:** `docker compose ps` (check for unhealthy services)
10. **Git status:** `git status` (check for uncommitted changes)

After running all checks, provide a summary:

- ✅ Passing checks
- ❌ Failing checks with the specific errors
- Suggested fixes for each failure (with exact commands or code changes)

If everything passes, say so — don't invent problems.

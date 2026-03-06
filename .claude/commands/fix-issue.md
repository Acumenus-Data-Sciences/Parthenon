Fix GitHub issue #$ARGUMENTS.

1. Fetch the issue details: `gh issue view $ARGUMENTS --json title,body,labels,comments`
2. Read CLAUDE.md for project context
3. Understand the issue by reading the relevant source files
4. Create a fix branch: `git checkout -b fix/issue-$ARGUMENTS`
5. Implement the minimum fix needed
6. Run linters to verify:
   - `cd backend && vendor/bin/pint --test && vendor/bin/phpstan analyse`
   - `cd frontend && npx tsc --noEmit`
7. Fix any linter errors your changes introduced
8. Commit: `git commit -m "fix: <description> (closes #$ARGUMENTS)"`
9. Push and create a PR: `gh pr create --title "fix: <description>" --body "Fixes #$ARGUMENTS"`
10. Report what you changed and link to the PR

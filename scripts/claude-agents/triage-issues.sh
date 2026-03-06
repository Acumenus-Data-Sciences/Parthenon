#!/usr/bin/env bash
# triage-issues.sh — Use Claude to triage and label open GitHub issues
#
# Usage: ./scripts/claude-agents/triage-issues.sh
#
# Reviews all open issues without labels and suggests:
# - Priority (critical, high, medium, low)
# - Category (bug, enhancement, maintenance, docs)
# - Whether it's a good candidate for claude-fix

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cd "$REPO_ROOT"

echo "🔍 Fetching unlabeled open issues..."

ISSUES=$(gh issue list --state open --label "" --json number,title,body --limit 20 2>/dev/null)
ISSUE_COUNT=$(echo "$ISSUES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

if [ "$ISSUE_COUNT" = "0" ]; then
  echo "✅ No unlabeled issues to triage."
  exit 0
fi

echo "📋 Found ${ISSUE_COUNT} unlabeled issue(s). Analyzing..."

claude -p "
You are triaging GitHub issues for the Parthenon project. Read CLAUDE.md for context.

Here are the unlabeled open issues:

${ISSUES}

For each issue, provide:

1. **Suggested labels:** Choose from:
   - Priority: \`critical\`, \`high\`, \`medium\`, \`low\`
   - Type: \`bug\`, \`enhancement\`, \`maintenance\`, \`docs\`
   - Automation: \`claude-fix\` (if this looks auto-fixable by an AI agent)

2. **Brief assessment:** One sentence on what the issue is about and how hard it likely is to fix.

3. **Apply the labels** using: gh issue edit <number> --add-label 'label1,label2'

Only add the \`claude-fix\` label to issues that look straightforward enough for automated fixing:
- Clear bug reports with reproducible steps
- Missing type hints or lint errors
- Simple UI fixes with clear descriptions

Do NOT add \`claude-fix\` to:
- Vague or unclear issues
- Feature requests
- Issues requiring architectural decisions
- Issues involving data migration or schema changes

After labeling, provide a summary of what you triaged.
" --max-turns 10

echo "✅ Triage complete."

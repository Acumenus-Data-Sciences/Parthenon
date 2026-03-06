#!/usr/bin/env bash
# setup.sh — One-time setup for the Parthenon Claude Coding Team
#
# What this does:
#   1. Pushes all pending commits to GitHub
#   2. Creates the GitHub labels used by the agents
#   3. Optionally enables the nightly maintenance cron job
#
# Usage: ./scripts/claude-agents/setup.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "============================================"
echo "  Parthenon Claude Coding Team — Setup"
echo "============================================"
echo ""

# --- Step 1: Push pending commits ---
echo "📤 Step 1: Pushing pending commits to GitHub..."
AHEAD=$(git rev-list --count origin/main..main 2>/dev/null || echo "0")

if [ "$AHEAD" -gt 0 ]; then
  echo "   Found $AHEAD unpushed commit(s). Pushing now..."
  git push origin main
  echo "   ✅ Pushed successfully."
else
  echo "   ✅ Already up to date."
fi
echo ""

# --- Step 2: Create GitHub labels ---
echo "🏷️  Step 2: Creating GitHub labels for the agents..."

create_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  if gh label create "$name" --color "$color" --description "$description" 2>/dev/null; then
    echo "   ✅ Created: $name"
  else
    echo "   ⏭️  Already exists: $name"
  fi
}

create_label "claude-fix"          "7B61FF" "Auto-fix: Claude agent will diagnose and open a PR"
create_label "needs-review"        "FBCA04" "Requires manual review before merging"
create_label "major-bump"          "D93F0B" "Major version dependency update"
create_label "review/approved"     "0E8A16" "AI review: no issues found"
create_label "review/has-suggestions" "E4E669" "AI review: has suggestions to consider"
create_label "bug"                 "D73A4A" "Something isn't working"
create_label "enhancement"         "A2EEEF" "New feature or improvement"
create_label "maintenance"         "C5DEF5" "Code health, refactoring, cleanup"
create_label "critical"            "B60205" "Needs immediate attention"
create_label "high"                "FF9F1C" "High priority"
create_label "medium"              "FEF2C0" "Medium priority"
create_label "low"                 "D4C5F9" "Low priority — fix when convenient"
echo ""

# --- Step 3: Verify Claude Code is available ---
echo "🤖 Step 3: Checking Claude Code installation..."
if command -v claude &>/dev/null; then
  CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "unknown")
  echo "   ✅ Claude Code found: $CLAUDE_VERSION"
else
  echo "   ⚠️  Claude Code not found in PATH."
  echo "   Install it with: npm install -g @anthropic-ai/claude-code"
fi
echo ""

# --- Step 4: Verify gh CLI is authenticated ---
echo "🔑 Step 4: Checking GitHub CLI authentication..."
if gh auth status &>/dev/null 2>&1; then
  echo "   ✅ GitHub CLI is authenticated."
else
  echo "   ⚠️  GitHub CLI is not authenticated."
  echo "   Run: gh auth login"
fi
echo ""

# --- Step 5: Nightly maintenance cron ---
echo "🌙 Step 5: Nightly maintenance setup..."
CRON_LINE="0 2 * * * ${REPO_ROOT}/scripts/claude-agents/nightly-maintenance.sh >> /tmp/parthenon-maintenance.log 2>&1"

if crontab -l 2>/dev/null | grep -q "nightly-maintenance.sh"; then
  echo "   ✅ Nightly maintenance cron is already configured."
else
  echo ""
  echo "   Would you like to enable the nightly maintenance agent?"
  echo "   It runs at 2 AM, checks for lint/type errors, and opens PRs for fixes."
  echo ""
  read -rp "   Enable nightly maintenance? (y/n): " ENABLE_CRON

  if [[ "$ENABLE_CRON" =~ ^[Yy] ]]; then
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    echo "   ✅ Nightly maintenance cron enabled (runs at 2 AM)."
    echo "   Logs will be at: /tmp/parthenon-maintenance.log"
  else
    echo "   ⏭️  Skipped. You can enable it later by running:"
    echo "   (crontab -l; echo '$CRON_LINE') | crontab -"
  fi
fi
echo ""

# --- Summary ---
echo "============================================"
echo "  ✅ Setup Complete!"
echo "============================================"
echo ""
echo "  Your Claude coding team is ready. Here's how to use it:"
echo ""
echo "  📋 GitHub Issues → PRs:"
echo "     Create an issue, add the 'claude-fix' label,"
echo "     and a PR will appear in 5-15 minutes."
echo ""
echo "  💻 Local commands (run from Claude Code):"
echo "     /fix-issue 42     Fix a specific GitHub issue"
echo "     /diagnose          Full health check"
echo "     /cleanup           Code quality sweep"
echo ""
echo "  🖥️  Terminal scripts:"
echo "     ./scripts/claude-agents/fix-issue.sh 42"
echo "     ./scripts/claude-agents/triage-issues.sh"
echo "     ./scripts/claude-agents/nightly-maintenance.sh"
echo ""
echo "  📖 Full docs: CLAUDE.md (project context for all agents)"
echo ""

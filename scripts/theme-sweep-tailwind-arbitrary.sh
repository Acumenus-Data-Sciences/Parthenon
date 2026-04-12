#!/bin/bash
# Theme sweep: Replace Tailwind arbitrary hex values with CSS variable token classes
# Maps hardcoded bg-[#HEX], text-[#HEX], border-[#HEX], divide-[#HEX] to semantic tokens
set -euo pipefail

DIR="/home/smudoshi/Github/Parthenon/frontend/src"
EXCLUDE="--include=*.tsx --include=*.ts"

# Find all matching files (exclude test files, generated, ConstellationBackground)
FILES=$(find "$DIR" \( -name "*.tsx" -o -name "*.ts" \) \
  ! -name "*.test.tsx" ! -name "*.test.ts" \
  ! -name "api.generated.ts" \
  ! -name "ConstellationBackground.tsx" \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*")

echo "=== THEME SWEEP: Tailwind Arbitrary Hex → CSS Variable Tokens ==="
echo "Files to process: $(echo "$FILES" | wc -l)"

# ─── SURFACE/BACKGROUND REPLACEMENTS ───
echo "Pass 1: Surface backgrounds..."

# Most specific first (with opacity suffixes)
for f in $FILES; do
  sed -i \
    -e 's/bg-\[#0E0E11\]/bg-surface-base/g' \
    -e 's/bg-\[#151518\]/bg-surface-raised/g' \
    -e 's/bg-\[#141418\]/bg-surface-raised/g' \
    -e 's/bg-\[#111115\]/bg-surface-base/g' \
    -e 's/bg-\[#111114\]/bg-surface-base/g' \
    -e 's/bg-\[#101014\]/bg-surface-base/g' \
    -e 's/bg-\[#131316\]/bg-sidebar-bg-light/g' \
    -e 's/bg-\[#0B0B0E\]/bg-sidebar-bg/g' \
    -e 's/bg-\[#08080A\]/bg-surface-darkest/g' \
    -e 's/bg-\[#09090b\]/bg-surface-darkest/g' \
    -e 's/bg-\[#0A0A0F\]/bg-surface-darkest/g' \
    -e 's/bg-\[#1C1C20\]/bg-surface-overlay/g' \
    -e 's/bg-\[#1A1A1E\]/bg-surface-overlay/g' \
    -e 's/bg-\[#1A1A1F\]/bg-surface-overlay/g' \
    -e 's/bg-\[#1a1a22\]/bg-surface-overlay/g' \
    -e 's/bg-\[#1A1A22\]/bg-surface-overlay/g' \
    -e 's/bg-\[#1a1a2e\]/bg-surface-overlay/g' \
    -e 's/bg-\[#232328\]/bg-surface-elevated/g' \
    -e 's/bg-\[#2A2A30\]/bg-surface-accent/g' \
    -e 's/bg-\[#252530\]/bg-surface-accent/g' \
    -e 's/bg-\[#1E1E23\]/bg-surface-overlay/g' \
    -e 's/bg-\[#323238\]/bg-surface-highlight/g' \
    -e 's/bg-\[#18181B\]/bg-surface-raised/g' \
    -e 's/bg-\[#18181b\]/bg-surface-raised/g' \
    "$f" 2>/dev/null || true
done

echo "Pass 2: Semantic color backgrounds..."
for f in $FILES; do
  sed -i \
    -e 's/bg-\[#9B1B30\]/bg-primary/g' \
    -e 's/bg-\[#B22040\]/bg-primary-light/g' \
    -e 's/bg-\[#B42240\]/bg-primary-light/g' \
    -e 's/bg-\[#B82D42\]/bg-primary-light/g' \
    -e 's/bg-\[#6A1220\]/bg-primary-dark/g' \
    -e 's/bg-\[#C9A227\]/bg-accent/g' \
    -e 's/bg-\[#A68B1F\]/bg-accent-dark/g' \
    -e 's/bg-\[#D4B340\]/bg-accent-light/g' \
    -e 's/bg-\[#D4AE3A\]/bg-accent-light/g' \
    -e 's/bg-\[#2DD4BF\]/bg-success/g' \
    -e 's/bg-\[#26B8A5\]/bg-success-dark/g' \
    -e 's/bg-\[#26BCA8\]/bg-success-dark/g' \
    -e 's/bg-\[#20B8A5\]/bg-success-dark/g' \
    -e 's/bg-\[#E85A6B\]/bg-critical/g' \
    -e 's/bg-\[#e85d75\]/bg-critical/g' \
    -e 's/bg-\[#C94A5A\]/bg-critical-dark/g' \
    -e 's/bg-\[#E5A84B\]/bg-warning/g' \
    -e 's/bg-\[#F59E0B\]/bg-warning/g' \
    -e 's/bg-\[#60A5FA\]/bg-info/g' \
    -e 's/bg-\[#3B82F6\]/bg-info/g' \
    -e 's/bg-\[#A78BFA\]/bg-domain-observation/g' \
    -e 's/bg-\[#8B5CF6\]/bg-domain-observation/g' \
    -e 's/bg-\[#6366F1\]/bg-domain-observation/g' \
    -e 's/bg-\[#7C3AED\]/bg-domain-observation/g' \
    -e 's/bg-\[#F472B6\]/bg-domain-procedure/g' \
    -e 's/bg-\[#EC4899\]/bg-domain-procedure/g' \
    -e 's/bg-\[#DB2777\]/bg-domain-procedure/g' \
    -e 's/bg-\[#FB923C\]/bg-domain-device/g' \
    -e 's/bg-\[#F97316\]/bg-domain-device/g' \
    -e 's/bg-\[#34D399\]/bg-success/g' \
    -e 's/bg-\[#22C55E\]/bg-success/g' \
    -e 's/bg-\[#10B981\]/bg-success/g' \
    -e 's/bg-\[#F87171\]/bg-critical/g' \
    -e 's/bg-\[#818CF8\]/bg-info/g' \
    -e 's/bg-\[#22D3EE\]/bg-info/g' \
    "$f" 2>/dev/null || true
done

# ─── TEXT COLOR REPLACEMENTS ───
echo "Pass 3: Text colors..."
for f in $FILES; do
  sed -i \
    -e 's/text-\[#F0EDE8\]/text-text-primary/g' \
    -e 's/text-\[#E8E4DC\]/text-text-primary/g' \
    -e 's/text-\[#E8E4DE\]/text-text-primary/g' \
    -e 's/text-\[#C5C0B8\]/text-text-secondary/g' \
    -e 's/text-\[#8A857D\]/text-text-muted/g' \
    -e 's/text-\[#A09A90\]/text-text-muted/g' \
    -e 's/text-\[#94A3B8\]/text-text-muted/g' \
    -e 's/text-\[#6D6256\]/text-text-muted/g' \
    -e 's/text-\[#5A5650\]/text-text-ghost/g' \
    -e 's/text-\[#6B7280\]/text-text-ghost/g' \
    -e 's/text-\[#454540\]/text-text-disabled/g' \
    -e 's/text-\[#2F2A24\]/text-text-primary/g' \
    -e 's/text-\[#0E0E11\]/text-surface-base/g' \
    "$f" 2>/dev/null || true
done

echo "Pass 4: Semantic text colors..."
for f in $FILES; do
  sed -i \
    -e 's/text-\[#9B1B30\]/text-primary/g' \
    -e 's/text-\[#B82D42\]/text-primary-light/g' \
    -e 's/text-\[#C9A227\]/text-accent/g' \
    -e 's/text-\[#A68B1F\]/text-accent-dark/g' \
    -e 's/text-\[#D4B340\]/text-accent-light/g' \
    -e 's/text-\[#2DD4BF\]/text-success/g' \
    -e 's/text-\[#26B8A5\]/text-success-dark/g' \
    -e 's/text-\[#20B8A5\]/text-success-dark/g' \
    -e 's/text-\[#E85A6B\]/text-critical/g' \
    -e 's/text-\[#e85d75\]/text-critical/g' \
    -e 's/text-\[#C94A5A\]/text-critical-dark/g' \
    -e 's/text-\[#E5A84B\]/text-warning/g' \
    -e 's/text-\[#F59E0B\]/text-warning/g' \
    -e 's/text-\[#60A5FA\]/text-info/g' \
    -e 's/text-\[#3B82F6\]/text-info/g' \
    -e 's/text-\[#4A94E8\]/text-info-dark/g' \
    -e 's/text-\[#A78BFA\]/text-domain-observation/g' \
    -e 's/text-\[#8B5CF6\]/text-domain-observation/g' \
    -e 's/text-\[#6366F1\]/text-domain-observation/g' \
    -e 's/text-\[#7C3AED\]/text-domain-observation/g' \
    -e 's/text-\[#7c8aed\]/text-domain-observation/g' \
    -e 's/text-\[#818CF8\]/text-info/g' \
    -e 's/text-\[#F472B6\]/text-domain-procedure/g' \
    -e 's/text-\[#EC4899\]/text-domain-procedure/g' \
    -e 's/text-\[#DB2777\]/text-domain-procedure/g' \
    -e 's/text-\[#FB923C\]/text-domain-device/g' \
    -e 's/text-\[#F97316\]/text-domain-device/g' \
    -e 's/text-\[#34D399\]/text-success/g' \
    -e 's/text-\[#22C55E\]/text-success/g' \
    -e 's/text-\[#10B981\]/text-success/g' \
    -e 's/text-\[#F87171\]/text-critical/g' \
    -e 's/text-\[#22D3EE\]/text-info/g' \
    "$f" 2>/dev/null || true
done

echo "Pass 5: Shorthand text hex colors (3-char)..."
for f in $FILES; do
  sed -i \
    -e 's/text-\[#888\]/text-text-muted/g' \
    -e 's/text-\[#999\]/text-text-muted/g' \
    -e 's/text-\[#aaa\]/text-text-secondary/g' \
    -e 's/text-\[#bbb\]/text-text-secondary/g' \
    -e 's/text-\[#ccc\]/text-text-secondary/g' \
    -e 's/text-\[#ddd\]/text-text-primary/g' \
    -e 's/text-\[#eee\]/text-text-primary/g' \
    -e 's/text-\[#fff\]/text-text-primary/g' \
    -e 's/text-\[#555\]/text-text-ghost/g' \
    -e 's/text-\[#666\]/text-text-ghost/g' \
    -e 's/text-\[#777\]/text-text-muted/g' \
    -e 's/text-\[#444\]/text-text-disabled/g' \
    -e 's/text-\[#333\]/text-text-disabled/g' \
    "$f" 2>/dev/null || true
done

# ─── BORDER REPLACEMENTS ───
echo "Pass 6: Borders..."
for f in $FILES; do
  sed -i \
    -e 's/border-\[#2A2A2F\]/border-border-default/g' \
    -e 's/border-\[#2A2A30\]/border-border-default/g' \
    -e 's/border-\[#2a2a31\]/border-border-default/g' \
    -e 's/border-\[#2a2a3a\]/border-border-default/g' \
    -e 's/border-\[#252530\]/border-border-subtle/g' \
    -e 's/border-\[#232328\]/border-border-default/g' \
    -e 's/border-\[#1E1E23\]/border-border-subtle/g' \
    -e 's/border-\[#1C1C20\]/border-border-subtle/g' \
    -e 's/border-\[#2E2E35\]/border-border-default/g' \
    -e 's/border-\[#323238\]/border-surface-highlight/g' \
    -e 's/border-\[#3A3A42\]/border-surface-highlight/g' \
    -e 's/border-\[#3A3A40\]/border-surface-highlight/g' \
    -e 's/border-\[#3A3A3F\]/border-surface-highlight/g' \
    -e 's/border-\[#3f3f46\]/border-surface-highlight/g' \
    -e 's/border-\[#D8D3C8\]/border-border-default/g' \
    "$f" 2>/dev/null || true
done

echo "Pass 7: Semantic border colors..."
for f in $FILES; do
  sed -i \
    -e 's/border-\[#9B1B30\]/border-primary/g' \
    -e 's/border-\[#B82D42\]/border-primary-light/g' \
    -e 's/border-\[#C9A227\]/border-accent/g' \
    -e 's/border-\[#A68B1F\]/border-accent-dark/g' \
    -e 's/border-\[#2DD4BF\]/border-success/g' \
    -e 's/border-\[#26B8A5\]/border-success-dark/g' \
    -e 's/border-\[#E85A6B\]/border-critical/g' \
    -e 's/border-\[#E5A84B\]/border-warning/g' \
    -e 's/border-\[#F59E0B\]/border-warning/g' \
    -e 's/border-\[#60A5FA\]/border-info/g' \
    -e 's/border-\[#3B82F6\]/border-info/g' \
    -e 's/border-\[#A78BFA\]/border-domain-observation/g' \
    -e 's/border-\[#8B5CF6\]/border-domain-observation/g' \
    -e 's/border-\[#F472B6\]/border-domain-procedure/g' \
    -e 's/border-\[#FB923C\]/border-domain-device/g' \
    "$f" 2>/dev/null || true
done

echo "Pass 8: Shorthand border hex (3-char)..."
for f in $FILES; do
  sed -i \
    -e 's/border-\[#333\]/border-border-default/g' \
    -e 's/border-\[#444\]/border-border-default/g' \
    -e 's/border-\[#555\]/border-surface-highlight/g' \
    -e 's/border-\[#666\]/border-surface-highlight/g' \
    "$f" 2>/dev/null || true
done

# Also catch border colors with the 5A5650 ghost shade
for f in $FILES; do
  sed -i \
    -e 's/border-\[#5A5650\]/border-text-ghost/g' \
    "$f" 2>/dev/null || true
done

# ─── DIVIDE REPLACEMENTS ───
echo "Pass 9: Dividers..."
for f in $FILES; do
  sed -i \
    -e 's/divide-\[#232328\]/divide-border-default/g' \
    -e 's/divide-\[#2A2A2F\]/divide-border-default/g' \
    -e 's/divide-\[#2A2A30\]/divide-border-default/g' \
    -e 's/divide-\[#1E1E23\]/divide-border-subtle/g' \
    -e 's/divide-\[#252530\]/divide-border-subtle/g' \
    -e 's/divide-\[#323238\]/divide-border-default/g' \
    "$f" 2>/dev/null || true
done

echo ""
echo "=== SWEEP COMPLETE ==="
echo ""

# Count remaining
echo "--- Remaining counts ---"
echo -n "bg-[#HEX]: "
grep -rnoP 'bg-\[#[0-9a-fA-F]{3,8}\]' "$DIR" --include="*.tsx" --include="*.ts" | grep -v 'node_modules\|api.generated\|\.test\.\|ConstellationBackground' | wc -l
echo -n "text-[#HEX]: "
grep -rnoP 'text-\[#[0-9a-fA-F]{3,8}\]' "$DIR" --include="*.tsx" --include="*.ts" | grep -v 'node_modules\|api.generated\|\.test\.' | wc -l
echo -n "border-[#HEX]: "
grep -rnoP 'border-\[#[0-9a-fA-F]{3,8}\]' "$DIR" --include="*.tsx" --include="*.ts" | grep -v 'node_modules\|api.generated\|\.test\.' | wc -l
echo -n "divide-[#HEX]: "
grep -rnoP 'divide-\[#[0-9a-fA-F]{3,8}\]' "$DIR" --include="*.tsx" --include="*.ts" | grep -v 'node_modules\|api.generated\|\.test\.' | wc -l

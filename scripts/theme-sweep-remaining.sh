#!/usr/bin/env bash
# theme-sweep-remaining.sh — Replace remaining hardcoded hex with CSS variable tokens
# Phase 260411-s3c: Hunt down remaining ~1,300 hex values across 337 files
# Idempotent: safe to run multiple times
set -euo pipefail

FRONTEND_SRC="frontend/src"

# Exclude patterns
EXCLUDE_PATTERNS=(
  "node_modules"
  "api.generated.ts"
  "ConstellationBackground.tsx"
  "dist"
)

# Build find command excluding test files and excluded patterns
FIND_CMD="find $FRONTEND_SRC -type f \( -name '*.tsx' -o -name '*.ts' \)"
for pat in "${EXCLUDE_PATTERNS[@]}"; do
  FIND_CMD="$FIND_CMD ! -path '*$pat*'"
done
# Exclude test files
FIND_CMD="$FIND_CMD ! -name '*.test.tsx' ! -name '*.test.ts'"

echo "=== Theme Sweep: Remaining Hex-to-Token Conversion ==="
echo ""

# Count before
BEFORE_TW=$(grep -rn 'bg-\[#\|text-\[#\|border-\[#\|divide-\[#' $FRONTEND_SRC --include="*.tsx" --include="*.ts" | grep -v 'node_modules\|api.generated\|\.test\.\|ConstellationBackground' | wc -l)
BEFORE_INLINE=$(grep -rn "color: ['\"]#\|backgroundColor: ['\"]#\|background: ['\"]#\|borderColor: ['\"]#\|border: ['\"].*#\|stroke: ['\"]#\|fill: ['\"]#" $FRONTEND_SRC --include="*.tsx" --include="*.ts" | grep -v 'node_modules\|api.generated\|\.test\.\|ConstellationBackground' | wc -l)
echo "BEFORE: Tailwind hex=$BEFORE_TW, Inline hex=$BEFORE_INLINE"
echo ""

# -----------------------------------------------------------------------
# PASS 1: Tailwind arbitrary value replacements (highest-count first)
# -----------------------------------------------------------------------
echo "--- Pass 1: Tailwind border hex ---"

# border-[#2A2A2F] -> border-border-default (183 occurrences)
eval "$FIND_CMD" | xargs sed -i 's/border-\[#2A2A2F\]/border-border-default/g'
# border-[#2A2A32] -> border-border-default (close variant)
eval "$FIND_CMD" | xargs sed -i 's/border-\[#2A2A32\]/border-border-default/g'
# border-[#252530] -> border-border-subtle (109 occurrences)
eval "$FIND_CMD" | xargs sed -i 's/border-\[#252530\]/border-border-subtle/g'
# border-[#333] -> border-border-default
eval "$FIND_CMD" | xargs sed -i 's/border-\[#333\]/border-border-default/g'
# border-[#232328] -> border-border-subtle
eval "$FIND_CMD" | xargs sed -i 's/border-\[#232328\]/border-border-subtle/g'
# border-[#1E1E23] / border-[#1E1E22] -> border-border-subtle
eval "$FIND_CMD" | xargs sed -i 's/border-\[#1E1E2[23]\]/border-border-subtle/g'
# border-[#2E2E35] -> border-border-default
eval "$FIND_CMD" | xargs sed -i 's/border-\[#2E2E35\]/border-border-default/g'
# border-[#1a1a22] -> border-border-subtle
eval "$FIND_CMD" | xargs sed -i 's/border-\[#1[aA]1[aA]22\]/border-border-subtle/g'
# border-[#3A3A3F] -> border-border-hover
eval "$FIND_CMD" | xargs sed -i 's/border-\[#3[aA]3[aA]3[fF]\]/border-border-hover/g'
# border-[#3f3f46] -> border-border-hover
eval "$FIND_CMD" | xargs sed -i 's/border-\[#3[fF]3[fF]46\]/border-border-hover/g'
# border-[#D8D3C8] -> border-border-default
eval "$FIND_CMD" | xargs sed -i 's/border-\[#D8D3C8\]/border-border-default/g'
# border-[#555] -> border-border-hover
eval "$FIND_CMD" | xargs sed -i 's/border-\[#555\]/border-border-hover/g'
# border-[#5A5660] -> border-border-hover
eval "$FIND_CMD" | xargs sed -i 's/border-\[#5[aA]5660\]/border-border-hover/g'
# border-[#3A3630] -> border-border-default
eval "$FIND_CMD" | xargs sed -i 's/border-\[#3[aA]3630\]/border-border-default/g'
# border-[#612734] -> border-primary-border
eval "$FIND_CMD" | xargs sed -i 's/border-\[#612734\]/border-primary-border/g'
# border-[#E5CFC3] -> border-border-default
eval "$FIND_CMD" | xargs sed -i 's/border-\[#E5CFC3\]/border-border-default/g'

# Semantic border colors
eval "$FIND_CMD" | xargs sed -i 's/border-\[#F59E0B\]/border-warning/g'
eval "$FIND_CMD" | xargs sed -i 's/border-\[#e85d75\]/border-critical/g'
eval "$FIND_CMD" | xargs sed -i 's/border-\[#8B5CF6\]/border-domain-observation/g'
eval "$FIND_CMD" | xargs sed -i 's/border-\[#7c8aed\]/border-domain-observation/g'
eval "$FIND_CMD" | xargs sed -i 's/border-\[#6366F1\]/border-domain-observation/g'

echo "--- Pass 2: Tailwind text hex ---"

# text-[#888] -> text-text-muted (140 occurrences)
eval "$FIND_CMD" | xargs sed -i 's/text-\[#888\]/text-text-muted/g'
# text-[#555] -> text-text-ghost (97 occurrences)
eval "$FIND_CMD" | xargs sed -i 's/text-\[#555\]/text-text-ghost/g'
# text-[#666] -> text-text-ghost (69 occurrences)
eval "$FIND_CMD" | xargs sed -i 's/text-\[#666\]/text-text-ghost/g'
# text-[#ccc] -> text-text-secondary (26 occurrences)
eval "$FIND_CMD" | xargs sed -i 's/text-\[#[cC][cC][cC]\]/text-text-secondary/g'
# text-[#E8E4DC] / text-[#E8E4DE] -> text-text-primary (45 occurrences)
eval "$FIND_CMD" | xargs sed -i 's/text-\[#E8E4D[CEce]\]/text-text-primary/g'
# text-[#F0EDE8] -> text-text-primary
eval "$FIND_CMD" | xargs sed -i 's/text-\[#F0EDE8\]/text-text-primary/g'
# text-[#FFF8F2] -> text-text-primary (warm white)
eval "$FIND_CMD" | xargs sed -i 's/text-\[#FFF8F2\]/text-text-primary/g'
# text-[#2F2A24] -> text-text-primary (dark text on light)
eval "$FIND_CMD" | xargs sed -i 's/text-\[#2F2A24\]/text-text-primary/g'
# text-[#C5C0B8] -> text-text-secondary
eval "$FIND_CMD" | xargs sed -i 's/text-\[#C5C0B8\]/text-text-secondary/g'
# text-[#5A5650] -> text-text-ghost
eval "$FIND_CMD" | xargs sed -i 's/text-\[#5A5650\]/text-text-ghost/g'
# text-[#8A857D] -> text-text-muted
eval "$FIND_CMD" | xargs sed -i 's/text-\[#8A857D\]/text-text-muted/g'
# text-[#6D6256] -> text-text-muted
eval "$FIND_CMD" | xargs sed -i 's/text-\[#6D6256\]/text-text-muted/g'
# text-[#94A3B8] -> text-text-muted (slate)
eval "$FIND_CMD" | xargs sed -i 's/text-\[#94A3B8\]/text-text-muted/g'
# text-[#6B7280] -> text-text-ghost (gray)
eval "$FIND_CMD" | xargs sed -i 's/text-\[#6B7280\]/text-text-ghost/g'
# text-[#A09A90] -> text-text-muted
eval "$FIND_CMD" | xargs sed -i 's/text-\[#A09A90\]/text-text-muted/g'
# text-[#3A3630] -> text-text-disabled
eval "$FIND_CMD" | xargs sed -i 's/text-\[#3[aA]3630\]/text-text-disabled/g'
# text-[#1E1E23] -> text-text-disabled
eval "$FIND_CMD" | xargs sed -i 's/text-\[#1E1E23\]/text-text-disabled/g'

# Semantic text colors
eval "$FIND_CMD" | xargs sed -i 's/text-\[#F59E0B\]/text-warning/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#E5A84B\]/text-warning/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#e0b82e\]/text-warning/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#d4ad2f\]/text-warning/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#D4AF40\]/text-warning/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#D4AE3A\]/text-accent/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#B8911F\]/text-accent-dark/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#818CF8\]/text-info/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#34D399\]/text-success/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#22C55E\]/text-success/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#4ADE80\]/text-success/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#10B981\]/text-success/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#3C8D69\]/text-success-dark/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#2DD4BF\]/text-success/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#26B8A5\]/text-success/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#7CE8D5\]/text-success-light/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#B9FFF1\]/text-success-light/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#A7F3D0\]/text-success-light/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#E85A6B\]/text-critical/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#e85d75\]/text-critical/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#e05c6e\]/text-critical/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#F87171\]/text-critical/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#C5384C\]/text-critical/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#C52240\]/text-critical/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#F1B6BE\]/text-critical-light/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#E0F2FE\]/text-info-light/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#C35B47\]/text-critical/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#7A5A42\]/text-warning-dark/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#3B82F6\]/text-info/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#FB923C\]/text-warning/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#F97316\]/text-warning/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#22D3EE\]/text-info/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#C9A227\]/text-accent/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#9B1B30\]/text-primary/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#8B5CF6\]/text-domain-observation/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#7c8aed\]/text-domain-observation/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#A855F7\]/text-domain-observation/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#EC4899\]/text-domain-procedure/g'
eval "$FIND_CMD" | xargs sed -i 's/text-\[#DB2777\]/text-domain-procedure/g'

echo "--- Pass 3: Tailwind bg hex ---"

# bg-[#141418] -> bg-surface-raised (86 occurrences)
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#141418\]/bg-surface-raised/g'
# bg-[#151518] -> bg-surface-raised
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#151518\]/bg-surface-raised/g'
# bg-[#1a1a22] / bg-[#1A1A22] -> bg-surface-overlay (37 occurrences)
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#1[aA]1[aA]22\]/bg-surface-overlay/g'
# bg-[#101014] -> bg-surface-base (21 occurrences)
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#101014\]/bg-surface-base/g'
# bg-[#111114] / bg-[#111115] -> bg-surface-base
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#11111[45]\]/bg-surface-base/g'
# bg-[#131316] -> bg-sidebar-bg
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#131316\]/bg-sidebar-bg/g'
# bg-[#1E1E23] -> bg-surface-overlay
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#1E1E23\]/bg-surface-overlay/g'
# bg-[#252530] -> bg-surface-accent
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#252530\]/bg-surface-accent/g'
# bg-[#18181B] / bg-[#18181b] -> bg-surface-raised
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#18181[bB]\]/bg-surface-raised/g'
# bg-[#09090b] -> bg-surface-darkest
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#09090[bB]\]/bg-surface-darkest/g'
# bg-[#0A0A0F] / bg-[#0A0A0C] -> bg-surface-darkest
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#0[aA]0[aA]0[CcFf]\]/bg-surface-darkest/g'
# bg-[#0E0E11] -> bg-surface-base
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#0E0E11\]/bg-surface-base/g'

# Primary / Accent bg
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#B22040\]/bg-primary-dark/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#B42240\]/bg-primary-dark/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#B52240\]/bg-primary-dark/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#B52238\]/bg-primary-dark/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#b52038\]/bg-primary-dark/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#b02035\]/bg-primary-dark/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#9B1B30\]/bg-primary/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#D4AE3A\]/bg-accent/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#B5911F\]/bg-accent-dark/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#22B8A0\]/bg-success/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#D14D5E\]/bg-critical/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#C66B3D\]/bg-warning/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#612734\]/bg-primary-bg/g'

# Near-surface bg variants
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#1F1F24\]/bg-surface-overlay/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#16161b\]/bg-surface-raised/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#17171B\]/bg-surface-raised/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#12121a\]/bg-surface-base/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#1A1114\]/bg-surface-base/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#1e1a14\]/bg-surface-overlay/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#1a0f2e\]/bg-surface-overlay/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#13211E\]/bg-surface-base/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#2F2A24\]/bg-surface-accent/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#2A2A2F\]/bg-surface-accent/g'

# Semantic bg
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#818CF8\]/bg-info/g'
eval "$FIND_CMD" | xargs sed -i 's/bg-\[#F59E0B\]/bg-warning/g'

echo "--- Pass 4: Tailwind divide/ring/fill/stroke hex ---"

# divide-[#1E1E23] -> divide-border-subtle
eval "$FIND_CMD" | xargs sed -i 's/divide-\[#1E1E23\]/divide-border-subtle/g'
# divide-[#252530] -> divide-border-subtle
eval "$FIND_CMD" | xargs sed -i 's/divide-\[#252530\]/divide-border-subtle/g'
# divide-[#2A2A2F] -> divide-border-default
eval "$FIND_CMD" | xargs sed -i 's/divide-\[#2A2A2F\]/divide-border-default/g'

# ring
eval "$FIND_CMD" | xargs sed -i 's/ring-\[#818CF8\]/ring-info/g'
eval "$FIND_CMD" | xargs sed -i 's/ring-\[#C9A227\]/ring-accent/g'

# fill/stroke
eval "$FIND_CMD" | xargs sed -i 's/fill-\[#C9A227\]/fill-accent/g'
eval "$FIND_CMD" | xargs sed -i 's/fill-\[#818CF8\]/fill-info/g'
eval "$FIND_CMD" | xargs sed -i 's/stroke-\[#2A2A2F\]/stroke-border-default/g'

echo "--- Pass 5: Tailwind opacity variants ---"

# Handle opacity variants like border-[#2A2A2F]/50
# These should have already been caught by the above, but check for /NN suffix patterns

echo "--- Pass 6: Inline style hex replacements ---"

# Surface/bg inline styles
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#141418['\"]/backgroundColor: 'var(--surface-raised)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#1a1a22['\"]/backgroundColor: 'var(--surface-overlay)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#1A1A22['\"]/backgroundColor: 'var(--surface-overlay)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#101014['\"]/backgroundColor: 'var(--surface-base)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#0E0E11['\"]/backgroundColor: 'var(--surface-base)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#111114['\"]/backgroundColor: 'var(--surface-base)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#151518['\"]/backgroundColor: 'var(--surface-raised)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#1E1E23['\"]/backgroundColor: 'var(--surface-overlay)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#252530['\"]/backgroundColor: 'var(--surface-accent)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#18181[bB]['\"]/backgroundColor: 'var(--surface-raised)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#2A2A2F['\"]/backgroundColor: 'var(--surface-accent)'/g"

# Semantic bg inline styles with alpha
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#F59E0B18['\"]/backgroundColor: 'var(--warning-bg)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#F59E0B['\"]/backgroundColor: 'var(--warning)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#E5A84B['\"]/backgroundColor: 'var(--warning)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#34D399['\"]/backgroundColor: 'var(--success)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#22C55E['\"]/backgroundColor: 'var(--success)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#10B981['\"]/backgroundColor: 'var(--success)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#2DD4BF['\"]/backgroundColor: 'var(--success)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#E85A6B['\"]/backgroundColor: 'var(--critical)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#e85d75['\"]/backgroundColor: 'var(--critical)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#F87171['\"]/backgroundColor: 'var(--critical)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#818CF8['\"]/backgroundColor: 'var(--info)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#3B82F6['\"]/backgroundColor: 'var(--info)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#60A5FA['\"]/backgroundColor: 'var(--info)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#9B1B30['\"]/backgroundColor: 'var(--primary)'/g"
eval "$FIND_CMD" | xargs sed -i "s/backgroundColor: ['\"]#C9A227['\"]/backgroundColor: 'var(--accent)'/g"

# background: inline
eval "$FIND_CMD" | xargs sed -i "s/background: ['\"]#34D399['\"]/background: 'var(--success)'/g"
eval "$FIND_CMD" | xargs sed -i "s/background: ['\"]#F59E0B['\"]/background: 'var(--warning)'/g"
eval "$FIND_CMD" | xargs sed -i "s/background: ['\"]#E85A6B['\"]/background: 'var(--critical)'/g"
eval "$FIND_CMD" | xargs sed -i "s/background: ['\"]#818CF8['\"]/background: 'var(--info)'/g"
eval "$FIND_CMD" | xargs sed -i "s/background: ['\"]#141418['\"]/background: 'var(--surface-raised)'/g"
eval "$FIND_CMD" | xargs sed -i "s/background: ['\"]#0E0E11['\"]/background: 'var(--surface-base)'/g"

# Text color inline styles
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#E8E4DC['\"]/color: 'var(--text-primary)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#E8E4DE['\"]/color: 'var(--text-primary)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#F0EDE8['\"]/color: 'var(--text-primary)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#C5C0B8['\"]/color: 'var(--text-secondary)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#8A857D['\"]/color: 'var(--text-muted)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#5A5650['\"]/color: 'var(--text-ghost)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#6D6256['\"]/color: 'var(--text-muted)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#2F2A24['\"]/color: 'var(--text-primary)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#94A3B8['\"]/color: 'var(--text-muted)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#F59E0B['\"]/color: 'var(--warning)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#E5A84B['\"]/color: 'var(--warning)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#818CF8['\"]/color: 'var(--info)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#34D399['\"]/color: 'var(--success)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#22C55E['\"]/color: 'var(--success)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#2DD4BF['\"]/color: 'var(--success)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#E85A6B['\"]/color: 'var(--critical)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#e85d75['\"]/color: 'var(--critical)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#F87171['\"]/color: 'var(--critical)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#3B82F6['\"]/color: 'var(--info)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#60A5FA['\"]/color: 'var(--info)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#9B1B30['\"]/color: 'var(--primary)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#C9A227['\"]/color: 'var(--accent)'/g"
eval "$FIND_CMD" | xargs sed -i "s/color: ['\"]#A68B1F['\"]/color: 'var(--accent-dark)'/g"

# Border inline styles
eval "$FIND_CMD" | xargs sed -i "s/borderColor: ['\"]#2A2A2F['\"]/borderColor: 'var(--border-default)'/g"
eval "$FIND_CMD" | xargs sed -i "s/borderColor: ['\"]#252530['\"]/borderColor: 'var(--border-subtle)'/g"
eval "$FIND_CMD" | xargs sed -i "s/borderColor: ['\"]#1E1E23['\"]/borderColor: 'var(--border-subtle)'/g"
eval "$FIND_CMD" | xargs sed -i "s/borderColor: ['\"]#F59E0B40['\"]/borderColor: 'var(--warning-border)'/g"
eval "$FIND_CMD" | xargs sed -i "s/borderColor: ['\"]#F59E0B['\"]/borderColor: 'var(--warning)'/g"
eval "$FIND_CMD" | xargs sed -i "s/borderColor: ['\"]#E85A6B['\"]/borderColor: 'var(--critical)'/g"
eval "$FIND_CMD" | xargs sed -i "s/borderColor: ['\"]#818CF8['\"]/borderColor: 'var(--info)'/g"
eval "$FIND_CMD" | xargs sed -i 's/borderBottomColor: ['\''"]#999['\''"]*/borderBottomColor: '\''var(--border-default)'\''/g'

# Stroke/fill inline styles
eval "$FIND_CMD" | xargs sed -i "s/stroke: ['\"]#2A2A2F['\"]/stroke: 'var(--border-default)'/g"
eval "$FIND_CMD" | xargs sed -i "s/stroke: ['\"]#252530['\"]/stroke: 'var(--border-subtle)'/g"
eval "$FIND_CMD" | xargs sed -i "s/stroke: ['\"]#1E1E23['\"]/stroke: 'var(--border-subtle)'/g"
eval "$FIND_CMD" | xargs sed -i "s/stroke: ['\"]#E8E4DC['\"]/stroke: 'var(--text-primary)'/g"
eval "$FIND_CMD" | xargs sed -i "s/stroke: ['\"]#8A857D['\"]/stroke: 'var(--text-muted)'/g"
eval "$FIND_CMD" | xargs sed -i "s/fill: ['\"]#C9A227['\"]/fill: 'var(--accent)'/g"
eval "$FIND_CMD" | xargs sed -i "s/fill: ['\"]#818CF8['\"]/fill: 'var(--info)'/g"
eval "$FIND_CMD" | xargs sed -i "s/fill: ['\"]#9B1B30['\"]/fill: 'var(--primary)'/g"
eval "$FIND_CMD" | xargs sed -i "s/fill: ['\"]#E85A6B['\"]/fill: 'var(--critical)'/g"
eval "$FIND_CMD" | xargs sed -i "s/fill: ['\"]#F59E0B['\"]/fill: 'var(--warning)'/g"
eval "$FIND_CMD" | xargs sed -i "s/fill: ['\"]#34D399['\"]/fill: 'var(--success)'/g"
eval "$FIND_CMD" | xargs sed -i "s/fill: ['\"]#2DD4BF['\"]/fill: 'var(--success)'/g"

# border: "1px solid #..." style
eval "$FIND_CMD" | xargs sed -i "s/border: ['\"]1px solid #2A2A2F['\"]/border: '1px solid var(--border-default)'/g"
eval "$FIND_CMD" | xargs sed -i "s/border: ['\"]1px solid #252530['\"]/border: '1px solid var(--border-subtle)'/g"
eval "$FIND_CMD" | xargs sed -i "s/border: ['\"]1px solid #1E1E23['\"]/border: '1px solid var(--border-subtle)'/g"

# Count after
AFTER_TW=$(grep -rn 'bg-\[#\|text-\[#\|border-\[#\|divide-\[#' $FRONTEND_SRC --include="*.tsx" --include="*.ts" | grep -v 'node_modules\|api.generated\|\.test\.\|ConstellationBackground' | wc -l)
AFTER_INLINE=$(grep -rn "color: ['\"]#\|backgroundColor: ['\"]#\|background: ['\"]#\|borderColor: ['\"]#\|border: ['\"].*#\|stroke: ['\"]#\|fill: ['\"]#" $FRONTEND_SRC --include="*.tsx" --include="*.ts" | grep -v 'node_modules\|api.generated\|\.test\.\|ConstellationBackground' | wc -l)

echo ""
echo "=== Results ==="
echo "BEFORE: Tailwind hex=$BEFORE_TW, Inline hex=$BEFORE_INLINE"
echo "AFTER:  Tailwind hex=$AFTER_TW, Inline hex=$AFTER_INLINE"
echo "REMOVED: Tailwind=$((BEFORE_TW - AFTER_TW)), Inline=$((BEFORE_INLINE - AFTER_INLINE))"
echo ""
echo "Done!"

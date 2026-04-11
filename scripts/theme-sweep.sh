#!/usr/bin/env bash
# theme-sweep.sh — Replace hardcoded hex colors with CSS variable equivalents
# across all .tsx/.ts files under frontend/src/ (excluding token CSS files).
#
# Usage: bash scripts/theme-sweep.sh
# Idempotent: safe to run multiple times (already-replaced values won't match).

set -euo pipefail

FRONTEND_SRC="$(cd "$(dirname "$0")/../frontend/src" && pwd)"
echo "Sweeping: $FRONTEND_SRC"

# Collect target files (exclude token CSS and node_modules/dist)
FILES=$(find "$FRONTEND_SRC" \( -name '*.tsx' -o -name '*.ts' \) \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*/styles/tokens-dark.css' \
  -not -path '*/styles/tokens-light.css' \
  -not -path '*/styles/tokens-base.css')

FILE_COUNT=$(echo "$FILES" | wc -l)
echo "Found $FILE_COUNT files to process"

# --- Helper: run sed on all files and count changes ---
total_replacements=0

run_sed() {
  local pattern="$1"
  local label="$2"
  local count=0
  count=$(echo "$FILES" | xargs grep -rl "$pattern" 2>/dev/null | wc -l || true)
  if [ "$count" -gt "0" ]; then
    echo "$FILES" | xargs sed -i "$3"
    echo "  $label: $count files touched"
    total_replacements=$((total_replacements + count))
  fi
}

# =============================================================
# TAILWIND CLASS REPLACEMENTS
# =============================================================
echo ""
echo "=== Tailwind class replacements ==="

# We need case-insensitive matching for hex values.
# Strategy: match both cases explicitly for the hex digits that vary (a-fA-F).

# --- Backgrounds ---
# Each prefix: bg-, hover:bg-, from-, to-, via-
for PREFIX in "bg-" "hover:bg-" "from-" "to-" "via-"; do
  # #0E0E11
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[0][Ee][0][Ee][1][1]\]/${PREFIX}surface-base/g" 2>/dev/null || true
  # #151518
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#151518\]/${PREFIX}surface-raised/g" 2>/dev/null || true
  # #1A1A1E
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[1][Aa][1][Aa][1][Ee]\]/${PREFIX}surface-overlay/g" 2>/dev/null || true
  # #1A1A1F
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[1][Aa][1][Aa][1][Ff]\]/${PREFIX}surface-overlay/g" 2>/dev/null || true
  # #1C1C20
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[1][Cc][1][Cc]20\]/${PREFIX}surface-overlay/g" 2>/dev/null || true
  # #232328
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#232328\]/${PREFIX}surface-elevated/g" 2>/dev/null || true
  # #2A2A30
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[2][Aa][2][Aa]30\]/${PREFIX}surface-accent/g" 2>/dev/null || true
  # #323238
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#323238\]/${PREFIX}surface-highlight/g" 2>/dev/null || true
done
echo "  bg/gradient surface replacements: done"

# --- Borders ---
for PREFIX in "border-" "hover:border-" "divide-" "ring-" "outline-"; do
  # #232328 -> border-default
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#232328\]/${PREFIX}border-default/g" 2>/dev/null || true
  # #2A2A30 -> border-default
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[2][Aa][2][Aa]30\]/${PREFIX}border-default/g" 2>/dev/null || true
  # #1E1E24 -> border-subtle
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[1][Ee][1][Ee]24\]/${PREFIX}border-subtle/g" 2>/dev/null || true
  # #3A3A40 -> surface-highlight (used as border color)
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[3][Aa][3][Aa]40\]/${PREFIX}surface-highlight/g" 2>/dev/null || true
  # #3A3A42 -> surface-highlight
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[3][Aa][3][Aa]42\]/${PREFIX}surface-highlight/g" 2>/dev/null || true
done
echo "  border replacements: done"

# --- Text ---
for PREFIX in "text-" "hover:text-" "placeholder-"; do
  # #F0EDE8 -> text-primary
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Ff]0[Ee][Dd][Ee]8\]/${PREFIX}text-primary/g" 2>/dev/null || true
  # #C5C0B8 -> text-secondary
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Cc]5[Cc]0[Bb]8\]/${PREFIX}text-secondary/g" 2>/dev/null || true
  # #8A857D -> text-muted
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#8[Aa]857[Dd]\]/${PREFIX}text-muted/g" 2>/dev/null || true
  # #5A5650 -> text-ghost
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#5[Aa]5650\]/${PREFIX}text-ghost/g" 2>/dev/null || true
  # #454540 -> text-disabled
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#454540\]/${PREFIX}text-disabled/g" 2>/dev/null || true
done
echo "  text replacements: done"

# --- Semantic text ---
for PREFIX in "text-" "hover:text-"; do
  # #E85A6B -> critical
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Ee]85[Aa]6[Bb]\]/${PREFIX}critical/g" 2>/dev/null || true
  # #C9A227 -> accent
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Cc]9[Aa]227\]/${PREFIX}accent/g" 2>/dev/null || true
  # #2DD4BF -> success
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#2[Dd][Dd]4[Bb][Ff]\]/${PREFIX}success/g" 2>/dev/null || true
  # #60A5FA -> info
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#60[Aa]5[Ff][Aa]\]/${PREFIX}info/g" 2>/dev/null || true
  # #A78BFA -> domain-observation via var()
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Aa]78[Bb][Ff][Aa]\]/${PREFIX}[var(--domain-observation)]/g" 2>/dev/null || true
  # #F472B6 -> domain-procedure via var()
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Ff]472[Bb]6\]/${PREFIX}[var(--domain-procedure)]/g" 2>/dev/null || true
done
echo "  semantic text replacements: done"

# --- Semantic bg ---
for PREFIX in "bg-" "hover:bg-"; do
  # #9B1B30 -> primary
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#9[Bb]1[Bb]30\]/${PREFIX}primary/g" 2>/dev/null || true
  # #B82D42 -> primary-light
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Bb]82[Dd]42\]/${PREFIX}primary-light/g" 2>/dev/null || true
  # #E85A6B -> critical
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Ee]85[Aa]6[Bb]\]/${PREFIX}critical/g" 2>/dev/null || true
  # #C9A227 -> accent
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Cc]9[Aa]227\]/${PREFIX}accent/g" 2>/dev/null || true
  # #2DD4BF -> success
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#2[Dd][Dd]4[Bb][Ff]\]/${PREFIX}success/g" 2>/dev/null || true
  # #60A5FA -> info
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#60[Aa]5[Ff][Aa]\]/${PREFIX}info/g" 2>/dev/null || true
done
echo "  semantic bg replacements: done"

# --- fill-/stroke- Tailwind utilities ---
for PREFIX in "fill-" "stroke-"; do
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Ff]0[Ee][Dd][Ee]8\]/${PREFIX}text-primary/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Cc]5[Cc]0[Bb]8\]/${PREFIX}text-secondary/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#8[Aa]857[Dd]\]/${PREFIX}text-muted/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[0][Ee][0][Ee][1][1]\]/${PREFIX}surface-base/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#151518\]/${PREFIX}surface-raised/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#232328\]/${PREFIX}surface-elevated/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[2][Aa][2][Aa]30\]/${PREFIX}surface-accent/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#323238\]/${PREFIX}surface-highlight/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Ee]85[Aa]6[Bb]\]/${PREFIX}critical/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Cc]9[Aa]227\]/${PREFIX}accent/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#2[Dd][Dd]4[Bb][Ff]\]/${PREFIX}success/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#60[Aa]5[Ff][Aa]\]/${PREFIX}info/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Aa]78[Bb][Ff][Aa]\]/${PREFIX}[var(--domain-observation)]/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#[Ff]472[Bb]6\]/${PREFIX}[var(--domain-procedure)]/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/${PREFIX}\[#9[Bb]1[Bb]30\]/${PREFIX}primary/g" 2>/dev/null || true
done
echo "  fill/stroke replacements: done"

# =============================================================
# INLINE STYLE REPLACEMENTS (JSX style={{ }} objects)
# =============================================================
echo ""
echo "=== Inline style replacements ==="

# color property — double and single quotes
for Q in '"' "'"; do
  echo "$FILES" | xargs sed -i "s/color: *${Q}#[Ff]0[Ee][Dd][Ee]8${Q}/color: \"var(--text-primary)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#[Cc]5[Cc]0[Bb]8${Q}/color: \"var(--text-secondary)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#8[Aa]857[Dd]${Q}/color: \"var(--text-muted)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#5[Aa]5650${Q}/color: \"var(--text-ghost)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#[Ee]85[Aa]6[Bb]${Q}/color: \"var(--critical)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#[Cc]9[Aa]227${Q}/color: \"var(--accent)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#2[Dd][Dd]4[Bb][Ff]${Q}/color: \"var(--success)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#60[Aa]5[Ff][Aa]${Q}/color: \"var(--info)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#[Aa]78[Bb][Ff][Aa]${Q}/color: \"var(--domain-observation)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#[Ff]472[Bb]6${Q}/color: \"var(--domain-procedure)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#9[Bb]1[Bb]30${Q}/color: \"var(--primary)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/color: *${Q}#[Bb]82[Dd]42${Q}/color: \"var(--primary-light)\"/g" 2>/dev/null || true
done
echo "  color replacements: done"

# backgroundColor property
for Q in '"' "'"; do
  echo "$FILES" | xargs sed -i "s/backgroundColor: *${Q}#[0][Ee][0][Ee][1][1]${Q}/backgroundColor: \"var(--surface-base)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/backgroundColor: *${Q}#151518${Q}/backgroundColor: \"var(--surface-raised)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/backgroundColor: *${Q}#[1][Aa][1][Aa][1][Ee]${Q}/backgroundColor: \"var(--surface-overlay)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/backgroundColor: *${Q}#[1][Aa][1][Aa][1][Ff]${Q}/backgroundColor: \"var(--surface-overlay)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/backgroundColor: *${Q}#[1][Cc][1][Cc]20${Q}/backgroundColor: \"var(--surface-overlay)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/backgroundColor: *${Q}#232328${Q}/backgroundColor: \"var(--surface-elevated)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/backgroundColor: *${Q}#[2][Aa][2][Aa]30${Q}/backgroundColor: \"var(--surface-accent)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/backgroundColor: *${Q}#323238${Q}/backgroundColor: \"var(--surface-highlight)\"/g" 2>/dev/null || true
done
echo "  backgroundColor replacements: done"

# borderColor property
for Q in '"' "'"; do
  echo "$FILES" | xargs sed -i "s/borderColor: *${Q}#[2][Aa][2][Aa]30${Q}/borderColor: \"var(--border-default)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/borderColor: *${Q}#232328${Q}/borderColor: \"var(--border-default)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/borderColor: *${Q}#[1][Ee][1][Ee]24${Q}/borderColor: \"var(--border-subtle)\"/g" 2>/dev/null || true
done
echo "  borderColor replacements: done"

# fill (inline style)
for Q in '"' "'"; do
  echo "$FILES" | xargs sed -i "s/fill: *${Q}#[Ff]0[Ee][Dd][Ee]8${Q}/fill: \"var(--text-primary)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/fill: *${Q}#[Cc]5[Cc]0[Bb]8${Q}/fill: \"var(--text-secondary)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/fill: *${Q}#8[Aa]857[Dd]${Q}/fill: \"var(--text-muted)\"/g" 2>/dev/null || true
done
echo "  fill (inline) replacements: done"

# stroke (inline style)
for Q in '"' "'"; do
  echo "$FILES" | xargs sed -i "s/stroke: *${Q}#323238${Q}/stroke: \"var(--border-default)\"/g" 2>/dev/null || true
  echo "$FILES" | xargs sed -i "s/stroke: *${Q}#[2][Aa][2][Aa]30${Q}/stroke: \"var(--border-default)\"/g" 2>/dev/null || true
done
echo "  stroke (inline) replacements: done"

# =============================================================
# JSX ATTRIBUTE REPLACEMENTS (SVG/Recharts — unquoted style)
# =============================================================
echo ""
echo "=== JSX attribute replacements (fill=, stroke=) ==="

# fill="..." JSX attributes
echo "$FILES" | xargs sed -i 's/fill="#[Ff]0[Ee][Dd][Ee]8"/fill="var(--text-primary)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#[Cc]5[Cc]0[Bb]8"/fill="var(--text-secondary)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#8[Aa]857[Dd]"/fill="var(--text-muted)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#[0][Ee][0][Ee][1][1]"/fill="var(--surface-base)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#151518"/fill="var(--surface-raised)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#232328"/fill="var(--surface-elevated)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#[2][Aa][2][Aa]30"/fill="var(--surface-accent)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#323238"/fill="var(--surface-highlight)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#[Ee]85[Aa]6[Bb]"/fill="var(--critical)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#[Cc]9[Aa]227"/fill="var(--accent)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#2[Dd][Dd]4[Bb][Ff]"/fill="var(--success)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#60[Aa]5[Ff][Aa]"/fill="var(--info)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#[Aa]78[Bb][Ff][Aa]"/fill="var(--domain-observation)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#[Ff]472[Bb]6"/fill="var(--domain-procedure)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/fill="#9[Bb]1[Bb]30"/fill="var(--primary)"/g' 2>/dev/null || true
echo "  fill= attribute replacements: done"

# stroke="..." JSX attributes
echo "$FILES" | xargs sed -i 's/stroke="#323238"/stroke="var(--border-default)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/stroke="#[2][Aa][2][Aa]30"/stroke="var(--border-default)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/stroke="#232328"/stroke="var(--border-default)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/stroke="#[Ff]0[Ee][Dd][Ee]8"/stroke="var(--text-primary)"/g' 2>/dev/null || true
echo "$FILES" | xargs sed -i 's/stroke="#[Cc]5[Cc]0[Bb]8"/stroke="var(--text-secondary)"/g' 2>/dev/null || true
echo "  stroke= attribute replacements: done"

# =============================================================
# SUMMARY
# =============================================================
echo ""
echo "=== Sweep complete ==="

# Count remaining hardcoded hex values
REMAINING=$(grep -rn '#0E0E11\|#151518\|#1A1A1E\|#1A1A1F\|#1C1C20\|#232328\|#2A2A30\|#323238\|#F0EDE8\|#C5C0B8\|#8A857D\|#5A5650\|#454540\|#E85A6B\|#C9A227\|#2DD4BF\|#60A5FA\|#A78BFA\|#F472B6\|#9B1B30\|#B82D42\|#1E1E24\|#3A3A40\|#3A3A42' "$FRONTEND_SRC" --include='*.tsx' --include='*.ts' --exclude-dir=styles 2>/dev/null | wc -l || true)
echo "Remaining hardcoded hex values: $REMAINING"
echo "Done."

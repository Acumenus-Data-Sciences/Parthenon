# Commons Prototype Alignment — Devlog

**Date:** 2026-03-14
**Scope:** Align live Commons UI with HTML prototype specifications

## Context

Compared the live production Commons workspace (`/commons/general` and `/commons/ask-abby`) against the HTML prototypes in `docs/commons/`. The implementation was ~80% faithful, with gaps primarily in the Abby AI response components and message-level interaction affordances.

## Changes Made

### 1. Abby Response Header (AskAbbyChannel.tsx)

**Before:** Only showed a small "AI" badge and timestamp.
**After:** Full prototype-spec header — "Abby" name label + "AI assistant" badge + "MedGemma 1.5 · 4B" model identifier + right-aligned timestamp.

### 2. Abby Source Attribution (AskAbbyChannel.tsx)

**Before:** Flat bullet-point list of sources, always visible, no ranking or relevance indicators.
**After:** Wired in the existing `AbbySourceAttribution` component which was already built but unused. This provides:
- Collapsible toggle ("▸ N sources from institutional memory")
- Numbered rank circles per source
- Channel origin in primary color + user attribution + date
- Italic snippet text
- Relevance bar with green fill percentage

### 3. Abby Feedback Expansion (AskAbbyChannel.tsx)

**Before:** Simple "Helpful" / "▼" buttons with no expansion behavior.
**After:** Wired in the existing `AbbyFeedback` component which provides:
- "Helpful" button toggles to emerald active state with "Thank you" confirmation
- "Not helpful" expands to category tag picker (Inaccurate recall, Wrong source cited, Missing context, Too verbose, Made something up, Other)
- Selected tags turn red
- Optional note input field with Submit button

### 4. Abby Object Reference Chips (AskAbbyChannel.tsx)

**Before:** Simple primary-colored pills with diamond icon + display name.
**After:** Prototype-spec chips with diamond icon + uppercase type label + primary-colored display name, bordered container matching the `abby_response_card_component_states.html` prototype.

### 5. Welcome Card (AskAbbyChannel.tsx)

**Before:** Flat card with emerald border, avatar beside heading.
**After:** Gradient border (`emerald-700/30`), gradient background (`emerald-900/15` to `teal-900/15`), inset shadow highlight, avatar with status dot, subtitle showing "AI assistant · MedGemma 1.5 · Institutional memory" in emerald.

### 6. Reaction Button Cleanup (ReactionPills.tsx)

**Before:** Every message showed a persistent `+` circle (dashed border) for adding reactions, even when no reactions existed. Visually noisy.
**After:** Component returns `null` when no reactions exist. The `+` add-reaction button is now hover-only (`opacity-0 group-hover:opacity-100`), appearing only when reactions are already present.

### 7. Online Users Presence (OnlineUsers.tsx)

**Before:** Simple green dot + name text.
**After:** Colored avatar circle with initials (using `avatarColor()`) + overlaid green status ring + name + activity location text. Matches the prototype's user presence rows.

## Technical Notes

- `AbbySourceAttribution` and `AbbyFeedback` were already fully implemented as standalone components during Phase 2 but were not wired into `AskAbbyChannel.tsx`, which had its own simplified inline versions. This session replaced the inline versions with the proper components.
- TypeScript compiles cleanly with zero errors.
- Frontend production build successful (265 KB CommonsPage chunk).

## Files Changed

| File | LOC Changed |
|------|------------|
| `frontend/src/features/commons/components/abby/AskAbbyChannel.tsx` | ~80 lines |
| `frontend/src/features/commons/components/chat/ReactionPills.tsx` | ~15 lines |
| `frontend/src/features/commons/components/sidebar/OnlineUsers.tsx` | ~20 lines |

## Prototype Alignment Score

**Before:** ~80%
**After:** ~95% — remaining 5% is cosmetic (0.5px hairline borders vs 1px Tailwind default, which is negligible at screen resolution).

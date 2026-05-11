# Patient Timeline UX Improvements

**Date:** 2026-03-08
**Scope:** `frontend/src/features/profiles/components/PatientTimeline.tsx`

## Problem

The patient profile timeline at `/profiles/:id` had several UX issues:

1. **Scroll hijacking** — Mouse wheel over the timeline zoomed the chart instead of scrolling the page, making it impossible to scroll past the timeline to inspect individual clinical events below
2. **Tooltips unreliable** — Event elements were only 6px tall / 3px radius circles, making hover targets nearly impossible to hit
3. **No explicit zoom controls** — Users had to discover keyboard shortcuts or scroll-to-zoom on their own
4. **Tooltip flickered during drag** — Tooltips appeared and jittered while panning the timeline
5. **Missing clinical context** — Tooltips didn't show concept IDs or event duration
6. **Hardcoded SVG width** — Fixed 900px viewBox didn't adapt to container/screen size
7. **ClipPath ID collisions** — Static `id="chart-clip"` would conflict if multiple timelines rendered on the same page

## Changes

### Bug Fixes
- **Ctrl/Cmd+scroll to zoom** — Plain scroll now passes through to the page. Hold Ctrl (or Cmd on Mac) to zoom the timeline. Footer hint updated accordingly.
- **Tooltip suppressed during drag** — Tooltip clears on mouseDown and `isDragging` gate prevents re-showing during pan

### UX Improvements
- **Expanded hit targets** — Invisible 6px-padded transparent shapes behind each event element. The visible dots/bars are unchanged but the hoverable area is much larger.
- **Tooltip follows cursor** — `onMouseMove` tracking on each event `<g>` keeps the tooltip positioned near the cursor as it moves within a hit target
- **Smart tooltip clamping** — Tooltip flips to the left when it would overflow the container's right edge
- **Zoom +/- buttons** — `ZoomIn`/`ZoomOut` lucide icons in the toolbar, with disabled state at min (0.5x) and max (10x)
- **Duration in tooltip** — Shows human-readable duration ("45 days", "3 months", "2 years") next to date ranges for multi-day events
- **Concept ID in tooltip** — Displays `#concept_id` right-aligned next to domain badge for quick identification
- **"Click event for details"** hint added to footer

### Technical
- **Responsive SVG width** — `ResizeObserver` measures actual container width, used as SVG viewBox width instead of hardcoded 900px. Adapts to window resize.
- **Unique clipPath/pattern IDs** — React `useId()` generates instance-unique IDs (`chart-clip-:r1:`, `gap-hatch-:r1:`) preventing multi-instance SVG conflicts

## Testing

- Verified scroll passthrough (page scrolls normally over timeline)
- Verified Ctrl+scroll zooms the timeline
- Verified tooltip appears on hover for all domain types
- Verified tooltip shows concept ID and duration
- Verified zoom +/- buttons work and disable at bounds
- Verified tooltip does not appear during drag/pan
- Build passes with no TypeScript errors

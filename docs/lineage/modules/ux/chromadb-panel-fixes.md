# ChromaDB Panel Fixes — Default Collection & Tooltip Behavior

**Date:** 2026-03-14
**Scope:** `ChromaStudioPanel.tsx`, `ThreeScene.tsx`

## Changes

### 1. Default Collection Selection

The ChromaDB Chroma Collection Studio panel previously auto-selected the largest collection by vector count on load. This was changed to prefer the `docs` collection, falling back to the largest collection if `docs` doesn't exist.

**File:** `frontend/src/features/administration/components/ChromaStudioPanel.tsx`

### 2. 3D Tooltip Rendering Fixes

Hover tooltips in the Vector Explorer 3D scene were broken due to several issues with the `@react-three/drei` `Html` component configuration:

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Tooltip scaled unpredictably | `distanceFactor={5}` made tooltip size proportional to camera distance | Removed `distanceFactor` — tooltip now renders at fixed CSS size |
| Tooltip overlapped the hovered node | Positioned at exact point coordinates | Added `y + 0.15` offset to float above |
| Tooltip anchored at top-left corner | No `center` prop | Added `center` prop for centered anchoring |
| Tooltip occluded by other overlays | No z-index management | Added `zIndexRange={[100, 0]}` |
| Text wrapped awkwardly in narrow tooltip | No whitespace control | Added `whitespace-nowrap` class |

**File:** `frontend/src/features/administration/components/vector-explorer/ThreeScene.tsx`

## Testing

- TypeScript type check passes with zero errors

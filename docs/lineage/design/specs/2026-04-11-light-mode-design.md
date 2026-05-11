# Light Mode Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Scope:** Add light mode alongside existing dark mode with explicit toggle

---

## Overview

Parthenon currently ships a single dark theme defined via CSS variables in `tokens-dark.css`. This spec adds a light mode using the same CSS variable architecture, a toggle in the top bar, and localStorage persistence. ~85% of the UI responds automatically; hardcoded hex codes are addressed progressively in follow-up phases.

## Architecture

### Approach: CSS `:root` selector swap

Dark theme variables remain the default on `:root`. A new `tokens-light.css` overrides those same variables under `html.light`. The toggle adds/removes the `light` class on `<html>`.

**Why this approach:**
- Zero runtime cost — no React re-renders on theme change
- All CSS-variable-based components respond automatically
- Tailwind v4 compatible without config changes
- Simple persistence via localStorage

**Rejected alternatives:**
- Zustand store + JS `setProperty()` injection — slower (60+ calls), couples theming to React runtime
- Tailwind `dark:` variant classes — massive refactor rewriting every component's classes

### File Structure

```
src/styles/
  tokens-base.css      ← unchanged (fonts, spacing, z-index, animations)
  tokens-dark.css      ← unchanged (default :root variables)
  tokens-light.css     ← NEW (html.light overrides)
  index.css            ← add @import for tokens-light.css

src/stores/
  themeStore.ts         ← NEW (theme preference + toggle action)

src/components/layout/
  MainLayout.tsx        ← add toggle button to top bar
  ThemeToggle.tsx       ← NEW (sun/moon icon button)

index.html              ← add flash-prevention inline script
```

## Light Palette

Warm parchment base with deeper brand colors for WCAG AA contrast on light backgrounds.

### Surfaces

| Token | Dark | Light | Notes |
|-------|------|-------|-------|
| --surface-base | #0E0E11 | #F5F3EF | Warm parchment |
| --surface-raised | #151518 | #FFFFFF | Cards/panels pop on parchment |
| --surface-overlay | #1C1C20 | #F0EDE7 | Subtle distinction from base |
| --surface-elevated | #232328 | #E8E4DD | Dropdowns, popovers |
| --surface-accent | #2A2A30 | #DDD8D0 | Active states |
| --surface-highlight | #323238 | #D0CAC0 | Hover states |
| --sidebar-bg | #0B0B0E | #EAE6DF | Sidebar slightly warmer |

### Text

| Token | Dark | Light |
|-------|------|-------|
| --text-primary | #F0EDE8 | #1A1816 |
| --text-secondary | #C5C0B8 | #4A4540 |
| --text-muted | #8A857D | #7A756D |
| --text-ghost | #5A5650 | #B0A89E |
| --text-disabled | #454540 | #C5C0B8 |

### Borders

| Token | Dark | Light |
|-------|------|-------|
| --border-default | #2A2A30 | #D0CAC0 |
| --border-subtle | #1E1E24 | #E0DCD6 |
| --border-hover | #3A3A42 | #B8B0A5 |
| --border-active | #4A4A52 | #A09888 |

### Brand Colors (deeper for light backgrounds)

| Token | Dark | Light |
|-------|------|-------|
| --primary | #9B1B30 | #7A1526 |
| --primary-light | #B82040 | #9B1B30 |
| --primary-dark | #7A1526 | #5A1020 |
| --accent | #C9A227 | #8B7018 |

### Semantic Colors (richer for light backgrounds)

| Token | Dark | Light |
|-------|------|-------|
| --critical | #E85A6B | #C93545 |
| --warning | #E5A84B | #B88530 |
| --success | #2DD4BF | #1A9985 |
| --info | #60A5FA | #2563EB |

### Domain Colors

Domain-specific colors (condition, drug, measurement, visit, observation, procedure, device, death) follow the same deepening principle — slightly richer/darker variants that maintain distinction on light backgrounds.

### Chart Categorical

Chart palette (--chart-1 through --chart-8) gets deeper variants optimized for light background contrast.

### Glassmorphism

Glass transparency layers and blur values may need light-mode tuning but are not critical for Phase 1.

## Toggle UI

### Component: ThemeToggle

- Small icon button in the top bar, positioned near the user menu
- Dark mode active: sun icon (Lucide `Sun`) — "Switch to light mode" tooltip
- Light mode active: moon icon (Lucide `Moon`) — "Switch to dark mode" tooltip
- No text label, icon-only with tooltip

### Theme Store

New file `src/stores/themeStore.ts`:

```typescript
type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}
```

- Default: `'dark'`
- `toggleTheme()` flips the value, writes to `localStorage('parthenon-theme')`, and adds/removes `light` class on `document.documentElement`
- On store initialization, reads from localStorage

### Flash Prevention

Inline `<script>` in `index.html` before React bundle:

```js
(function() {
  if (localStorage.getItem('parthenon-theme') === 'light') {
    document.documentElement.classList.add('light');
  }
})();
```

Ensures correct theme before first paint — zero flicker.

### Transition

Add to `html` element in `index.css`:

```css
html {
  transition: background-color 200ms ease, color 200ms ease;
}
```

Smooth toggle feel without animating every element individually.

## Phased Rollout

### Phase 1: Core Infrastructure (this effort)

Deliverables:
- `tokens-light.css` with full palette (all ~60 variables)
- `themeStore.ts` with toggle + localStorage persistence
- Flash-prevention script in `index.html`
- `ThemeToggle.tsx` component in top bar
- Transition styling on `html`
- Verify all 10 component CSS files render correctly in light mode
- Quick audit and fix of MainLayout, sidebar, topbar, modals, forms

Definition of done: App shell, navigation, sidebar, modals, forms, tables, cards, and badges render correctly in both modes. Charts may show dark-themed colors on light backgrounds — acceptable for Phase 1.

### Phase 2: Chart Color Palettes (follow-up PR)

- Refactor `chartUtils.tsx` `CHART` object to read CSS variables via `getComputedStyle`
- Refactor `DOMAIN_COLORS` across 4 files to use a shared `getDomainColor()` helper
- Update Recharts `fill`/`stroke` props to use the helper

Files:
- `src/features/data-explorer/components/charts/chartUtils.tsx`
- `src/features/risk-scores/types/riskScore.ts`
- `src/features/standard-pros/types/proInstrument.ts`
- `src/features/morpheus/constants/domainColors.ts`

### Phase 3: Inline Hardcode Cleanup (subsequent PRs, by module)

Priority order:
1. Data Explorer (heaviest chart usage)
2. Risk Scores
3. Patient Similarity
4. Morpheus Workbench
5. Radiogenomics / Precision Medicine
6. Remaining modules

Each module is an independent PR. Pattern: find `bg-[#`, `text-[#`, `border-[#` in the module, replace with semantic CSS classes or variable references.

## Out of Scope

- OS preference detection (`prefers-color-scheme`) — explicit toggle only
- Per-user server-side persistence — localStorage only
- Glassmorphism tuning for light mode
- Custom scrollbar restyling for light mode
- Hardcoded hex cleanup beyond Phase 1 audit

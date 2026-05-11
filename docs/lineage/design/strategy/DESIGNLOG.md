# DESIGNLOG.md — Parthenon Frontend Design System

> **Status:** Draft — Phase 2 Pre-Implementation
> **Reference App:** MindLog v2.2 (Dark Clinical Dashboard)
> **Last Updated:** 2026-03-01

---

## Table of Contents

1. [Philosophy & Vision](#1-philosophy--vision)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Layout Grid](#4-spacing--layout-grid)
5. [Border Radius & Shadows](#5-border-radius--shadows)
6. [Transitions & Motion](#6-transitions--motion)
7. [Application Shell](#7-application-shell)
8. [Navigation Patterns](#8-navigation-patterns)
9. [Component Library](#9-component-library)
10. [Page Specifications](#10-page-specifications)
11. [Data Visualization](#11-data-visualization)
12. [Status & Domain Semantics](#12-status--domain-semantics)
13. [Accessibility Standards](#13-accessibility-standards)
14. [Implementation Roadmap](#14-implementation-roadmap)

---

## 1. Philosophy & Vision

### 1.1 Design Goals

Parthenon is a **clinical research platform** for outcomes researchers working with OMOP CDM data. Its users are epidemiologists, biostatisticians, clinical informaticists, and data engineers — highly technical, deadline-driven, often working on multi-monitor research workstations.

The UI must communicate:
- **Trustworthiness** — results drive real-world research decisions
- **Precision** — data density without chaos; every pixel earns its place
- **Transparency** — pipeline status, data quality, job progress always visible
- **Power** — complexity should be accessible, not hidden

### 1.2 Design Language

Directly derived from **MindLog v2.2**: a dark-theme clinical intelligence platform using glassmorphic panels, layered dark-grey surfaces, and a **Dark Crimson + Gold + Ivory** palette. Parthenon inherits this language and extends it with research-domain semantics (data quality indicators, cohort status, job pipelines, AI augmentation).

**Visual Style:** Dark, glass-like, precision-focused. Surfaces layer from deep near-black to slightly elevated dark grey. Cards use subtle diagonal gradients with a 1px top-edge shimmer. Interactive elements respond with gold hover accents and crimson active states.

**Desktop-first.** Parthenon targets 1440px–2560px research workstations. Responsive breakpoints exist but are secondary to the dense, information-rich primary layout.

### 1.3 Key Differences from MindLog

| Dimension | MindLog | Parthenon |
|-----------|---------|-----------|
| Domain | Mental health monitoring | Outcomes research / OMOP CDM |
| Primary entity | Patient | Cohort / Study / Subject |
| Status indicators | Mood scale, risk levels | DQD pass/fail, job state, pipeline health |
| Real-time | Alert WebSocket | Job WebSocket (Horizon), AI streaming |
| Data viz | Mood heatmap, bar charts | Treemaps, survival curves, forest plots, Sankey |
| Navigation depth | Flat (7 items) | Hierarchical (10 sections, tabbed sub-pages) |
| AI component | None | MedGemma chat, AI ETL, concept mapping |

---

## 2. Color System

All colors are defined as CSS custom properties on `:root` in `frontend/src/index.css`. No Tailwind color config — all Tailwind classes reference these variables via `@theme inline`.

### 2.1 Primary — Dark Crimson

```css
--primary:          #9B1B30;
--primary-light:    #B82D42;
--primary-dark:     #6A1220;
--primary-lighter:  #D04058;
--primary-glow:     rgba(155, 27, 48, 0.4);
--primary-bg:       rgba(155, 27, 48, 0.15);
--primary-border:   rgba(184, 45, 66, 0.4);
--shadow-primary:   0 4px 20px var(--primary-glow);
```

**Usage:** Active nav items (left-border accent), primary CTA buttons, avatar backgrounds, critical badges.

### 2.2 Accent — Research Gold

```css
--accent:           #C9A227;
--accent-dark:      #A68B1F;
--accent-light:     #D4B340;
--accent-lighter:   #E0C45A;
--accent-muted:     #A68B1F;
--accent-pale:      rgba(201, 162, 39, 0.15);
--accent-bg:        rgba(201, 162, 39, 0.10);
--accent-glow:      rgba(201, 162, 39, 0.30);
--focus-ring:       0 0 0 3px var(--accent-pale);
```

**Usage:** Active tab underline, hover borders, links, sorted column headers, gold focus ring on all interactive elements.

### 2.3 Surfaces — Dark Grey Stack

```css
--surface-darkest:   #08080A;   /* deepest background, rarely visible */
--surface-base:      #0E0E11;   /* page background */
--surface-raised:    #151518;   /* cards, panels, topbar */
--surface-overlay:   #1C1C20;   /* hover states, dropdowns, table rows */
--surface-elevated:  #232328;   /* active dropdown items, selected rows */
--surface-accent:    #2A2A30;   /* filter chips, inline code backgrounds */
--surface-highlight: #323238;   /* highest surface, tooltip backgrounds */

--sidebar-bg:        #0B0B0E;
--sidebar-bg-light:  #131316;
```

### 2.4 Text — Ivory Scale

```css
--text-primary:   #F0EDE8;   /* headings, values, active labels */
--text-secondary: #C5C0B8;   /* body text, field labels */
--text-muted:     #8A857D;   /* helper text, secondary metadata */
--text-ghost:     #5A5650;   /* section dividers, very faded labels */
--text-disabled:  #454540;   /* disabled state text */
```

### 2.5 Semantic Colors

#### Critical / Error
```css
--critical:        #E85A6B;
--critical-dark:   #C94A5A;
--critical-light:  #FF6B7D;
--critical-bg:     rgba(232, 90, 107, 0.20);
--critical-border: rgba(232, 90, 107, 0.30);
--critical-glow:   rgba(232, 90, 107, 0.25);
--shadow-critical: 0 4px 16px var(--critical-glow);
```

#### Warning
```css
--warning:         #E5A84B;
--warning-dark:    #C9923A;
--warning-light:   #F0B85C;
--warning-bg:      rgba(229, 168, 75, 0.20);
--warning-border:  rgba(229, 168, 75, 0.30);
--warning-glow:    rgba(229, 168, 75, 0.25);
```

#### Success
```css
--success:         #2DD4BF;   /* teal, not generic green */
--success-dark:    #20B8A5;
--success-light:   #45E0CF;
--success-bg:      rgba(45, 212, 191, 0.20);
--success-border:  rgba(45, 212, 191, 0.30);
--success-glow:    rgba(45, 212, 191, 0.25);
```

#### Info
```css
--info:            #60A5FA;
--info-dark:       #4A94E8;
--info-light:      #78B4FF;
--info-bg:         rgba(96, 165, 250, 0.20);
--info-border:     rgba(96, 165, 250, 0.30);
--info-glow:       rgba(96, 165, 250, 0.25);
```

### 2.6 Research-Domain Status Colors

#### Data Quality (DQD)
```css
--dqd-pass:        var(--success);          /* check passes */
--dqd-pass-bg:     var(--success-bg);
--dqd-warn:        var(--warning);          /* threshold warning */
--dqd-warn-bg:     var(--warning-bg);
--dqd-fail:        var(--critical);         /* check fails */
--dqd-fail-bg:     var(--critical-bg);
--dqd-na:          var(--text-ghost);       /* not applicable */
```

#### Job / Pipeline Status
```css
--job-queued:      var(--text-muted);       /* waiting in queue */
--job-running:     var(--info);             /* currently executing */
--job-running-bg:  var(--info-bg);
--job-success:     var(--success);
--job-success-bg:  var(--success-bg);
--job-failed:      var(--critical);
--job-failed-bg:   var(--critical-bg);
--job-cancelled:   var(--text-ghost);
```

#### Cohort / Study Status
```css
--cohort-draft:    var(--text-muted);
--cohort-active:   var(--success);
--cohort-archived: var(--text-ghost);
--cohort-error:    var(--critical);
```

#### CDM Source / Daimon Health
```css
--source-healthy:     var(--success);
--source-degraded:    var(--warning);
--source-unavailable: var(--critical);
--source-unknown:     var(--text-ghost);
```

#### AI Confidence
```css
--ai-high:    var(--success);     /* ≥ 0.85 */
--ai-medium:  var(--warning);     /* 0.60–0.84 */
--ai-low:     var(--critical);    /* < 0.60 */
--ai-pending: var(--info);        /* processing */
```

### 2.7 Borders
```css
--border-default: #2A2A30;
--border-subtle:  rgba(42, 42, 48, 0.60);
--border-hover:   #A68B1F;     /* gold on hover */
--border-focus:   #C9A227;
--border-active:  #9B1B30;     /* crimson active/selected */
```

### 2.8 Glassmorphism
```css
--glass-00: rgba(255, 255, 255, 0.02);
--glass-01: rgba(255, 255, 255, 0.04);
--glass-02: rgba(255, 255, 255, 0.07);
--glass-03: rgba(255, 255, 255, 0.10);
--glass-04: rgba(255, 255, 255, 0.14);
--glass-05: rgba(255, 255, 255, 0.18);
--glass-dark-00: rgba(0, 0, 0, 0.10);
--glass-dark-01: rgba(0, 0, 0, 0.20);
--glass-dark-02: rgba(0, 0, 0, 0.30);
--blur-sm: blur(4px);
--blur-md: blur(8px);
--blur-lg: blur(16px);
--blur-xl: blur(24px);
```

### 2.9 Gradients
```css
--gradient-panel:       linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%);
--gradient-panel-raised: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
--gradient-panel-inset: linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.08) 100%);
--gradient-crimson:     linear-gradient(135deg, var(--primary), var(--primary-dark));
--gradient-gold:        linear-gradient(135deg, var(--accent-light), var(--accent-dark));
```

---

## 3. Typography

### 3.1 Font Stack

All fonts loaded via Google Fonts in `index.html`.

```css
--font-display:  'Crimson Pro', Georgia, serif;         /* hero numbers, large display */
--font-heading:  'Source Serif 4', Georgia, serif;      /* section headings, panel titles */
--font-body:     'Source Sans 3', 'Helvetica Neue', sans-serif;  /* all UI text */
--font-mono:     'IBM Plex Mono', Consolas, monospace;  /* concept IDs, SQL, CDM codes */
```

**Rationale:** Serif headings evoke academic research credibility (journal-like authority). Clean sans-serif body ensures dense data tables remain readable. Monospace for all identifiers (concept IDs, MRNs, source keys, SQL) prevents ambiguity.

### 3.2 Type Scale

```css
--text-xs:   0.6875rem;  /* 11px — uppercase labels with letter-spacing */
--text-sm:   0.75rem;    /* 12px — table cell text, secondary metadata */
--text-base: 0.875rem;   /* 14px — default body, form labels, nav items */
--text-md:   0.9375rem;  /* 15px — slightly elevated body copy */
--text-lg:   1rem;       /* 16px — topbar title, lead text */
--text-xl:   1.125rem;   /* 18px — panel titles, section headers */
--text-2xl:  1.375rem;   /* 22px — page titles, cohort names */
--text-3xl:  1.75rem;    /* 28px — metric values, stat numbers */
--text-4xl:  2.25rem;    /* 36px — dashboard KPI values */
--text-5xl:  3rem;       /* 48px — hero metrics */
--text-6xl:  3.5rem;     /* 56px — empty-state display numbers */
```

**Root font-size:** `16px` fixed. No viewport scaling — research workstations need stable text density. For 4K displays (`min-width: 2560px`): `18px`.

### 3.3 Usage Rules

- Minimum rendered size: **12px** (`--text-sm`). Exception: 11px (`--text-xs`) only for all-caps labels with `letter-spacing: 0.8px`.
- Line height: `1.5` default (WCAG 2.1 compliance).
- Table cells: `--text-sm` (12px) for dense data, `--text-base` (14px) for primary columns.
- Concept IDs, OMOP codes, SQL: always `--font-mono`.
- Large metric values (cohort count, subject count): `--font-display` for visual authority.

### 3.4 Text Utilities

```css
.text-label      /* text-xs, uppercase, letter-spacing: 0.8px, text-ghost */
.text-caption    /* text-xs, text-muted */
.text-mono       /* font-mono, text-sm */
.text-value      /* font-display, text-3xl or larger, text-primary */
.text-panel-title /* font-heading, text-xl, text-primary, font-weight: 600 */
.text-section    /* font-heading, text-2xl, text-primary */
.text-truncate   /* overflow: hidden, text-overflow: ellipsis, white-space: nowrap */
```

---

## 4. Spacing & Layout Grid

### 4.1 Spacing Scale (4px base)

```css
--space-0:  0;
--space-1:  4px;    /* icon-to-text gap, badge padding */
--space-2:  8px;    /* tight grouping, chip padding */
--space-3:  12px;   /* form field gaps, nav item padding */
--space-4:  16px;   /* standard padding, card inner gap */
--space-5:  20px;   /* panel padding (primary) */
--space-6:  24px;   /* section breaks, content area padding */
--space-8:  32px;   /* major section gaps */
--space-10: 40px;   /* page margins */
--space-12: 48px;   /* empty state padding */
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

### 4.2 Layout Variables

```css
--sidebar-width:           260px;
--sidebar-width-collapsed: 72px;
--topbar-height:           56px;
--content-max-width:       1600px;   /* wider than MindLog for research dashboards */
--panel-padding:           var(--space-5);  /* 20px */
--content-padding:         var(--space-6);  /* 24px */
```

### 4.3 Grid Patterns

```css
/* Metric card row */
.grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-4); }

/* Standard two-column split */
.grid-two    { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }

/* Primary content + sidebar panel (e.g., cohort list + detail) */
.grid-split  { display: grid; grid-template-columns: 1fr 380px; gap: var(--space-4); }

/* Three-column (analyses, vocabulary) */
.grid-three  { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }

/* Four-column stat grid */
.grid-four   { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }
```

**Responsive breakpoints:**
```css
@media (max-width: 1400px) { .grid-split { grid-template-columns: 1fr 320px; } }
@media (max-width: 1200px) { .grid-three { grid-template-columns: 1fr 1fr; } .grid-split { grid-template-columns: 1fr; } }
@media (max-width:  900px) { .grid-two, .grid-three, .grid-four { grid-template-columns: 1fr; } }
```

### 4.4 Z-Index Scale

```css
--z-base:           0;
--z-dropdown:       10;
--z-sticky:         20;
--z-fixed:          30;
--z-topbar:         50;
--z-sidebar:        100;
--z-modal-backdrop: 200;
--z-modal:          210;
--z-popover:        300;
--z-toast:          400;
--z-tooltip:        500;
```

---

## 5. Border Radius & Shadows

### 5.1 Border Radius

```css
--radius-xs:   4px;      /* inline code, small tags */
--radius-sm:   6px;      /* buttons, inputs, small badges */
--radius-md:   8px;      /* dropdowns, chips, tooltips */
--radius-lg:   12px;     /* cards, panels, modals (standard) */
--radius-xl:   16px;     /* large feature cards, hero panels */
--radius-2xl:  24px;     /* splash panels, AI chat bubbles */
--radius-full: 9999px;   /* pills, avatars, circular badges */
```

### 5.2 Shadows

```css
--shadow-xs:     0 1px 2px rgba(0, 0, 0, 0.40);
--shadow-sm:     0 2px 4px rgba(0, 0, 0, 0.50);
--shadow-md:     0 4px 12px rgba(0, 0, 0, 0.60);
--shadow-lg:     0 8px 24px rgba(0, 0, 0, 0.70);
--shadow-xl:     0 16px 48px rgba(0, 0, 0, 0.80);
--shadow-2xl:    0 24px 64px rgba(0, 0, 0, 0.85);
--shadow-inset:  inset 0 1px 3px rgba(0, 0, 0, 0.40);
--shadow-inset-lg: inset 0 2px 6px rgba(0, 0, 0, 0.50);

/* Semantic glow shadows */
--shadow-primary:  0 4px 20px var(--primary-glow);
--shadow-critical: 0 4px 16px var(--critical-glow);
--shadow-warning:  0 4px 16px var(--warning-glow);
--shadow-success:  0 4px 16px var(--success-glow);
--shadow-info:     0 4px 16px var(--info-glow);
```

---

## 6. Transitions & Motion

### 6.1 Duration Scale

```css
--duration-instant: 50ms;
--duration-fast:    100ms;   /* hover color/border changes */
--duration-normal:  200ms;   /* standard transitions */
--duration-slow:    300ms;   /* entry animations, modal open */
--duration-slower:  400ms;   /* complex page transitions */
```

### 6.2 Easing Functions

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);         /* exits, panels sliding out */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);        /* smooth accordion, expand */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);     /* badge pop, toast appear */
--ease-smooth: cubic-bezier(0.40, 0, 0.20, 1);        /* standard motion */
```

### 6.3 Animation Keyframes

```css
@keyframes fadeIn        { from { opacity: 0 } to { opacity: 1 } }
@keyframes fadeInUp      { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes fadeInScale   { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
@keyframes slideInRight  { from { opacity: 0; transform: translateX(100%) } to { opacity: 1; transform: none } }
@keyframes subtlePulse   { 0%, 100% { opacity: 1 } 50% { opacity: 0.6 } }
@keyframes glowPulse     { 0%, 100% { box-shadow: var(--shadow-sm) } 50% { box-shadow: var(--shadow-primary) } }
@keyframes shimmer       { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
@keyframes spin          { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
@keyframes progressBar   { from { width: 0% } to { width: var(--target-width) } }
```

### 6.4 Staggered Entry Classes

```css
.anim       { animation: fadeInUp var(--duration-slow) var(--ease-out) both; }
.anim-d1    { animation-delay: 0.05s; }
.anim-d2    { animation-delay: 0.10s; }
.anim-d3    { animation-delay: 0.15s; }
.anim-d4    { animation-delay: 0.20s; }
.anim-d5    { animation-delay: 0.25s; }
```

Use stagger classes on dashboard cards, panel rows, and table entries to create natural load-in feel.

---

## 7. Application Shell

### 7.1 Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  TOPBAR (56px, sticky, z-topbar: 50)                             │
│  [Logo] [Page Title + Subtitle]    [AI Status] [Jobs] [Search]   │
│                                    [Horizon Indicator] [User]    │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│ SIDEBAR  │  CONTENT AREA (.content-scroll)                      │
│ 260px    │  background: --surface-base                          │
│ Fixed    │  padding: 24px                                       │
│ z: 100   │  max-width: 1600px                                   │
│          │  overflow-y: auto                                    │
│ ─────── │                                                       │
│ Brand    │  ┌───────────────────────────────────────────────┐   │
│ ─────── │  │ TAB BAR (optional, per feature section)       │   │
│ Nav      │  │ position: sticky, top: 0, z: sticky           │   │
│ Groups   │  ├───────────────────────────────────────────────┤   │
│ ─────── │  │ PAGE BODY                                     │   │
│ AI       │  │ .view or .view-pad                           │   │
│ Status   │  │                                               │   │
│ ─────── │  └───────────────────────────────────────────────┘   │
│ User     │                                                       │
│ Footer   │                                                       │
└──────────┴───────────────────────────────────────────────────────┘
```

### 7.2 Sidebar

**Width:** 260px fixed (collapsible to 72px icon-only mode, toggled via Zustand `uiStore`).

**Structure:**
```
┌────────────────────────────────┐
│ ■ PARTHENON  [collapse toggle] │  Brand area — logo + name
│   outcomes research            │  tagline in text-ghost
├────────────────────────────────┤
│ ● [User Name]                  │  User badge — avatar + name + role
│   Epidemiologist               │  Clickable → profile / settings
├────────────────────────────────┤
│  OVERVIEW                      │  Section label (all-caps, text-ghost)
│  ░ Dashboard                   │  Nav item
│  ░ Data Sources           [3]  │  Nav item + badge (source count)
├────────────────────────────────┤
│  RESEARCH WORKFLOW             │
│  ░ Data Ingestion              │
│  ░ Vocabulary                  │
│  ░ Cohort Definitions     [12] │
│  ░ Concept Sets            [8] │
├────────────────────────────────┤
│  ANALYTICS                     │
│  ░ Data Explorer               │
│  ░ Analyses                    │
│  ░ Studies                     │
│  ░ Patient Profiles            │
├────────────────────────────────┤
│  SYSTEM                        │
│  ░ Jobs                    [2] │  Badge = running count
│  ░ Administration              │
├────────────────────────────────┤
│  AI SERVICE    ● online        │  Connection status dot
│  MedGemma 4b                   │  Model name, text-ghost
├────────────────────────────────┤
│  [Sign Out]                    │  btn-ghost, full width
└────────────────────────────────┘
```

**Colors:** `--sidebar-bg` (#0B0B0E), `--border-default` dividers.

**Active nav item:** `--primary-bg` background, left `3px` crimson border, `--text-primary` text.

**Hover nav item:** `--surface-raised` background, `--text-primary` text.

**Nav badges:** job count in `--critical` (crimson + glow) if running failures; source count in `--surface-accent` neutral.

### 7.3 Topbar

**Height:** 56px, sticky, `--surface-raised` background, 1px bottom border.

```
LEFT:    [App name / section breadcrumb]  [Page subtitle]
CENTER:  [spacer]
RIGHT:   [AI streaming indicator]  [Job queue indicator]  [Global search]  [User avatar]
```

**AI indicator:** Animated dot (pulse) when MedGemma stream is active. Color: `--info` when streaming, `--text-ghost` idle.

**Job indicator:** Icon + count badge. `--warning` when jobs running, `--critical` if any failed (blinks), `--text-ghost` if idle.

**Global search:** Pill-shaped input (`--radius-full`), gold focus ring, opens full-screen overlay modal on focus. Keyboard shortcut: `/`.

---

## 8. Navigation Patterns

### 8.1 Sidebar Nav Item

```css
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-base);
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: all var(--duration-fast);
}
.nav-item:hover  { background: var(--surface-raised); color: var(--text-primary); }
.nav-item.active { background: var(--primary-bg); color: var(--text-primary); }
.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0; top: 6px; bottom: 6px;
  width: 3px;
  background: var(--primary);
  border-radius: 0 2px 2px 0;
}
```

### 8.2 Tab Bar (Feature Sub-Navigation)

Used within major feature sections (e.g., Analyses, Data Explorer, Studies).

```
[Characterization] [Incidence Rates] [Pathways] [PLE] [PLP]
─────────────────                                          ← gold underline on active
```

```css
.tab-bar {
  display: flex;
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border-default);
  padding: 0 var(--space-6);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  overflow-x: auto;
}
.tab { padding: var(--space-4) var(--space-5); font-size: var(--text-sm); color: var(--text-muted); border-bottom: 2px solid transparent; }
.tab:hover  { color: var(--text-secondary); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
```

### 8.3 Breadcrumb

Shown in topbar area for deeply nested views (e.g., Analyses > PLE > Study 1234).

```
Dashboard  /  Analyses  /  Patient-Level Estimation  /  Study 1234
```

```css
.breadcrumb      { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
.breadcrumb-item { color: var(--text-muted); cursor: pointer; }
.breadcrumb-item:hover  { color: var(--accent); }
.breadcrumb-item.active { color: var(--text-primary); cursor: default; pointer-events: none; }
.breadcrumb-sep  { color: var(--text-ghost); }
```

---

## 9. Component Library

### 9.1 Panel (Base Card)

The fundamental content container. All dashboard sections, feature panels, and data cards use `.panel`.

```css
.panel {
  background: var(--surface-raised);
  background-image: var(--gradient-panel);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  position: relative;
  overflow: hidden;
  margin-bottom: 14px;
  transition: border-color var(--duration-fast), box-shadow var(--duration-normal);
}
/* Top-edge shimmer */
.panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.15) 70%, transparent 100%);
  pointer-events: none;
}
.panel:hover { border-color: var(--border-hover); }

/* Panel with glow variant for AI outputs */
.panel.ai-glow { box-shadow: 0 0 20px rgba(96, 165, 250, 0.15); border-color: var(--info-border); }
```

**Panel Header:**
```jsx
<div className="panel-header">     {/* display:flex, justify-content:space-between, align-items:flex-start, margin-bottom:16px */}
  <div>
    <div className="panel-title">Cohort Attrition</div>
    <div className="panel-sub">Inclusion/exclusion waterfall</div>
  </div>
  <div className="panel-action">Export →</div>
</div>
```

### 9.2 Metric Card

```css
.metric-card {
  background: var(--surface-raised);
  background-image: var(--gradient-panel);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  transition: all var(--duration-normal);
  cursor: default;
}
.metric-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.metric-card .metric-label  { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-ghost); margin-bottom: var(--space-2); }
.metric-card .metric-value  { font-family: var(--font-display); font-size: var(--text-4xl); color: var(--text-primary); line-height: 1.1; }
.metric-card .metric-delta  { font-size: var(--text-xs); color: var(--text-muted); margin-top: var(--space-2); }

/* Semantic variants */
.metric-card.critical { border-color: var(--critical-border); background-image: var(--gradient-panel), var(--critical-bg); }
.metric-card.warning  { border-color: var(--warning-border);  background-image: var(--gradient-panel); }
.metric-card.success  { border-color: var(--success-border);  background-image: var(--gradient-panel); }
```

### 9.3 Buttons

```css
/* Base */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm); font-weight: 600; font-family: var(--font-body);
  cursor: pointer; white-space: nowrap;
  transition: all var(--duration-fast);
  min-height: 32px;
  border: none;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Variants */
.btn-primary   { background: var(--gradient-crimson); color: var(--text-primary); box-shadow: var(--shadow-primary); }
.btn-primary:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }

.btn-secondary { background: var(--surface-overlay); border: 1px solid var(--border-default); color: var(--text-secondary); }
.btn-secondary:hover:not(:disabled) { background: var(--surface-elevated); border-color: var(--border-hover); color: var(--text-primary); }

.btn-ghost  { background: transparent; color: var(--text-secondary); }
.btn-ghost:hover:not(:disabled) { background: var(--glass-01); color: var(--text-primary); }

.btn-danger { background: transparent; border: 1px solid var(--critical-border); color: var(--critical); }
.btn-danger:hover:not(:disabled) { background: var(--critical-bg); }

/* Sizes */
.btn-sm { padding: var(--space-1) var(--space-3); font-size: var(--text-xs); }
.btn-lg { padding: var(--space-3) var(--space-6); font-size: var(--text-md); }
.btn-block { width: 100%; }

/* Loading state */
.btn.loading { color: transparent !important; pointer-events: none; position: relative; }
.btn.loading::after {
  content: ''; position: absolute; width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
  border-radius: 50%; animation: spin 1s linear infinite;
}
```

### 9.4 Form Controls

**Input:**
```css
.form-input {
  display: block; width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--surface-raised);
  border: 2px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-md); color: var(--text-primary); font-family: var(--font-body);
  transition: all var(--duration-normal);
}
.form-input:focus { outline: none; border-color: var(--accent); box-shadow: var(--focus-ring); }
.form-input::placeholder { color: var(--text-ghost); }
.form-input.error { border-color: var(--critical); }
.form-input.sm { padding: var(--space-2) var(--space-3); font-size: var(--text-sm); }
.form-input.mono { font-family: var(--font-mono); }  /* for SQL, concept IDs */
```

**Select, Textarea:** Same styles as `.form-input`.

**Form Group:**
```css
.form-group    { margin-bottom: var(--space-5); }
.form-label    { display: block; font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-2); }
.form-hint     { font-size: var(--text-xs); color: var(--text-muted); margin-top: var(--space-1); }
.form-error    { font-size: var(--text-xs); color: var(--critical); margin-top: var(--space-1); }
```

**Search Bar:**
```css
.search-bar {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--surface-overlay);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  transition: all var(--duration-normal);
}
.search-bar:focus-within { border-color: var(--accent); box-shadow: var(--focus-ring); }
```

**Filter Chips:**
```css
.filter-chip {
  padding: var(--space-2) var(--space-4);
  background: var(--surface-raised); border: 1px solid var(--border-default);
  border-radius: var(--radius-full); font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary);
  cursor: pointer; transition: all var(--duration-fast);
  display: inline-flex; align-items: center; gap: var(--space-2);
}
.filter-chip:hover  { border-color: var(--border-hover); background: var(--surface-overlay); color: var(--text-primary); }
.filter-chip.active { background: var(--primary); border-color: var(--primary); color: var(--text-primary); }
```

### 9.5 Data Table

```css
.data-table {
  width: 100%; background: var(--surface-raised);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  border-collapse: separate; border-spacing: 0; overflow: hidden;
}
.data-table thead { background: var(--surface-overlay); }
.data-table th {
  padding: var(--space-3) var(--space-4);
  text-align: left; font-size: var(--text-xs); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);
  border-bottom: 1px solid var(--border-default);
  cursor: pointer; user-select: none; white-space: nowrap;
}
.data-table th:hover { color: var(--accent); }
.data-table th.sorted { color: var(--accent); }
.data-table tbody tr { cursor: pointer; transition: background var(--duration-fast); }
.data-table tbody tr:hover { background: var(--surface-overlay); }
.data-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
  font-size: var(--text-sm); vertical-align: middle; color: var(--text-primary);
}
.data-table tbody tr:last-child td { border-bottom: none; }

/* Row state variants */
.data-table tbody tr.row-error   { background: var(--critical-bg); }
.data-table tbody tr.row-warning { background: var(--warning-bg); }
.data-table tbody tr.row-selected{ background: var(--primary-bg); border-left: 3px solid var(--primary); }

/* Mono cell (IDs, codes) */
.data-table td.cell-mono { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted); }
```

### 9.6 Badges

```css
.badge {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: 3px 10px; border-radius: var(--radius-sm);
  font-size: var(--text-xs); font-weight: 600;
  text-transform: capitalize; white-space: nowrap;
  border: 1px solid transparent;
}
.badge-pill { border-radius: var(--radius-full); padding: 2px 8px; }

/* Status variants */
.badge-active     { background: var(--success-bg); color: var(--success); border-color: var(--success-border); }
.badge-inactive   { background: var(--surface-overlay); color: var(--text-muted); border-color: var(--border-default); }
.badge-draft      { background: var(--surface-overlay); color: var(--text-muted); border-color: var(--border-default); }
.badge-archived   { background: var(--surface-overlay); color: var(--text-ghost); border-color: var(--border-default); }
.badge-error      { background: var(--critical-bg); color: var(--critical); border-color: var(--critical-border); }
.badge-warning    { background: var(--warning-bg); color: var(--warning); border-color: var(--warning-border); }
.badge-running    { background: var(--info-bg); color: var(--info); border-color: var(--info-border); }
.badge-queued     { background: var(--surface-overlay); color: var(--text-muted); border-color: var(--border-default); }
.badge-pending    { background: var(--warning-bg); color: var(--warning); border-color: var(--warning-border); }
.badge-success    { background: var(--success-bg); color: var(--success); border-color: var(--success-border); }
```

### 9.7 Status Dot

```css
.status-dot {
  width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0;
}
.status-dot.success { background: var(--success); box-shadow: 0 0 6px var(--success-glow); }
.status-dot.warning { background: var(--warning); box-shadow: 0 0 6px var(--warning-glow); }
.status-dot.error   { background: var(--critical); box-shadow: 0 0 6px var(--critical-glow); }
.status-dot.info    { background: var(--info); box-shadow: 0 0 6px var(--info-glow); }
.status-dot.neutral { background: var(--text-ghost); }
.status-dot.pulse   { animation: subtlePulse 2s ease-in-out infinite; }
```

### 9.8 Alert Cards

```css
.alert-card {
  background: var(--surface-raised); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5);
  border-left: 4px solid var(--text-ghost);
  transition: all var(--duration-normal);
}
.alert-card:hover          { box-shadow: var(--shadow-lg); border-color: var(--border-hover); }
.alert-card.critical       { border-left-color: var(--critical); background: var(--critical-bg); border-color: var(--critical-border); }
.alert-card.warning        { border-left-color: var(--warning); background: var(--warning-bg); border-color: var(--warning-border); }
.alert-card.info           { border-left-color: var(--info); background: var(--info-bg); border-color: var(--info-border); }
.alert-card.success        { border-left-color: var(--success); background: var(--success-bg); border-color: var(--success-border); }
```

### 9.9 Modal

```css
.modal-overlay   { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: var(--blur-md); z-index: var(--z-modal-backdrop); }
.modal-container { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: min(560px, 90vw); z-index: var(--z-modal); background: var(--surface-raised); border: 1px solid var(--border-default); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-2xl); animation: fadeInScale var(--duration-slow) var(--ease-spring); }
.modal-header    { padding: var(--space-5); border-bottom: 1px solid var(--border-default); display: flex; align-items: center; justify-content: space-between; }
.modal-title     { font-family: var(--font-heading); font-size: var(--text-xl); font-weight: 600; color: var(--text-primary); }
.modal-body      { padding: var(--space-5); overflow-y: auto; max-height: 70vh; }
.modal-footer    { padding: var(--space-5); border-top: 1px solid var(--border-default); display: flex; gap: var(--space-3); justify-content: flex-end; }
```

**Large research modals (concept set editor, cohort builder):** `min(960px, 95vw)`, `max-height: 90vh`.

### 9.10 Toast Notification

```css
.toast {
  position: fixed; bottom: var(--space-6); right: var(--space-6);
  background: var(--sidebar-bg); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5);
  min-width: 280px; max-width: 400px;
  box-shadow: var(--shadow-lg);
  animation: slideInRight var(--duration-slow) var(--ease-spring);
  z-index: var(--z-toast);
}
.toast.success { border-color: var(--success); box-shadow: var(--shadow-lg), 0 0 20px var(--success-glow); }
.toast.error   { border-color: var(--critical); box-shadow: var(--shadow-lg), 0 0 20px var(--critical-glow); }
.toast.warning { border-color: var(--warning); box-shadow: var(--shadow-lg), 0 0 20px var(--warning-glow); }
.toast.info    { border-color: var(--info); box-shadow: var(--shadow-lg), 0 0 20px var(--info-glow); }
```

### 9.11 Progress Bar

Used for job progress, cohort generation, ETL pipeline steps.

```css
.progress-track {
  height: 6px; background: var(--surface-overlay); border-radius: var(--radius-full); overflow: hidden;
}
.progress-fill {
  height: 100%; background: var(--gradient-crimson); border-radius: var(--radius-full);
  transition: width var(--duration-slow) var(--ease-smooth);
}
.progress-fill.success  { background: var(--success); }
.progress-fill.warning  { background: var(--warning); }
.progress-fill.animated { animation: shimmer 1.5s linear infinite; background-size: 200% 100%; }
```

### 9.12 Empty State

```css
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: var(--space-12) var(--space-6); text-align: center; gap: var(--space-3);
}
.empty-state-icon  { font-size: var(--text-5xl); color: var(--text-ghost); }
.empty-state-title { font-family: var(--font-heading); font-size: var(--text-xl); color: var(--text-secondary); }
.empty-state-body  { font-size: var(--text-base); color: var(--text-muted); max-width: 360px; }
```

### 9.13 Skeleton Loader

```css
.skeleton {
  background: linear-gradient(90deg, var(--surface-overlay) 25%, var(--surface-elevated) 50%, var(--surface-overlay) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
  border-radius: var(--radius-sm);
}
.skeleton-text  { height: 14px; margin-bottom: 8px; }
.skeleton-title { height: 22px; width: 60%; margin-bottom: 16px; }
.skeleton-value { height: 48px; width: 40%; }
```

### 9.14 Code / SQL Block

```css
.code-block {
  background: var(--surface-darkest); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: var(--space-4);
  font-family: var(--font-mono); font-size: var(--text-sm);
  color: var(--text-secondary); overflow-x: auto;
  line-height: 1.6;
}
.code-inline {
  background: var(--surface-accent); border-radius: var(--radius-xs);
  padding: 2px 6px; font-family: var(--font-mono); font-size: 0.875em;
  color: var(--accent-light);
}
```

### 9.15 AI Chat Panel

Used in the MedGemma assistant sidebar/modal.

```css
.ai-panel {
  background: var(--surface-raised);
  border: 1px solid var(--info-border);
  border-radius: var(--radius-xl);
  box-shadow: 0 0 24px rgba(96, 165, 250, 0.10);
  display: flex; flex-direction: column; height: 100%;
}
.ai-panel-header { padding: var(--space-4); border-bottom: 1px solid var(--border-default); display: flex; align-items: center; gap: var(--space-3); }
.ai-panel-body   { flex: 1; overflow-y: auto; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
.ai-panel-footer { padding: var(--space-4); border-top: 1px solid var(--border-default); }

.ai-bubble-user  { align-self: flex-end; background: var(--primary-bg); border: 1px solid var(--primary-border); border-radius: var(--radius-xl) var(--radius-xl) var(--radius-xs) var(--radius-xl); padding: var(--space-3) var(--space-4); max-width: 80%; font-size: var(--text-sm); color: var(--text-primary); }
.ai-bubble-model { align-self: flex-start; background: var(--surface-overlay); border: 1px solid var(--border-default); border-radius: var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-xs); padding: var(--space-3) var(--space-4); max-width: 90%; font-size: var(--text-sm); color: var(--text-primary); }

/* Streaming cursor */
.ai-cursor::after { content: '▍'; animation: subtlePulse 0.8s ease-in-out infinite; color: var(--info); }
```

---

## 10. Page Specifications

### 10.1 Dashboard

**Purpose:** Executive overview of platform health and active research activity.

**Layout:** Full-width, no tabs.

```
┌─────────────────────────────────────────────────────────────────┐
│  METRIC ROW (5 cards — auto grid)                               │
│  [CDM Sources] [Active Cohorts] [Running Jobs] [DQD Failures]   │
│  [Pending Reviews]                                               │
├──────────────────────────────┬──────────────────────────────────┤
│  SOURCE HEALTH PANEL         │  ACTIVE JOBS PANEL               │
│  Table: source name, status, │  List: job name, type, progress  │
│  last sync, record count,    │  bar, elapsed, estimated time    │
│  DQD score                   │  remaining                       │
├──────────────────────────────┼──────────────────────────────────┤
│  RECENT COHORT ACTIVITY      │  AI ACTIVITY FEED                │
│  List: cohort name, count,   │  Recent AI ops: ETL suggestion,  │
│  last run, status badge      │  concept mapping, NLP result     │
└──────────────────────────────┴──────────────────────────────────┘
```

**Metric cards:** `--font-display` for large numbers. Semantic variants based on status (critical if DQD failures > 0, warning if jobs failed, success if all healthy).

### 10.2 Data Sources

**Purpose:** Manage CDM database connections and daimon configurations.

**Layout:** Tabs: `[Sources]` `[Daimons]` `[Connection Test]`

**Sources Tab:**
```
TOOLBAR: [+ Add Source] [Search...]  [Filter: All / Healthy / Degraded / Offline]

TABLE:
  Name | Type (PostgreSQL/MSSQL/Oracle) | CDM Version | Status | Last Ping | Actions
  ──────────────────────────────────────────────────────────────────────────────────
  • Inpatient CDM  | PostgreSQL | v5.4 | ● Healthy | 2m ago | [Test] [Edit] [⋮]
  • Claims DB      | MSSQL      | v5.3 | ● Degraded| 15m ago| [Test] [Edit] [⋮]
  × Legacy ODS     | Oracle     | v5.2 | ○ Offline | 2h ago | [Test] [Edit] [⋮]
```

**Add/Edit modal:** Multi-step: (1) Connection type, (2) Connection string + credentials, (3) Schema config (app/vocab/cdm/results), (4) Test + Save.

### 10.3 Data Ingestion (AI ETL)

**Purpose:** Upload CSV/flat files, let AI suggest OMOP mappings, review and publish.

**Layout:** Tabs: `[Upload]` `[Schema Maps]` `[Concept Maps]` `[Review Queue]` `[Pipelines]`

**Upload Tab:**
```
┌──────────────────────────────────────────────────────────┐
│  DRAG & DROP ZONE                                         │
│  (dashed border, surface-overlay bg, primary on hover)    │
│  Drop CSV / XLS / FHIR Bundle here, or click to browse   │
└──────────────────────────────────────────────────────────┘

RECENT UPLOADS TABLE:
  File | Size | Upload Date | Status | AI Confidence | Actions
```

**Review Queue Tab:** Side-by-side: source field → proposed OMOP concept. Confidence badge (color-coded). Accept / Reject / Edit actions. Bulk approve with filter.

### 10.4 Vocabulary (Athena Browser)

**Purpose:** Browse OMOP vocabulary, search concepts, manage concept sets.

**Layout:** Tabs: `[Search]` `[Hierarchy]` `[Concept Sets]`

**Search Tab:**
```
[Search bar — full width, prominent]
[Filter chips: All Domains / Condition / Drug / Measurement / ... ]
[Filter chips: All Vocabularies / SNOMED / RxNorm / LOINC / ICD-10 / ... ]

RESULTS TABLE:
  Concept ID (mono) | Concept Name | Domain | Vocabulary | Standard/Source | Valid
  ────────────────────────────────────────────────────────────────────────────────
  4308127  | Myocardial infarction | Condition | SNOMED | Standard ✓ | Valid
  ...

DETAIL PANEL (right side, 380px, slides in on row click):
  Concept ID: [4308127] (mono, copy button)
  Name: Myocardial infarction
  Domain: Condition
  Vocabulary: SNOMED
  Standard: Yes
  Class: Clinical Finding
  ─────────────────────
  Relationships: [tab: Parents] [tab: Children] [tab: Maps To]
  ─────────────────────
  [+ Add to Concept Set]
```

### 10.5 Cohort Definitions

**Purpose:** Build, manage, and run OMOP cohort definitions.

**Layout:** List view + detail view (split grid).

```
LEFT PANEL (cohort list):
  [+ New Cohort] [Search cohorts...]
  ─────────────────────────────────
  • Diabetes Mellitus T2          → [Active] 12,450 subjects  ▶
  • AF post-PCI patients          → [Draft]  —              ▶
  • MACE Outcomes Cohort 2024     → [Active] 3,211 subjects  ▶
  ...

RIGHT PANEL (cohort detail — when selected):
  Tabs: [Definition] [Characterization] [Incidence] [Export]

  Definition Tab:
    Entry Events / Inclusion Rules / Exit Criteria (accordion)
    Each rule shows: domain, concept set name, timing, negation
    [Run Cohort] [Generate Stats] [Export JSON]
```

**Concept set picker:** Full-screen modal with vocabulary search embedded. Supports multi-select. Concept list shown with ID + name + standard badge.

### 10.6 Data Explorer (Ares Replacement)

**Purpose:** Data quality, characterization, and population statistics for each CDM source.

**Layout:** Source selector dropdown (topbar), then Tabs: `[Overview]` `[Achilles]` `[DQD]` `[Population]`

**DQD Tab:**
```
SUMMARY BAR:
  [Passed: 1,203] [Warning: 47] [Failed: 12] [N/A: 89]  ← colored metric cells

FILTER: [All] [Failed] [Warning] [By Check Category ▾] [By CDM Table ▾]

DQD TABLE:
  Check Name | Category | CDM Table | Field | Threshold | Actual | Status
  ────────────────────────────────────────────────────────────────────────
  measureValueCompleteness | Completeness | person | gender_concept_id | >0.95 | 0.99 | ● Pass
  measurePersonCompleteness | Completeness | drug_exposure | person_id | >0.95 | 0.91 | ⚠ Warn
  plausibleValueLow | Plausibility | measurement | value_as_number | ... | | ✗ Fail
```

**Achilles Tab:** Charts for concept frequency distributions, temporal trends, data density heatmaps.

### 10.7 Analyses

**Purpose:** Run HADES analyses (characterizations, incidence rates, pathways, PLE, PLP).

**Layout:** Tabs: `[Characterization]` `[Incidence Rates]` `[Pathways]` `[Patient-Level Estimation]` `[Population-Level Estimation]`

Each tab follows: Config panel (inputs) + Results panel (outputs after job completes). Run button triggers Horizon job, progress shown in-page via WebSocket.

**PLE Tab example:**
```
CONFIG PANEL:
  Target Cohort: [select...] Comparator Cohort: [select...]
  Outcome Cohort: [select...]
  Analysis Method: [IPTW / Matching / ...▾]
  Time-at-risk: Start [0] days after [entry ▾] End [365] days after [entry ▾]
  [Run Analysis]

RESULTS PANEL (after job):
  Diagnostics: [Covariate Balance tab] [KM Curves tab] [PS Distribution tab]
  Effect Estimate: HR: 1.23 (95% CI: 1.08–1.40) p=0.002
  Forest Plot: [D3 visualization]
```

### 10.8 Studies (Strategus Replacement)

**Purpose:** Orchestrate multi-analysis research studies across CDM sources.

**Layout:** Tabs: `[Studies]` `[Modules]` `[Executions]`

Studies list: Card grid (not table) — each card shows study name, author, sources, status badge, last run date. Card hover: gold border lift.

### 10.9 Patient Profiles

**Purpose:** Individual OMOP person record explorer.

**Layout:** Search bar (prominent), then person detail split: Timeline (left), structured data (right).

**Timeline:** D3 swim-lane chart across OMOP domains (Conditions, Drugs, Measurements, Visits). Events as colored dots by domain. Zoom/pan. Hover tooltip.

### 10.10 Jobs

**Purpose:** Monitor Horizon queue — all background jobs.

**Layout:** No tabs. Filter chips: `[All]` `[Running]` `[Failed]` `[Completed]`

```
TABLE:
  Job | Type | Source | Triggered By | Started | Duration | Status
  ───────────────────────────────────────────────────────────────────
  Cohort Generation | cohort_gen | Inpatient CDM | admin | 2m ago | 0:02:14 | ● Running [=====>    ]
  DQD Evaluation    | dqd        | Claims DB     | admin | 1h ago | 0:12:45 | ✓ Complete
  ...

Row click → drawer: full log output (`.code-block`), step breakdown, retry button if failed.
```

### 10.11 Administration

**Purpose:** Users, roles, permissions, vocabulary management, system config.

**Layout:** Tabs: `[Users]` `[Roles & Permissions]` `[Vocabularies]` `[Configuration]`

Standard CRUD tables for users and roles. Vocabulary tab shows download history and CDM vocabulary version per source.

---

## 11. Data Visualization

### 11.1 Design Principles

- **Background:** `--surface-base` or `--surface-raised` — never white.
- **Axes/Grids:** `--border-default` for grid lines, `--text-ghost` for axis labels.
- **Text:** `--text-muted` for axis titles, `--text-secondary` for tick labels, `--font-mono` for numeric ticks.
- **Tooltips:** `--surface-elevated` background, `--border-default` border, `--radius-md`, `--shadow-lg`.
- **Legend:** Horizontal below chart, `--text-sm`, color dot + label.

### 11.2 Chart Color Palette

Sequential (for continuous data):
```
Primary range:  var(--primary-dark)  →  var(--primary-lighter)  [crimson ramp]
Neutral range:  var(--text-ghost)    →  var(--text-primary)      [ivory ramp]
```

Categorical (up to 8 series):
```
Series 1: var(--primary)         #9B1B30
Series 2: var(--info)            #60A5FA
Series 3: var(--success)         #2DD4BF
Series 4: var(--warning)         #E5A84B
Series 5: var(--accent)          #C9A227
Series 6: #A78BFA  (purple)
Series 7: #F472B6  (pink)
Series 8: var(--text-muted)      #8A857D  (neutral last)
```

### 11.3 Chart Inventory

| Chart Type | Library | Usage |
|-----------|---------|-------|
| Kaplan-Meier survival | D3 v7 | PLE/PLP outcomes |
| Forest plot | D3 v7 | Meta-analysis, HR estimates |
| ROC curve | D3 v7 | PLP model performance |
| Calibration plot | D3 v7 | PLP |
| Attrition waterfall | D3 v7 | Cohort inclusion/exclusion |
| Sankey diagram | D3 v7 | Treatment pathways |
| Treemap | D3 v7 | Concept frequency |
| Sunburst | D3 v7 | Vocabulary hierarchy |
| Box plot | D3 v7 | Covariate distributions |
| Histogram | Recharts | Propensity score distribution |
| Line chart | Recharts | Temporal trends, incidence rates |
| Bar chart | Recharts | Characterization, concept frequencies |
| Donut / Pie | Recharts | DQD summary, domain breakdown |
| Scatter plot | Recharts | Covariate balance, PS diagnostics |
| Heatmap (D3) | D3 v7 | Achilles data density, patient timeline |
| Population pyramid | D3 v7 | Age/sex distribution |
| UpSet plot | D3 v7 | Cohort intersection analysis |

### 11.4 Empty / Loading Chart States

**Loading:** Skeleton placeholder matching chart dimensions + animated shimmer.

**No data:** Empty state centered in chart area — icon + "No data available for this configuration" + hint text.

**Insufficient n:** Warning strip above chart — "⚠ Cell count suppressed (n < 10). Results hidden for privacy."

---

## 12. Status & Domain Semantics

### 12.1 OMOP Domain Color Coding

Used in patient timeline and data characterization visualizations.

```
Condition:      var(--primary)      crimson
Drug Exposure:  var(--info)         blue
Measurement:    var(--success)      teal
Visit:          var(--accent)       gold
Observation:    #A78BFA             purple
Procedure:      #F472B6             pink
Device:         #FB923C             orange
Death:          var(--critical)     red (special, critical severity)
```

### 12.2 Concept Standard Status

```
Standard:     badge-success   "Standard ✓"
Classification: badge-warning "Classification"
Non-standard: badge-inactive  "Non-standard"
```

### 12.3 Job Type Icons

Use Lucide React icons — consistent, crisp at 16–20px.

```
cohort_gen:        UsersRound
achilles:          BarChart2
dqd:               ShieldCheck
ple / plp:         FlaskConical
pathways:          GitFork
vocabulary_load:   BookOpen
etl_ingest:        Upload
concept_mapping:   Wand2
ai_chat:           Sparkles
```

### 12.4 Data Source Type Icons

```
PostgreSQL:     Database (blue tint)
MSSQL:          Database (orange tint)
Oracle:         Database (red tint)
BigQuery:       Cloud
AlloyDB:        CloudCog
Spanner:        Layers
```

---

## 13. Accessibility Standards

### 13.1 Color Contrast

- Primary text on `--surface-base`: 12.5:1 (WCAG AAA ✓)
- Secondary text on `--surface-raised`: 7.2:1 (WCAG AA ✓)
- Muted text: 4.6:1 (WCAG AA ✓ for large text)
- All interactive element labels: AA minimum required

Never rely on color alone — always pair with icon, text label, or pattern.

### 13.2 Focus Management

- All interactive elements: gold focus ring (`var(--focus-ring)`) on `:focus-visible`
- Tab order follows visual DOM order
- Modal opens: focus moves to modal header / first interactive element
- Modal closes: focus returns to trigger element
- Keyboard shortcut: `/` for global search, `Escape` to close modal/drawer

### 13.3 Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 13.4 Minimum Touch/Click Targets

- All buttons: `min-height: 32px; min-width: 32px`
- Table rows: `min-height: 44px` on interactive rows
- Nav items: `min-height: 40px`

### 13.5 Screen Reader Support

- All icon-only buttons: `aria-label` required
- Status dots and badges: `aria-label` or visually-hidden text
- Charts: `aria-label` on SVG + summary table as fallback
- Loading states: `aria-busy="true"` on affected containers

---

## 14. Implementation Roadmap

### Phase 2 — Core Design System (CSS Tokens + Component Library)

**Step 1: Design Tokens**
- Rewrite `frontend/src/index.css` with all CSS variables from this document
- Remove placeholder shadcn-style variables; replace with MindLog-derived dark theme
- Add `@theme inline` block to expose all tokens to Tailwind v4

**Step 2: CSS Component Files**

Create `frontend/src/styles/` directory mirroring MindLog structure:
```
styles/
  tokens-base.css      ← typography, spacing, radius, z-index, animations
  tokens-dark.css      ← all color variables (from Section 2)
  components/
    layout.css         ← AppShell, sidebar, topbar, content area
    navigation.css     ← nav items, tab bar, breadcrumb
    cards.css          ← panel, metric-card, stat-grid
    tables.css         ← data-table, pagination
    forms.css          ← inputs, buttons, search, filter-chips
    badges.css         ← badge variants, status dot, domain colors
    alerts.css         ← alert-card, toast
    modals.css         ← modal, drawer
    charts.css         ← chart container, tooltip, legend, empty states
    ai.css             ← ai-panel, bubbles, cursor
```

**Step 3: React Component Library**

Build reusable TypeScript components in `frontend/src/components/ui/`:
```
Button.tsx          Panel.tsx          MetricCard.tsx
Badge.tsx           StatusDot.tsx      AlertCard.tsx
DataTable.tsx       Modal.tsx          Toast.tsx
FormInput.tsx       SearchBar.tsx      FilterChip.tsx
Progress.tsx        Skeleton.tsx       EmptyState.tsx
CodeBlock.tsx       Tabs.tsx           Breadcrumb.tsx
AiPanel.tsx         JobStatusRow.tsx   SourceHealthRow.tsx
```

All components: TypeScript props with strict types, `cn()` for class merging, `forwardRef` where needed.

**Step 4: AppShell Rebuild**

Rebuild `MainLayout.tsx`, `Sidebar.tsx`, `Header.tsx` per Section 7 specification.

**Step 5: Feature Pages**

Implement pages in priority order:
1. Dashboard (Section 10.1) — high visibility, establishes design language
2. Data Sources (Section 10.2) — required for all other features
3. Jobs (Section 10.10) — needed immediately for job monitoring
4. Vocabulary / Cohort Definitions (Sections 10.4–10.5) — core research workflow
5. Data Explorer (Section 10.6) — Ares replacement
6. Analyses (Section 10.7) — highest complexity, D3 heavy
7. Data Ingestion / AI (Section 10.3) — AI ETL feature
8. Studies (Section 10.8)
9. Patient Profiles (Section 10.9)
10. Administration (Section 10.11)

### Font Loading

Add to `frontend/index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&family=Source+Serif+4:wght@400;600&family=Source+Sans+3:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Icon Library

Use **Lucide React** (already installed). Maintain consistent sizing:
- Sidebar nav: `size={18}`
- Topbar actions: `size={18}`
- Table actions: `size={15}`
- Badges/inline: `size={12}`

Do **not** mix in emoji icons (MindLog pattern — omit for Parthenon; use Lucide exclusively for consistency and accessibility).

---

*End of DESIGNLOG.md*

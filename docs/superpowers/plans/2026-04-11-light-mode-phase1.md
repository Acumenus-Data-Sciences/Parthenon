# Light Mode (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working light mode with explicit toggle, localStorage persistence, and smooth transition — covering the ~85% of the UI that uses CSS variables.

**Architecture:** Create `tokens-light.css` that overrides CSS variables under `html.light`. A Zustand `themeStore` manages the `dark | light` preference and syncs it to localStorage + the HTML class. A flash-prevention inline script in `index.html` applies the class before React loads. A `ThemeToggle` button in the header provides sun/moon toggle.

**Tech Stack:** Tailwind CSS v4 (CSS variables via `@theme inline`), Zustand, Lucide React icons, localStorage

**Design spec:** `docs/superpowers/specs/2026-04-11-light-mode-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/styles/tokens-light.css` | Light palette CSS variable overrides under `html.light` |
| Create | `frontend/src/stores/themeStore.ts` | Theme state (`dark`/`light`), toggle action, localStorage sync |
| Create | `frontend/src/components/layout/ThemeToggle.tsx` | Sun/moon icon button for the header |
| Modify | `frontend/src/index.css` | Import `tokens-light.css`, add transition to `html` |
| Modify | `frontend/index.html` | Flash-prevention inline script |
| Modify | `frontend/src/components/layout/Header.tsx` | Add `ThemeToggle` to topbar actions |

---

### Task 1: Create the light theme token file

**Files:**
- Create: `frontend/src/styles/tokens-light.css`

- [ ] **Step 1: Create `tokens-light.css`**

This file overrides every CSS variable from `tokens-dark.css` under the `html.light` selector. All variable names are identical — only values change.

```css
/* ============================================================
   Light Mode — Warm Parchment + Deeper Brand Colors
   ============================================================ */

html.light {
  /* 2.1 Primary — Deeper Crimson for light backgrounds */
  --primary:          #7A1526;
  --primary-light:    #9B1B30;
  --primary-dark:     #5A1020;
  --primary-lighter:  #B82D42;
  --primary-glow:     rgba(122, 21, 38, 0.25);
  --primary-bg:       rgba(122, 21, 38, 0.10);
  --primary-border:   rgba(155, 27, 48, 0.30);

  /* 2.2 Accent — Deeper Gold */
  --accent:           #8B7018;
  --accent-dark:      #6B5510;
  --accent-light:     #A68B1F;
  --accent-lighter:   #C9A227;
  --accent-muted:     #6B5510;
  --accent-pale:      rgba(139, 112, 24, 0.12);
  --accent-bg:        rgba(139, 112, 24, 0.08);
  --accent-glow:      rgba(139, 112, 24, 0.20);
  --focus-ring:       0 0 0 3px var(--accent-pale);

  /* 2.3 Surfaces — Warm Parchment Stack */
  --surface-darkest:   #E0DCD6;
  --surface-base:      #F5F3EF;
  --surface-raised:    #FFFFFF;
  --surface-overlay:   #F0EDE7;
  --surface-elevated:  #E8E4DD;
  --surface-accent:    #DDD8D0;
  --surface-highlight: #D0CAC0;

  --sidebar-bg:        #EAE6DF;
  --sidebar-bg-light:  #F0EDE7;

  /* 2.4 Text — Dark Scale */
  --text-primary:   #1A1816;
  --text-secondary: #4A4540;
  --text-muted:     #7A756D;
  --text-ghost:     #B0A89E;
  --text-disabled:  #C5C0B8;

  /* 2.5 Semantic — Richer for light backgrounds */
  --critical:        #C93545;
  --critical-dark:   #A82A38;
  --critical-light:  #E85A6B;
  --critical-bg:     rgba(201, 53, 69, 0.12);
  --critical-border: rgba(201, 53, 69, 0.25);
  --critical-glow:   rgba(201, 53, 69, 0.15);

  --warning:         #B88530;
  --warning-dark:    #966B20;
  --warning-light:   #D4A040;
  --warning-bg:      rgba(184, 133, 48, 0.12);
  --warning-border:  rgba(184, 133, 48, 0.25);
  --warning-glow:    rgba(184, 133, 48, 0.15);

  --success:         #1A9985;
  --success-dark:    #148070;
  --success-light:   #20B8A5;
  --success-bg:      rgba(26, 153, 133, 0.12);
  --success-border:  rgba(26, 153, 133, 0.25);
  --success-glow:    rgba(26, 153, 133, 0.15);

  --info:            #2563EB;
  --info-dark:       #1D4FBF;
  --info-light:      #3B82F6;
  --info-bg:         rgba(37, 99, 235, 0.10);
  --info-border:     rgba(37, 99, 235, 0.25);
  --info-glow:       rgba(37, 99, 235, 0.15);

  /* 2.7 Borders */
  --border-default: #D0CAC0;
  --border-subtle:  rgba(208, 202, 192, 0.60);
  --border-hover:   #8B7018;
  --border-focus:   #8B7018;
  --border-active:  #7A1526;

  /* 2.8 Glassmorphism — inverted for light */
  --glass-00: rgba(0, 0, 0, 0.02);
  --glass-01: rgba(0, 0, 0, 0.04);
  --glass-02: rgba(0, 0, 0, 0.06);
  --glass-03: rgba(0, 0, 0, 0.08);
  --glass-04: rgba(0, 0, 0, 0.10);
  --glass-05: rgba(0, 0, 0, 0.14);
  --glass-dark-00: rgba(0, 0, 0, 0.04);
  --glass-dark-01: rgba(0, 0, 0, 0.08);
  --glass-dark-02: rgba(0, 0, 0, 0.12);

  /* 2.9 Gradients — light variants */
  --gradient-panel:        linear-gradient(135deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.01) 100%);
  --gradient-panel-raised: linear-gradient(135deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.01) 100%);
  --gradient-panel-inset:  linear-gradient(135deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 100%);
  --gradient-crimson:      linear-gradient(135deg, var(--primary), var(--primary-dark));
  --gradient-gold:         linear-gradient(135deg, var(--accent-light), var(--accent-dark));

  /* OMOP Domain Colors — deeper for light backgrounds */
  --domain-condition:    #7A1526;
  --domain-drug:         #2563EB;
  --domain-measurement:  #1A9985;
  --domain-visit:        #8B7018;
  --domain-observation:  #7C3AED;
  --domain-procedure:    #DB2777;
  --domain-device:       #EA580C;
  --domain-death:        #C93545;

  /* Chart Categorical */
  --chart-1: var(--primary);
  --chart-2: var(--info);
  --chart-3: var(--success);
  --chart-4: var(--warning);
  --chart-5: var(--accent);
  --chart-6: #7C3AED;
  --chart-7: #DB2777;
  --chart-8: var(--text-muted);
}
```

- [ ] **Step 2: Verify the file has no syntax errors**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`

Expected: No new errors (CSS files aren't checked by tsc, but this verifies nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/tokens-light.css
git commit -m "feat: add light mode CSS token file with warm parchment palette"
```

---

### Task 2: Wire the light token import and add transition

**Files:**
- Modify: `frontend/src/index.css:1-3` (add import)
- Modify: `frontend/src/index.css:79-81` (add transition to `html`)

- [ ] **Step 1: Add the `tokens-light.css` import**

In `frontend/src/index.css`, add the import after line 3 (`tokens-dark.css`):

```css
@import "./styles/tokens-light.css";
```

The import order becomes:
```
@import "tailwindcss";
@import "./styles/tokens-base.css";
@import "./styles/tokens-dark.css";
@import "./styles/tokens-light.css";
@import "./styles/components/layout.css";
...
```

- [ ] **Step 2: Add smooth transition to `html` rule**

In `frontend/src/index.css`, find the `html` rule (line 79-81):

```css
html {
  font-size: 16px;
}
```

Change it to:

```css
html {
  font-size: 16px;
  transition: background-color 200ms ease, color 200ms ease;
}
```

- [ ] **Step 3: Verify build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build`

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: import light tokens and add theme transition to html"
```

---

### Task 3: Create the theme store

**Files:**
- Create: `frontend/src/stores/themeStore.ts`

- [ ] **Step 1: Create `themeStore.ts`**

```typescript
import { create } from "zustand";

type Theme = "dark" | "light";

const STORAGE_KEY = "parthenon-theme";

function applyThemeClass(theme: Theme): void {
  if (theme === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light") return "light";
  } catch {
    // localStorage unavailable (SSR, private browsing quota)
  }
  return "dark";
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: getStoredTheme(),
  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // quota exceeded — toggle still works for the session
      }
      applyThemeClass(next);
      return { theme: next };
    }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/themeStore.ts
git commit -m "feat: add theme store with localStorage persistence"
```

---

### Task 4: Add flash-prevention script to index.html

**Files:**
- Modify: `frontend/index.html:13-14` (insert script before `</head>`)

- [ ] **Step 1: Add inline script**

In `frontend/index.html`, insert before the closing `</head>` tag (after line 12, before line 13):

```html
    <script>
      (function(){if(localStorage.getItem('parthenon-theme')==='light'){document.documentElement.classList.add('light')}})();
    </script>
```

The resulting `<head>` ends:

```html
    <link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">
    <script>
      (function(){if(localStorage.getItem('parthenon-theme')==='light'){document.documentElement.classList.add('light')}})();
    </script>
  </head>
```

- [ ] **Step 2: Verify build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat: add flash-prevention script for light mode"
```

---

### Task 5: Create the ThemeToggle component

**Files:**
- Create: `frontend/src/components/layout/ThemeToggle.tsx`

- [ ] **Step 1: Create `ThemeToggle.tsx`**

```tsx
import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isLight = theme === "light";

  return (
    <button
      className="btn btn-ghost btn-icon btn-sm"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      {isLight ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/ThemeToggle.tsx
git commit -m "feat: add ThemeToggle sun/moon icon button component"
```

---

### Task 6: Add ThemeToggle to the Header

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx:6` (add import)
- Modify: `frontend/src/components/layout/Header.tsx:218-226` (add toggle before Bell button)

- [ ] **Step 1: Add import**

In `frontend/src/components/layout/Header.tsx`, add this import after line 6 (the Lucide imports):

```typescript
import { ThemeToggle } from "./ThemeToggle";
```

- [ ] **Step 2: Add ThemeToggle to the topbar actions**

In `frontend/src/components/layout/Header.tsx`, find the Notifications bell button (lines 219-225):

```tsx
            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={18} />
            </button>
```

Insert the `ThemeToggle` component **before** this button:

```tsx
            <ThemeToggle />

            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={18} />
            </button>
```

- [ ] **Step 3: Verify TypeScript and build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit && npx vite build`

Expected: Both pass with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Header.tsx
git commit -m "feat: add theme toggle button to header topbar"
```

---

### Task 7: Visual audit and fix — scrollbar and selection colors

**Files:**
- Modify: `frontend/src/index.css:112-131` (scrollbar and selection rules)

The existing scrollbar and selection styles use CSS variables and will work automatically. However, verify by inspection:

- [ ] **Step 1: Start the dev server and test**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite --host 0.0.0.0 --port 5175`

Open `http://localhost:5175` in a browser.

- [ ] **Step 2: Toggle to light mode**

Click the sun icon in the top bar. Verify:
- Background changes to warm parchment (#F5F3EF)
- Text changes to dark (#1A1816)
- Sidebar changes to warm grey (#EAE6DF)
- Cards/panels are white (#FFFFFF)
- Crimson and gold brand colors are visible and legible
- Scrollbar thumb is visible on light background
- Text selection uses crimson tint

- [ ] **Step 3: Toggle back to dark mode**

Click the moon icon. Verify everything returns to the dark theme exactly as before.

- [ ] **Step 4: Refresh the page**

Verify the chosen theme persists across page reloads (localStorage).

- [ ] **Step 5: Test with localStorage cleared**

Open DevTools → Application → Local Storage → clear `parthenon-theme`. Refresh. Verify app defaults to dark mode.

- [ ] **Step 6: If any issues found, fix them**

Common issues to watch for:
- Scrollbar thumb invisible on light background → scrollbar-thumb already uses `--border-default` which maps to `#D0CAC0` in light — should be visible
- Selection color too subtle → `--primary-bg` is `rgba(122, 21, 38, 0.10)` in light — may need bumping to `0.15`
- Any hardcoded `bg-[#0E0E11]` or `text-[#F0EDE8]` in layout components → replace with CSS variable equivalents

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: visual adjustments for light mode scrollbar and selection"
```

(Skip this step if no fixes were needed.)

---

### Task 8: Final verification — full build and type check

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 2: Run production build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build`

Expected: Build succeeds.

- [ ] **Step 3: Deploy to production**

Run: `cd /home/smudoshi/Github/Parthenon && ./deploy.sh --frontend`

Expected: Frontend rebuilt and served at https://parthenon.acumenus.net

- [ ] **Step 4: Verify on production**

Open https://parthenon.acumenus.net and toggle between dark and light mode. Verify:
- Toggle works
- Preference persists across refreshes
- No flash of wrong theme on load
- App shell, sidebar, modals, forms, tables render correctly in both modes

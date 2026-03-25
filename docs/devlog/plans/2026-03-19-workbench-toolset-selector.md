# Workbench Toolset Selector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Workbench page from a FinnGen-specific tool into a toolset selection gateway where users pick from novel capability modules (FinnGen, Morpheus, future SDK tools) — and remove the dead Aqueduct code.

**Architecture:** The `/workbench` route becomes a launcher page showing available toolsets as cards. Selecting a toolset navigates to `/workbench/:toolsetSlug` which renders the toolset's dedicated page. FinnGen moves from being "the workbench" to being one toolset within it. Aqueduct is fully removed (frontend + backend + migrations). The Community SDK Demo page is preserved and linked from the launcher as documentation for third-party toolset authors.

**Tech Stack:** React 19, TypeScript, React Router (lazy loading), Tailwind 4, Zustand, TanStack Query, Parthenon dark clinical theme (#0E0E11 base, #9B1B30 crimson, #C9A227 gold, #2DD4BF teal)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/features/workbench/pages/WorkbenchLauncherPage.tsx` | Toolset selection gateway — grid of toolset cards |
| `frontend/src/features/workbench/types.ts` | `ToolsetDescriptor` type: slug, name, description, icon, status, route |
| `frontend/src/features/workbench/toolsets.ts` | Registry of available toolsets (static array of `ToolsetDescriptor`) |
| `frontend/src/features/workbench/components/ToolsetCard.tsx` | Individual toolset card component (click navigates or shows "coming soon") |

### Modified Files
| File | Changes |
|------|---------|
| `frontend/src/app/router.tsx` | Reroute `/workbench` → `WorkbenchLauncherPage`, nest toolset routes under `/workbench/finngen`, remove `/workbench/aqueduct` |
| `frontend/src/components/layout/Sidebar.tsx` | No changes needed — already links to `/workbench` |
| `frontend/src/features/finngen/pages/FinnGenToolsPage.tsx` | Remove the Toolset dropdown and Aqueduct promotion card (FinnGen is now accessed via launcher) |

### Deleted Files (Aqueduct removal)
| File | Reason |
|------|--------|
| `frontend/src/features/aqueduct/pages/AqueductPage.tsx` | Dead — Aqueduct deprecated |
| `frontend/src/features/aqueduct/components/LookupGeneratorTab.tsx` | Dead |
| `frontend/src/features/aqueduct/components/LookupPreview.tsx` | Dead |
| `frontend/src/features/aqueduct/api.ts` | Dead |
| `frontend/src/features/aqueduct/types.ts` | Dead |
| `backend/app/Http/Controllers/Api/V1/AqueductController.php` | Dead |
| `backend/app/Services/Aqueduct/AqueductService.php` | Dead |
| `backend/app/Services/Aqueduct/AqueductLookupGeneratorService.php` | Dead |
| `backend/app/Models/App/AqueductRun.php` | Dead |
| `backend/app/Models/App/AqueductSession.php` | Dead |
| `backend/app/Http/Requests/Aqueduct/AqueductGenerateLookupsRequest.php` | Dead |
| `backend/tests/Feature/Api/V1/AqueductLookupGeneratorTest.php` | Dead |
| `backend/database/migrations/2026_03_17_000001_create_aqueduct_sessions_table.php` | Dead (table never populated in production) |
| `backend/database/migrations/2026_03_17_000002_create_aqueduct_runs_table.php` | Dead (table never populated in production) |

### Preserved Files (no changes)
| File | Note |
|------|------|
| `frontend/src/features/community-workbench-sdk/` | SDK demo stays — linked from launcher as "Build a Toolset" |
| `frontend/src/features/finngen/` (all except FinnGenToolsPage header) | FinnGen internals unchanged |

---

## Phase 1: Aqueduct Removal (clean slate)

### Task 1: Remove Aqueduct frontend

**Files:**
- Delete: `frontend/src/features/aqueduct/` (entire directory)
- Modify: `frontend/src/app/router.tsx:310-316` (remove aqueduct route)

- [ ] **Step 1: Delete the Aqueduct feature directory**

```bash
rm -rf frontend/src/features/aqueduct
```

- [ ] **Step 2: Remove the Aqueduct route from router.tsx**

In `frontend/src/app/router.tsx`, remove the route block:
```typescript
// DELETE this block (~lines 310-316):
{
  path: "workbench/aqueduct",
  lazy: () =>
    import("@/features/aqueduct/pages/AqueductPage").then(
      (m) => ({ Component: m.default }),
    ),
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors related to aqueduct imports

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src/features/aqueduct frontend/src/app/router.tsx
git commit -m "chore: remove Aqueduct frontend (deprecated in favor of native ingestion tools)"
```

---

### Task 2: Remove entire Aqueduct backend (files, routes, controller references)

**Files:**
- Delete: `backend/app/Http/Controllers/Api/V1/AqueductController.php`
- Delete: `backend/app/Services/Aqueduct/` (entire directory)
- Delete: `backend/app/Models/App/AqueductRun.php`
- Delete: `backend/app/Models/App/AqueductSession.php`
- Delete: `backend/app/Http/Requests/Aqueduct/AqueductGenerateLookupsRequest.php`
- Delete: `backend/tests/Feature/Api/V1/AqueductLookupGeneratorTest.php`
- Delete: `backend/database/migrations/2026_03_17_000001_create_aqueduct_sessions_table.php`
- Delete: `backend/database/migrations/2026_03_17_000002_create_aqueduct_runs_table.php`
- Modify: `backend/routes/api.php` (remove aqueduct route group + `use` import)
- Modify: `backend/app/Http/Controllers/Api/V1/StudyAgentController.php` (remove AqueductService dependency from `services()` method)

**IMPORTANT:** All Aqueduct references must be removed in the same commit to avoid a broken intermediate state. `StudyAgentController::services()` injects `AqueductService` at line 63 and calls `$aqueductService->serviceEntry()` at line 86 — these must be removed alongside the service class deletion.

- [ ] **Step 1: Delete Aqueduct backend files**

```bash
rm -f backend/app/Http/Controllers/Api/V1/AqueductController.php
rm -rf backend/app/Services/Aqueduct
rm -f backend/app/Models/App/AqueductRun.php
rm -f backend/app/Models/App/AqueductSession.php
rm -rf backend/app/Http/Requests/Aqueduct
rm -f backend/tests/Feature/Api/V1/AqueductLookupGeneratorTest.php
rm -f backend/database/migrations/2026_03_17_000001_create_aqueduct_sessions_table.php
rm -f backend/database/migrations/2026_03_17_000002_create_aqueduct_runs_table.php
```

- [ ] **Step 2: Remove AqueductService from StudyAgentController**

In `backend/app/Http/Controllers/Api/V1/StudyAgentController.php`:
1. Remove the `use App\Services\Aqueduct\AqueductService;` import (~line 15)
2. Remove the `AqueductService $aqueductService` parameter from the `services()` method signature (~line 63)
3. Remove the `$services = $this->appendServiceEntry($services, $aqueductService->serviceEntry());` call (~line 86)

**Note:** This changes the `/study-agent/services` API response — Aqueduct will no longer appear in the service registry. The frontend FinnGen page only filters for `finngen_*` prefixed services, so this is safe.

- [ ] **Step 3: Remove Aqueduct route group from api.php**

In `backend/routes/api.php`, find and remove:
1. The `use App\Http\Controllers\Api\V1\AqueductController;` import
2. The entire Aqueduct route group (search for `etl/aqueduct` or `AqueductController`)

- [ ] **Step 4: Drop Aqueduct tables if they exist in the database**

Create a new migration to cleanly drop the tables:
```bash
cd backend && php artisan make:migration drop_aqueduct_tables
```

Migration content:
```php
public function up(): void
{
    Schema::dropIfExists('app.aqueduct_runs');
    Schema::dropIfExists('app.aqueduct_sessions');
}

public function down(): void
{
    // Intentionally empty — Aqueduct is permanently removed
}
```

- [ ] **Step 5: Verify PHPStan passes**

Run: `cd backend && vendor/bin/phpstan analyse`
Expected: No errors referencing Aqueduct classes

- [ ] **Step 6: Verify Pint formatting**

Run: `cd backend && vendor/bin/pint --test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A backend/
git commit -m "chore: remove Aqueduct backend (controller, service, models, routes, migrations, tests)"
```

---

## Phase 2: Workbench Launcher Foundation

### Task 3: Create toolset types and registry

**Files:**
- Create: `frontend/src/features/workbench/types.ts`
- Create: `frontend/src/features/workbench/toolsets.ts`

- [ ] **Step 1: Create the workbench feature directory**

```bash
mkdir -p frontend/src/features/workbench/pages frontend/src/features/workbench/components
```

- [ ] **Step 2: Create types.ts with ToolsetDescriptor**

Create `frontend/src/features/workbench/types.ts`:

```typescript
export type ToolsetStatus = "available" | "coming_soon" | "sdk_required";

export interface ToolsetDescriptor {
  /** URL slug — used in /workbench/:slug route */
  slug: string;
  /** Display name */
  name: string;
  /** One-line tagline shown on the card */
  tagline: string;
  /** 2-3 sentence description for the expanded card */
  description: string;
  /** Lucide icon name (rendered by the card) */
  icon: string;
  /** Accent color hex for the card border/glow */
  accent: string;
  /** Current availability */
  status: ToolsetStatus;
  /** Route path — null if coming_soon or sdk_required */
  route: string | null;
  /** Optional badge text (e.g. "MIMIC-IV", "StudyAgent") */
  badge?: string;
  /** Whether this toolset requires VITE_STUDY_AGENT_ENABLED */
  requiresStudyAgent?: boolean;
}
```

- [ ] **Step 3: Create toolsets.ts registry**

Create `frontend/src/features/workbench/toolsets.ts`:

```typescript
import type { ToolsetDescriptor } from "./types";

export const TOOLSET_REGISTRY: ToolsetDescriptor[] = [
  {
    slug: "finngen",
    name: "FinnGen",
    tagline: "Population-scale genomic analysis pipeline",
    description:
      "Four-step workflow: CDM exploration via ROMOPAPI, HADES SQL rendering, cohort operations, and CO2 downstream analysis modules. Powered by the StudyAgent service registry.",
    icon: "Dna",
    accent: "#2DD4BF",
    status: "available",
    route: "/workbench/finngen",
    badge: "StudyAgent",
    requiresStudyAgent: true,
  },
  {
    slug: "morpheus",
    name: "Morpheus",
    tagline: "Inpatient outcomes & ICU analytics workbench",
    description:
      "ICU-focused analytics leveraging MIMIC-IV data in OMOP CDM 5.4. ABCDEF Liberation Bundle compliance, ventilator weaning prediction, sedation monitoring, and inpatient outcome research.",
    icon: "BedDouble",
    accent: "#9B1B30",
    status: "coming_soon",
    route: null,
    badge: "MIMIC-IV",
  },
  {
    slug: "sdk",
    name: "Build a Toolset",
    tagline: "Community SDK for third-party integrations",
    description:
      "Reference implementation and SDK documentation for building custom toolsets that plug into the Parthenon Workbench. Service descriptors, result envelopes, and artifact patterns.",
    icon: "Blocks",
    accent: "#C9A227",
    status: "available",
    route: "/workbench/community-sdk-demo",
  },
];
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no imports of these files yet, just type-checking the files themselves)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/workbench/types.ts frontend/src/features/workbench/toolsets.ts
git commit -m "feat(workbench): add ToolsetDescriptor type and toolset registry"
```

---

### Task 4: Create ToolsetCard component

**Files:**
- Create: `frontend/src/features/workbench/components/ToolsetCard.tsx`

- [ ] **Step 1: Create the ToolsetCard component**

Create `frontend/src/features/workbench/components/ToolsetCard.tsx`:

```typescript
import { useNavigate } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import type { ToolsetDescriptor } from "../types";

function getIcon(name: string): React.ElementType {
  const icons = LucideIcons as Record<string, React.ElementType>;
  return icons[name] ?? LucideIcons.Box;
}

interface ToolsetCardProps {
  toolset: ToolsetDescriptor;
}

export function ToolsetCard({ toolset }: ToolsetCardProps) {
  const navigate = useNavigate();
  const Icon = getIcon(toolset.icon);
  const isClickable = toolset.status === "available" && toolset.route;

  return (
    <button
      type="button"
      onClick={() => {
        if (isClickable && toolset.route) navigate(toolset.route);
      }}
      disabled={!isClickable}
      className={`group relative flex flex-col gap-4 rounded-2xl border p-6 text-left transition-all duration-200 ${
        isClickable
          ? "cursor-pointer border-zinc-700/60 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900/80 hover:shadow-lg"
          : "cursor-default border-zinc-800/40 bg-zinc-950/30 opacity-60"
      }`}
      style={
        isClickable
          ? ({ "--card-accent": toolset.accent } as React.CSSProperties)
          : undefined
      }
    >
      {/* Accent glow on hover */}
      {isClickable && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            boxShadow: `inset 0 0 0 1px ${toolset.accent}40, 0 0 20px ${toolset.accent}10`,
          }}
        />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${toolset.accent}15` }}
        >
          <Icon
            className="h-6 w-6"
            style={{ color: toolset.accent }}
          />
        </div>
        {toolset.badge && (
          <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {toolset.badge}
          </span>
        )}
      </div>

      {/* Name + tagline */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-100">{toolset.name}</h3>
        <p className="mt-1 text-sm text-zinc-400">{toolset.tagline}</p>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed text-zinc-500">
        {toolset.description}
      </p>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-2">
        {toolset.status === "available" ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Available
          </span>
        ) : toolset.status === "coming_soon" ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Coming Soon
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            SDK Required
          </span>
        )}
        {isClickable && (
          <LucideIcons.ArrowRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400" />
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/workbench/components/ToolsetCard.tsx
git commit -m "feat(workbench): add ToolsetCard component with accent glow and status badges"
```

---

### Task 5: Create WorkbenchLauncherPage

**Files:**
- Create: `frontend/src/features/workbench/pages/WorkbenchLauncherPage.tsx`

- [ ] **Step 1: Create the launcher page**

Create `frontend/src/features/workbench/pages/WorkbenchLauncherPage.tsx`:

```typescript
import { PanelsTopLeft } from "lucide-react";
import { TOOLSET_REGISTRY } from "../toolsets";
import { ToolsetCard } from "../components/ToolsetCard";

export default function WorkbenchLauncherPage() {
  const studyAgentEnabled =
    import.meta.env.VITE_STUDY_AGENT_ENABLED === "true";

  const visibleToolsets = TOOLSET_REGISTRY.filter(
    (t) => !t.requiresStudyAgent || studyAgentEnabled,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
            <PanelsTopLeft className="h-5 w-5 text-zinc-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Workbench</h1>
            <p className="text-sm text-zinc-500">
              Novel capabilities and research toolsets
            </p>
          </div>
        </div>
      </div>

      {/* Toolset Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleToolsets.map((toolset) => (
          <ToolsetCard key={toolset.slug} toolset={toolset} />
        ))}
      </div>

      {/* Footer hint */}
      <div className="mt-12 text-center">
        <p className="text-xs text-zinc-600">
          Want to build a custom toolset?{" "}
          <a
            href="/workbench/community-sdk-demo"
            className="text-[#C9A227] hover:underline"
          >
            View the Community SDK reference
          </a>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/workbench/pages/WorkbenchLauncherPage.tsx
git commit -m "feat(workbench): add WorkbenchLauncherPage with toolset grid"
```

---

## Phase 3: Routing Rewire

### Task 6: Update router to use launcher + nested toolset routes

**Files:**
- Modify: `frontend/src/app/router.tsx:279-322`

- [ ] **Step 1: Replace the workbench route block in router.tsx**

In `frontend/src/app/router.tsx`, find the StudyAgent conditional block (~line 280) and replace the workbench routes. The new structure:

```typescript
// ── Study Designer (OHDSI StudyAgent) ───────────────────────────────
...(import.meta.env.VITE_STUDY_AGENT_ENABLED === "true"
  ? [
      {
        path: "study-designer",
        lazy: () =>
          import("@/features/study-agent/pages/StudyDesignerPage").then(
            (m) => ({ Component: m.default }),
          ),
      },
    ]
  : []),
// ── Workbench (always available — individual toolsets gate themselves) ──
{
  path: "workbench",
  children: [
    {
      index: true,
      lazy: () =>
        import("@/features/workbench/pages/WorkbenchLauncherPage").then(
          (m) => ({ Component: m.default }),
        ),
    },
    {
      path: "finngen",
      lazy: () =>
        import("@/features/finngen/pages/FinnGenToolsPage").then(
          (m) => ({ Component: m.default }),
        ),
    },
    {
      path: "finngen/help",
      lazy: () =>
        import("@/features/finngen/pages/WorkbenchHelpPage").then(
          (m) => ({ Component: m.default }),
        ),
    },
    {
      path: "community-sdk-demo",
      lazy: () =>
        import(
          "@/features/community-workbench-sdk/pages/CommunityWorkbenchSdkDemoPage"
        ).then((m) => ({ Component: m.default })),
    },
  ],
},
{
  path: "finngen-tools",
  element: <Navigate to="/workbench/finngen" replace />,
},
{
  path: "workbench/aqueduct",
  element: <Navigate to="/workbench" replace />,
},
{
  path: "workbench/help",
  element: <Navigate to="/workbench/finngen/help" replace />,
},
```

Key changes:
- `/workbench` now shows the launcher (not FinnGen directly)
- FinnGen lives at `/workbench/finngen`
- `/workbench/aqueduct` redirects to `/workbench` (graceful handling of bookmarks)
- `/finngen-tools` redirects to `/workbench/finngen` (not `/workbench`)
- Workbench routes are no longer gated behind `VITE_STUDY_AGENT_ENABLED` — the launcher is always visible; individual toolsets filter themselves

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Verify the dev server loads without errors**

Run: `cd frontend && npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds with no missing module errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/router.tsx
git commit -m "feat(workbench): rewire routes — launcher at /workbench, FinnGen at /workbench/finngen"
```

---

### Task 7: Update Sidebar to always show Workbench

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx:128`

- [ ] **Step 1: Make Workbench visible regardless of StudyAgent**

In `frontend/src/components/layout/Sidebar.tsx`, find the conditional that gates the Workbench entry on `studyAgentEnabled` (~line 128) and make it always visible:

```typescript
// BEFORE:
? [{ path: "/workbench", label: "Workbench", icon: PanelsTopLeft }]

// AFTER (remove the conditional — always include):
{ path: "/workbench", label: "Workbench", icon: PanelsTopLeft },
```

Ensure the surrounding conditional structure is adjusted so this entry is always in the nav items array, not inside an `studyAgentEnabled ? [...] : []` ternary.

- [ ] **Step 2: Update help key mapping**

In the same file (~line 196), update the help mapping so `/workbench/finngen` also maps:

```typescript
// Add:
"/workbench/finngen": "study-designer",
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(workbench): always show Workbench in sidebar navigation"
```

---

## Phase 4: FinnGen Cleanup

### Task 8: Remove Toolset dropdown and Aqueduct promo from FinnGenToolsPage

**Files:**
- Modify: `frontend/src/features/finngen/pages/FinnGenToolsPage.tsx:195-209` (Toolset dropdown)
- Modify: Same file — find Aqueduct promotion card near bottom

- [ ] **Step 1: Remove the Toolset dropdown**

In `FinnGenToolsPage.tsx`, find the Toolset `<select>` block (~lines 195-209) and replace it with a simple breadcrumb-style back link:

```typescript
<Link
  to="/workbench"
  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
>
  <ChevronLeft className="h-3.5 w-3.5" />
  Workbench
</Link>
```

Add `ChevronLeft` to the existing lucide-react import (do NOT use wildcard `import *`):
```typescript
import { ArrowUpRight, ChevronLeft, CircleAlert, HelpCircle, PanelsTopLeft, RefreshCw } from "lucide-react";
```

- [ ] **Step 2: Remove the Aqueduct promotion card**

Search FinnGenToolsPage.tsx for any mention of "aqueduct" or "Aqueduct" or "ETL workbench" promotion card. Remove the entire card/section. (Look for a card near the bottom of the JSX that promotes Aqueduct.)

- [ ] **Step 3: Update the help link**

If the help link in the header points to `/workbench/help`, update it to `/workbench/finngen/help` to match the new route structure.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/finngen/pages/FinnGenToolsPage.tsx
git commit -m "refactor(finngen): replace toolset dropdown with back-to-workbench link, remove Aqueduct promo"
```

---

## Phase 5: Verification

### Task 9: Full build verification

- [ ] **Step 1: Run frontend TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run frontend ESLint**

Run: `cd frontend && npx eslint src/features/workbench src/app/router.tsx src/features/finngen/pages/FinnGenToolsPage.tsx`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Run frontend build**

Run: `cd frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Run backend PHPStan**

Run: `cd backend && vendor/bin/phpstan analyse`
Expected: PASS

- [ ] **Step 5: Run backend Pint**

Run: `cd backend && vendor/bin/pint --test`
Expected: PASS

- [ ] **Step 6: Verify no dangling Aqueduct references anywhere**

Run: `grep -ri "aqueduct" frontend/src/ backend/app/ backend/routes/ --include="*.tsx" --include="*.ts" --include="*.php" -l`
Expected: No results (or only in git history, not live code)

- [ ] **Step 7: Final commit if any lint fixes were needed**

```bash
git add -A
git commit -m "chore: lint fixes after workbench restructure"
```

---

## Future Work (not in this plan)

These are deferred and will become separate plans:

1. **Morpheus toolset page** — Build `frontend/src/features/morpheus/` with MIMIC-IV inpatient analytics UI (Phase 1 of Morpheus.md)
2. **Dynamic toolset discovery** — API endpoint that returns available toolsets based on enabled services, replacing the static registry
3. **SDK readiness process** — Formal evaluation pipeline for third-party toolsets before inclusion
4. **Toolset permissions** — RBAC gating per toolset via Spatie permissions

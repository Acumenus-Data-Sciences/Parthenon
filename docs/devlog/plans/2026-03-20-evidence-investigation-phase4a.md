# Evidence Investigation Phase 4a — Synthesis, Export, Versioning

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Synthesis domain with interactive dossier assembly (narrative editing, key-finding toggle, section reorder), add PDF and JSON export of the Evidence Dossier, and implement investigation versioning (snapshot on complete).

**Architecture:** Frontend: upgrade `SynthesisPanel` from read-only shell to interactive dossier editor with inline narrative textarea, clickable key-finding stars, and section reorder via drag handles. Backend: new `InvestigationExportService` generates HTML→PDF (via existing DOMPDF infrastructure) and structured JSON from investigation + pins data. New `InvestigationVersion` model + service creates snapshots when status transitions to `complete`. All state auto-saved via existing `useAutoSave` hook.

**Tech Stack:** Laravel 11 (DOMPDF for PDF, JSON serialization for export), React 19, TypeScript, existing auto-save infrastructure

**Spec:** `docs/superpowers/specs/2026-03-20-finngen-evidence-investigation-design.md` (Synthesis Domain + Phase 4)

**Depends on:** Phases 1-3 + cleanup complete, `investigation_versions` table already migrated

---

## File Structure

### Backend — New Files

| File | Responsibility |
|------|---------------|
| `backend/app/Models/App/InvestigationVersion.php` | Eloquent model for version snapshots |
| `backend/app/Services/Investigation/InvestigationExportService.php` | PDF + JSON dossier generation |
| `backend/app/Services/Investigation/InvestigationVersionService.php` | Version snapshot creation + retrieval |
| `backend/app/Http/Controllers/Api/V1/InvestigationExportController.php` | Export + version endpoints |
| `backend/resources/views/exports/investigation-dossier.blade.php` | Blade template for PDF rendering |
| `backend/tests/Feature/Api/V1/InvestigationExportTest.php` | Export + version tests |

### Backend — Modified Files

| File | Changes |
|------|---------|
| `backend/app/Models/App/Investigation.php` | Add `versions()` HasMany relationship |
| `backend/app/Services/Investigation/InvestigationService.php` | Create version snapshot on status→complete transition |
| `backend/routes/api.php` | Add export + version routes |

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/investigation/components/synthesis/SectionEditor.tsx` | Individual dossier section with narrative editing + pin management |
| `frontend/src/features/investigation/components/synthesis/NarrativeEditor.tsx` | Inline textarea for narrative text between pins |
| `frontend/src/features/investigation/components/synthesis/ExportBar.tsx` | Export buttons (PDF, JSON) + export history |
| `frontend/src/features/investigation/components/synthesis/VersionHistory.tsx` | Version list + restore |
| `frontend/src/features/investigation/hooks/useExport.ts` | TanStack Query hooks for export + versions |

### Frontend — Modified Files

| File | Changes |
|------|---------|
| `frontend/src/features/investigation/components/SynthesisPanel.tsx` | Upgrade from read-only shell to interactive editor |
| `frontend/src/features/investigation/components/PinCard.tsx` | Make key-finding star clickable, show narratives |
| `frontend/src/features/investigation/api.ts` | Add export + version API functions |
| `frontend/src/features/investigation/types.ts` | Add export + version types |

---

## Task Breakdown

### Task 1: Backend — InvestigationVersion model + service

**Files:**
- Create: `backend/app/Models/App/InvestigationVersion.php`
- Create: `backend/app/Services/Investigation/InvestigationVersionService.php`
- Modify: `backend/app/Models/App/Investigation.php`
- Modify: `backend/app/Services/Investigation/InvestigationService.php`

- [ ] **Step 1: Create InvestigationVersion model**

```php
<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvestigationVersion extends Model
{
    protected $table = 'investigation_versions';

    protected $fillable = [
        'investigation_id',
        'version_number',
        'snapshot',
        'created_by',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'version_number' => 'integer',
    ];

    /** @return BelongsTo<Investigation, $this> */
    public function investigation(): BelongsTo
    {
        return $this->belongsTo(Investigation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
```

- [ ] **Step 2: Add versions() to Investigation model**

In `Investigation.php`, add:
```php
/** @return HasMany<InvestigationVersion, $this> */
public function versions(): HasMany
{
    return $this->hasMany(InvestigationVersion::class)->orderByDesc('version_number');
}
```

- [ ] **Step 3: Create InvestigationVersionService**

```php
<?php

namespace App\Services\Investigation;

use App\Models\App\Investigation;
use App\Models\App\InvestigationVersion;
use Illuminate\Database\Eloquent\Collection;

class InvestigationVersionService
{
    public function createSnapshot(Investigation $investigation, int $userId): InvestigationVersion
    {
        $maxVersion = InvestigationVersion::where('investigation_id', $investigation->id)
            ->max('version_number') ?? 0;

        $investigation->load(['pins', 'owner:id,name']);

        return InvestigationVersion::create([
            'investigation_id' => $investigation->id,
            'version_number' => $maxVersion + 1,
            'snapshot' => [
                'title' => $investigation->title,
                'research_question' => $investigation->research_question,
                'status' => $investigation->status,
                'phenotype_state' => $investigation->phenotype_state,
                'clinical_state' => $investigation->clinical_state,
                'genomic_state' => $investigation->genomic_state,
                'synthesis_state' => $investigation->synthesis_state,
                'pins' => $investigation->pins->toArray(),
                'snapshotted_at' => now()->toISOString(),
            ],
            'created_by' => $userId,
        ]);
    }

    /** @return Collection<int, InvestigationVersion> */
    public function listVersions(int $investigationId): Collection
    {
        return InvestigationVersion::where('investigation_id', $investigationId)
            ->with('creator:id,name')
            ->orderByDesc('version_number')
            ->get();
    }

    public function getVersion(int $investigationId, int $versionNumber): ?InvestigationVersion
    {
        return InvestigationVersion::where('investigation_id', $investigationId)
            ->where('version_number', $versionNumber)
            ->with('creator:id,name')
            ->first();
    }
}
```

- [ ] **Step 4: Update InvestigationService to snapshot on complete**

In `InvestigationService.php`, in the `update()` method, after `$investigation->update($updateData)`, add:

```php
if (isset($updateData['status']) && $updateData['status'] === 'complete') {
    $versionService = app(InvestigationVersionService::class);
    $versionService->createSnapshot($investigation, $userId);
}
```

- [ ] **Step 5: Verify PHPStan + commit**

```bash
git commit -m "feat(investigation): add InvestigationVersion model with auto-snapshot on complete"
```

---

### Task 2: Backend — Export service + controller + routes

**Files:**
- Create: `backend/app/Services/Investigation/InvestigationExportService.php`
- Create: `backend/app/Http/Controllers/Api/V1/InvestigationExportController.php`
- Create: `backend/resources/views/exports/investigation-dossier.blade.php`
- Create: `backend/tests/Feature/Api/V1/InvestigationExportTest.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create the Blade template for PDF**

Create `backend/resources/views/exports/investigation-dossier.blade.php`:

A clean HTML template that renders the Evidence Dossier as a printable document. Sections:
- Title page: investigation title, research question, status, creation date
- Table of contents: list of 8 dossier sections with pin counts
- Each section: section heading, narrative text (if present), pinned findings as formatted cards
- Key findings highlighted with a star marker
- Methods section: auto-generated from analysis parameters
- Footer: "Generated by Parthenon Evidence Investigation Platform" + timestamp

Use inline CSS (no external stylesheets — DOMPDF requirement). Clean, professional styling with serif headings and sans-serif body. Print-optimized (no dark theme — white background for PDF).

- [ ] **Step 2: Create InvestigationExportService**

```php
<?php

namespace App\Services\Investigation;

use App\Models\App\Investigation;

class InvestigationExportService
{
    public function toJson(Investigation $investigation): array
    {
        $investigation->load(['pins', 'owner:id,name', 'versions']);

        $pins = $investigation->pins->groupBy('section');

        return [
            'meta' => [
                'title' => $investigation->title,
                'research_question' => $investigation->research_question,
                'status' => $investigation->status,
                'owner' => $investigation->owner?->name,
                'created_at' => $investigation->created_at?->toISOString(),
                'exported_at' => now()->toISOString(),
                'version' => $investigation->versions->first()?->version_number ?? 0,
                'platform' => 'Parthenon Evidence Investigation',
            ],
            'phenotype_state' => $investigation->phenotype_state,
            'clinical_state' => $investigation->clinical_state,
            'genomic_state' => $investigation->genomic_state,
            'synthesis_state' => $investigation->synthesis_state,
            'sections' => collect([
                'phenotype_definition', 'population', 'clinical_evidence',
                'genomic_evidence', 'synthesis', 'limitations', 'methods',
            ])->mapWithKeys(fn (string $section) => [
                $section => [
                    'pins' => ($pins[$section] ?? collect())->map(fn ($pin) => [
                        'finding_type' => $pin->finding_type,
                        'finding_payload' => $pin->finding_payload,
                        'is_key_finding' => $pin->is_key_finding,
                        'narrative_before' => $pin->narrative_before,
                        'narrative_after' => $pin->narrative_after,
                        'gene_symbols' => $pin->gene_symbols,
                        'concept_ids' => $pin->concept_ids,
                    ])->values()->toArray(),
                    'narrative' => ($investigation->synthesis_state['section_narratives'] ?? [])[$section] ?? null,
                ],
            ])->toArray(),
            'key_findings' => $investigation->pins
                ->where('is_key_finding', true)
                ->map(fn ($pin) => [
                    'section' => $pin->section,
                    'finding_type' => $pin->finding_type,
                    'finding_payload' => $pin->finding_payload,
                ])->values()->toArray(),
        ];
    }

    public function toPdfHtml(Investigation $investigation): string
    {
        $data = $this->toJson($investigation);

        return view('exports.investigation-dossier', $data)->render();
    }

    public function toPdf(Investigation $investigation): ?string
    {
        $html = $this->toPdfHtml($investigation);

        if (class_exists(\Dompdf\Dompdf::class)) {
            $dompdf = new \Dompdf\Dompdf();
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            return $dompdf->output();
        }

        // Fallback: return HTML if DOMPDF not installed
        return null;
    }
}
```

- [ ] **Step 3: Create InvestigationExportController**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Investigation;
use App\Services\Investigation\InvestigationExportService;
use App\Services\Investigation\InvestigationVersionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class InvestigationExportController extends Controller
{
    public function __construct(
        private readonly InvestigationExportService $exportService,
        private readonly InvestigationVersionService $versionService,
    ) {}

    public function exportJson(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $this->exportService->toJson($investigation);

        return response()->json(['data' => $data]);
    }

    public function exportPdf(Request $request, Investigation $investigation): Response|JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $pdf = $this->exportService->toPdf($investigation);

        if ($pdf) {
            return response($pdf, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . \Illuminate\Support\Str::slug($investigation->title) . '-dossier.pdf"',
            ]);
        }

        // Fallback to HTML
        $html = $this->exportService->toPdfHtml($investigation);
        return response($html, 200, ['Content-Type' => 'text/html']);
    }

    public function listVersions(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $versions = $this->versionService->listVersions($investigation->id);

        return response()->json(['data' => $versions]);
    }

    public function getVersion(Request $request, Investigation $investigation, int $versionNumber): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $version = $this->versionService->getVersion($investigation->id, $versionNumber);

        if (!$version) {
            return response()->json(['error' => 'Version not found'], 404);
        }

        return response()->json(['data' => $version]);
    }

    public function createVersion(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $version = $this->versionService->createSnapshot($investigation, $user->id);

        return response()->json($version, 201);
    }
}
```

- [ ] **Step 4: Register routes**

Add import for `InvestigationExportController`. Inside the `investigations` route group:

```php
// Export + Versions
Route::get('/{investigation}/export/json', [InvestigationExportController::class, 'exportJson']);
Route::get('/{investigation}/export/pdf', [InvestigationExportController::class, 'exportPdf']);
Route::get('/{investigation}/versions', [InvestigationExportController::class, 'listVersions']);
Route::get('/{investigation}/versions/{versionNumber}', [InvestigationExportController::class, 'getVersion']);
Route::post('/{investigation}/versions', [InvestigationExportController::class, 'createVersion']);
```

- [ ] **Step 5: Create tests**

Tests:
- Export JSON returns correct structure with sections + key_findings
- Export PDF returns binary or HTML fallback
- Create version increments version_number
- List versions returns ordered by version_number desc
- Status→complete auto-creates version snapshot
- Authorization checks

- [ ] **Step 6: Verify + commit**

```bash
git commit -m "feat(investigation): add export (PDF/JSON) and versioning backend"
```

---

### Task 3: Frontend — Export + version types, API, hooks

**Files:**
- Modify: `frontend/src/features/investigation/types.ts`
- Modify: `frontend/src/features/investigation/api.ts`
- Create: `frontend/src/features/investigation/hooks/useExport.ts`

- [ ] **Step 1: Add types**

```typescript
export interface InvestigationVersion {
  id: number;
  investigation_id: number;
  version_number: number;
  snapshot: Record<string, unknown>;
  created_by: number;
  creator?: { id: number; name: string };
  created_at: string;
}

export interface DossierExport {
  meta: {
    title: string;
    research_question: string | null;
    status: string;
    owner: string | null;
    created_at: string;
    exported_at: string;
    version: number;
    platform: string;
  };
  sections: Record<string, {
    pins: Array<{
      finding_type: string;
      finding_payload: Record<string, unknown>;
      is_key_finding: boolean;
      narrative_before: string | null;
      narrative_after: string | null;
    }>;
    narrative: string | null;
  }>;
  key_findings: Array<{
    section: string;
    finding_type: string;
    finding_payload: Record<string, unknown>;
  }>;
}
```

- [ ] **Step 2: Add API functions**

```typescript
export async function exportJson(investigationId: number): Promise<DossierExport> { ... }
export async function exportPdf(investigationId: number): Promise<Blob> {
  const response = await apiClient.get(`/investigations/${investigationId}/export/pdf`, { responseType: 'blob' });
  return response.data;
}
export async function listVersions(investigationId: number): Promise<InvestigationVersion[]> { ... }
export async function createVersion(investigationId: number): Promise<InvestigationVersion> { ... }
```

- [ ] **Step 3: Create hooks**

```typescript
export function useExportJson() { return useMutation(...) }
export function useExportPdf() { return useMutation(...) }
export function useVersions(investigationId: number) { return useQuery(...) }
export function useCreateVersion() { return useMutation(...) }
```

- [ ] **Step 4: Verify + commit**

```bash
git commit -m "feat(investigation): add export and versioning frontend types, API, and hooks"
```

---

### Task 4: Frontend — Interactive SynthesisPanel upgrade

**Files:**
- Create: `frontend/src/features/investigation/components/synthesis/SectionEditor.tsx`
- Create: `frontend/src/features/investigation/components/synthesis/NarrativeEditor.tsx`
- Create: `frontend/src/features/investigation/components/synthesis/ExportBar.tsx`
- Create: `frontend/src/features/investigation/components/synthesis/VersionHistory.tsx`
- Modify: `frontend/src/features/investigation/components/SynthesisPanel.tsx`
- Modify: `frontend/src/features/investigation/components/PinCard.tsx`

- [ ] **Step 1: Create NarrativeEditor**

Simple inline textarea for adding/editing narrative text.

Props: `value: string`, `onChange: (value: string) => void`, `placeholder: string`

A `textarea` that shows as a subtle dashed border when empty ("Click to add narrative..."), expands to a full textarea on focus. Auto-saves via the parent's debounce. Dark theme: zinc-900 bg, zinc-700 border, zinc-300 text.

- [ ] **Step 2: Create SectionEditor**

A single dossier section card with full interactivity.

Props: `sectionKey: string`, `sectionLabel: string`, `pins: EvidencePin[]`, `narrative: string | null`, `onNarrativeChange: (sectionKey: string, text: string) => void`, `onToggleKeyFinding: (pinId: number) => void`, `onDeletePin: (pinId: number) => void`, `onUpdatePinNarrative: (pinId: number, field: "narrative_before" | "narrative_after", text: string) => void`

Renders:
- Section header (name, pin count badge)
- Section-level narrative (NarrativeEditor)
- Pin list: each pin has NarrativeEditor (before), PinCard, NarrativeEditor (after)
- Empty state if no pins and no narrative

- [ ] **Step 3: Make PinCard key-finding star clickable**

In `PinCard.tsx`, the star icon for `is_key_finding` is currently display-only. Make it a clickable button:
- Add `onToggleKeyFinding?: (pinId: number) => void` prop
- Star click calls `onToggleKeyFinding(pin.id)`
- Star filled (gold) when `is_key_finding`, outline (zinc-600) when not
- Tooltip: "Mark as key finding" / "Unmark key finding"

- [ ] **Step 4: Create ExportBar**

Export actions bar.

Props: `investigationId: number`, `investigationTitle: string`

- "Export PDF" button → calls `useExportPdf`, downloads blob as file
- "Export JSON" button → calls `useExportJson`, downloads as `.json` file
- Export history: shows last 3 exports from `synthesis_state.export_history` with timestamps
- Loading state on each button while exporting

For PDF download:
```typescript
const blob = await exportPdf(investigationId);
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `${slug(title)}-dossier.pdf`;
a.click();
URL.revokeObjectURL(url);
```

For JSON download: similar pattern with `JSON.stringify` blob.

- [ ] **Step 5: Create VersionHistory**

Props: `investigationId: number`

- Uses `useVersions(investigationId)` to list versions
- Each version: version number, creation date, creator name
- "Create Snapshot" button (only when status is active) → calls `useCreateVersion`
- Auto-snapshot note: "Snapshots are created automatically when an investigation is marked Complete"

- [ ] **Step 6: Upgrade SynthesisPanel**

Replace the read-only `SynthesisPanel` with the interactive version:

- Sub-tabs at top: "Dossier" (default), "Export", "Versions"
- **Dossier tab**: renders `SectionEditor` for each of the 8 sections. Section order from `synthesis_state.section_order` (with fallback to default order). Section narratives from `synthesis_state.section_narratives`.
- **Export tab**: renders `ExportBar`
- **Versions tab**: renders `VersionHistory`
- Wire auto-save for `synthesis_state` via `useAutoSave`
- Wire `onToggleKeyFinding` to call `useUpdatePin` with `is_key_finding` toggle
- Wire `onUpdatePinNarrative` to call `useUpdatePin` with narrative field

- [ ] **Step 7: Verify + commit**

```bash
git commit -m "feat(investigation): upgrade SynthesisPanel with narrative editing, export, and versioning"
```

---

### Task 5: Full verification + E2E test

- [ ] **Step 1: Frontend TypeScript check**
Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 2: Backend PHPStan**
Run: `cd backend && vendor/bin/phpstan analyse app/Services/Investigation/ app/Http/Controllers/Api/V1/InvestigationExportController.php app/Models/App/InvestigationVersion.php`

- [ ] **Step 3: Backend tests**
Run: `cd backend && vendor/bin/pest tests/Feature/Api/V1/`

- [ ] **Step 4: E2E API test — export JSON**
```bash
curl -s /api/v1/investigations/{id}/export/json | jq '.data.meta, .data.key_findings'
```

- [ ] **Step 5: E2E API test — create version**
```bash
curl -s -X PATCH /api/v1/investigations/{id} -d '{"status":"complete"}'
curl -s /api/v1/investigations/{id}/versions | jq '.data | length'
```

- [ ] **Step 6: Final commit if lint fixes needed**

```bash
git commit -m "chore: lint fixes after Phase 4a"
```

---

## What Phase 4a Does NOT Include (Phase 4b)

| Item | Reason |
|------|--------|
| Shareable link with time-limited token | Requires `investigation_collaborators` table + token system |
| Collaboration (read/write sharing, forking) | Requires new authorization model |
| Split view (side-by-side domains) | Complex layout infrastructure |
| Strategus study package export | Requires deep OHDSI JSON spec knowledge |
| Colocalization/fine-mapping upload | Genomic domain extension |
| Drag-and-drop pin reorder | Lower priority — section-level ordering included |

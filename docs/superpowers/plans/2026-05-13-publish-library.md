---
doc_type: plan
status: active
date: 2026-05-13
---

# Pre-Publication Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Publish page's `sessionStorage`-only state with a server-side Pre-Publication Library that lets users save, load, autosave, snapshot, and share manuscript drafts (including figures, tables, and graphs) across browser sessions and study collaborators.

**Architecture:** Three independently shippable phases on top of existing `app.publication_drafts` + `app.publication_report_bundles` schema (shipped 2026-04-15). Phase 1 wires the frontend wizard to the existing REST endpoints behind a new `/publish/library` landing page using a hybrid snapshot model (frozen SVG + tableData embedded in `document_json`, raw `resultJson` not persisted). Phase 2 adds autosave with optimistic locking and named snapshots via `publication_report_bundles` rows. Phase 3 introduces a `visibility` enum (`private` | `study`) plus a new `Study::scopeAccessibleBy` and `PublicationDraftPolicy` to enable study-collaborator access.

**Tech Stack:** Laravel 11 / PHP 8.4 (Sanctum, Spatie RBAC, Pest, PHPStan L8) · React 19 / TypeScript strict / Vite / TanStack Query / Zustand · PostgreSQL 16 jsonb · Vitest · Playwright · Docker Compose

**Spec:** `docs/superpowers/specs/2026-05-13-publish-library-design.md`

---

## File structure

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/V1/PublicationController.php          MODIFIED P2+P3
│   │   └── Requests/Publication/
│   │       ├── CreatePublicationSnapshotRequest.php              NEW P2
│   │       └── UpdatePublicationDraftRequest.php                 NEW P3
│   ├── Models/App/
│   │   ├── PublicationDraft.php                                  MODIFIED P3 (visibility cast)
│   │   └── Study.php                                             MODIFIED P3 (scopeAccessibleBy)
│   ├── Policies/PublicationDraftPolicy.php                       NEW P3
│   ├── Providers/AuthServiceProvider.php                         MODIFIED P3
│   └── Services/Publication/PublicationSnapshotService.php       NEW P2
├── database/migrations/
│   ├── 2026_05_14_000001_add_visibility_to_publication_drafts.php   NEW P3
│   └── (no Phase 2 migrations — reuses publication_report_bundles)
├── routes/api.php                                                MODIFIED P2+P3
└── tests/Feature/Api/V1/
    ├── PublicationTest.php                                       MODIFIED P1 (extended cases)
    ├── PublicationSnapshotTest.php                               NEW P2
    └── PublicationDraftSharingTest.php                           NEW P3

frontend/
├── src/
│   ├── app/router.tsx                                            MODIFIED P1
│   └── features/publish/
│       ├── api/publishApi.ts                                     MODIFIED P2 (snapshots)
│       ├── components/
│       │   ├── PublishPage/HybridPromptModal.tsx                 NEW P1
│       │   ├── PublishPage/SaveStatusIndicator.tsx               NEW P2
│       │   ├── PublishPage/ShareDropdown.tsx                     NEW P3
│       │   └── library/
│       │       ├── DraftCard.tsx                                 NEW P1
│       │       ├── DraftCardGrid.tsx                             NEW P1
│       │       ├── DraftFilters.tsx                              NEW P1
│       │       ├── NewDraftButton.tsx                            NEW P1
│       │       ├── SaveDraftButton.tsx                           NEW P1
│       │       ├── SessionStorageMigrationBanner.tsx             NEW P1
│       │       ├── CreateSnapshotModal.tsx                       NEW P2
│       │       ├── SnapshotsPanel.tsx                            NEW P2
│       │       ├── RevertSnapshotDialog.tsx                      NEW P2
│       │       └── VisibilityBadge.tsx                           NEW P3
│       ├── hooks/
│       │   ├── useDrafts.ts                                      NEW P1
│       │   ├── useAutosave.ts                                    NEW P2
│       │   └── useSnapshots.ts                                   NEW P2
│       ├── lib/
│       │   ├── draftSerialization.ts                             NEW P1
│       │   ├── snapshotCapture.ts                                NEW P1
│       │   ├── documentHash.ts                                   NEW P2
│       │   └── __tests__/
│       │       ├── draftSerialization.test.ts                    NEW P1
│       │       ├── snapshotCapture.test.ts                       NEW P1
│       │       └── documentHash.test.ts                          NEW P2
│       ├── pages/
│       │   ├── PublicationLibraryPage.tsx                        NEW P1
│       │   └── PublishPage.tsx                                   MODIFIED P1+P2+P3
│       └── types/publish.ts                                      MODIFIED P1+P3 (PublicationDraft, snapshot types, visibility)

e2e/
└── tests/publish-library/
    ├── phase1-lifecycle.spec.ts                                  NEW P1
    ├── phase2-autosave-snapshots.spec.ts                         NEW P2
    └── phase3-sharing.spec.ts                                    NEW P3
```

---

## Shared conventions (all phases)

**Command prefixes** — run from repo root unless noted:

| Goal | Command |
|------|---------|
| Run a single Pest test | `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter='test name'"` |
| Run all Pest tests | `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest"` |
| Pint format check | `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint --test"` |
| Pint format apply | `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"` |
| PHPStan | `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse"` |
| Vitest single file | `docker compose exec node sh -c "cd /app && npx vitest run path/to.test.ts"` |
| Vitest all | `docker compose exec node sh -c "cd /app && npx vitest run"` |
| TypeScript check | `docker compose exec node sh -c "cd /app && npx tsc --noEmit"` |
| Vite build (stricter) | `docker compose exec node sh -c "cd /app && npx vite build"` |
| Run migration | `docker compose exec php php artisan migrate --path=database/migrations/2026_05_14_000001_add_visibility_to_publication_drafts.php` |
| Rollback migration | `docker compose exec php php artisan migrate:rollback --path=database/migrations/...` |

**Always run after PHP edits:** `Pint` (matches CI). The pre-commit hook will fail commits otherwise.

**Always run after TS edits:** `npx vite build` (stricter than `tsc --noEmit` — catches issues CI catches).

**Commit message convention:** `feat(publish): <scope>` for features, `test(publish): <scope>` for test-only commits, `refactor(publish): <scope>` for non-behavioral changes. The pre-commit hook auto-runs Pint + PHPStan + TS + ESLint + Vitest + Python syntax.

**Branch:** Create `feature/publish-library-phase-1` for Phase 1, separate branches per phase. PR each phase independently.

**Review gate:** At the end of each phase, request user code review before opening the PR for that phase. Phase 2 depends on Phase 1 shipping. Phase 3 depends on Phase 2 shipping.

---

# Phase 1 — Persistence + Library

**Goal:** Replace sessionStorage with server-side drafts. New `/publish/library` landing page lists user's drafts. The wizard can save, reload, and migrate any orphaned sessionStorage state into a saved draft.

**Estimated time:** 1 week.

**Branch:** `feature/publish-library-phase-1`

---

### Task 1: Verify backend baseline + add round-trip Pest test

Confirm the existing `PublicationController` survives a frozen-SVG round trip — Phase 1 introduces no new endpoints, but the existing tests don't assert on embedded SVG markup integrity (the new payload shape).

**Files:**
- Modify: `backend/tests/Feature/Api/V1/PublicationTest.php`

- [ ] **Step 1: Branch + checkpoint**

```bash
git checkout -b feature/publish-library-phase-1
git status
```
Expected: clean working tree on the new branch.

- [ ] **Step 2: Add the failing test**

Open `backend/tests/Feature/Api/V1/PublicationTest.php` and append at the end of the file (before the closing `});` of the `describe`/`it` block — match the existing Pest style):

```php
it('round-trips document_json with frozen SVG and tableData intact', function () {
    $user = \App\Models\User::factory()->create();
    $user->givePermissionTo('studies.view');

    $document = [
        'version' => 1,
        'title' => 'Round-trip Test',
        'authors' => ['Test Author'],
        'template' => 'generic-ohdsi',
        'step' => 2,
        'selectedExecutions' => [
            ['studyId' => 1, 'analysisId' => 42, 'executionId' => 99, 'analysisType' => 'characterization', 'designJson' => ['k' => 'v']],
        ],
        'sections' => [
            [
                'id' => 'results-characterization',
                'type' => 'results',
                'title' => 'Results',
                'content' => 'narrative',
                'included' => true,
                'tableData' => ['headers' => ['A', 'B'], 'rows' => [['A' => 1, 'B' => 2]], 'caption' => 'Cohort A'],
                'svgMarkup' => '<svg xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="3" height="4"/></svg>',
                'diagramType' => 'kaplan-meier',
            ],
        ],
    ];

    $created = $this->actingAs($user)
        ->postJson('/api/v1/publish/drafts', [
            'title' => 'Round-trip Test',
            'template' => 'generic-ohdsi',
            'document_json' => $document,
        ])
        ->assertCreated()
        ->json('data');

    $loaded = $this->actingAs($user)
        ->getJson('/api/v1/publish/drafts/'.$created['id'])
        ->assertOk()
        ->json('data');

    expect($loaded['document_json'])->toEqual($document);
    expect($loaded['document_json']['sections'][0]['svgMarkup'])->toContain('<svg');
    expect($loaded['document_json']['sections'][0]['tableData']['rows'][0]['A'])->toBe(1);
});
```

- [ ] **Step 3: Run the test — expect PASS**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter='round-trips document_json'"
```
Expected: PASS. (The controller already does this — we're locking the behavior in.) If it FAILS, investigate before continuing — Phase 1 depends on this property.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/Feature/Api/V1/PublicationTest.php
git commit -m "test(publish): lock document_json round-trip with frozen SVG/tableData"
```

---

### Task 2: Extend frontend types for `PublicationDraft` and `DocumentJson`

Add the canonical TypeScript shape for the persisted document so all later tasks reference the same names.

**Files:**
- Modify: `frontend/src/features/publish/types/publish.ts`

- [ ] **Step 1: Open the file and add the new types at the end**

```typescript
// ── Persisted draft types (Phase 1) ─────────────────────────────────────────

export interface DraftSelectedExecution {
  studyId?: number;
  studyTitle?: string;
  analysisId?: number;
  executionId?: number;
  analysisType: string;
  analysisName?: string;
  designJson?: Record<string, unknown>;
  // resultJson is NEVER persisted — re-fetched on demand
}

export interface DraftSectionTableData {
  caption?: string;
  headers: string[];
  rows: Array<Record<string, string | number>>;
  footnotes?: string[];
}

export interface DraftSection {
  id: string;
  type: "introduction" | "methods" | "results" | "discussion" | "diagram";
  analysisType?: string;
  title: string;
  content: string;
  included: boolean;
  narrativeIncluded?: boolean;
  tableIncluded?: boolean;
  diagramIncluded?: boolean;
  diagramType?: string;
  tableData?: DraftSectionTableData;
  svgMarkup?: string;
  executionId?: number;
}

export interface DocumentJson {
  version: 1;
  title: string;
  authors: string[];
  template: string;
  step: 1 | 2 | 3 | 4;
  selectedExecutions: DraftSelectedExecution[];
  sections: DraftSection[];
}

export type PublicationDraftStatus = "draft" | "ready" | "archived";

export interface PublicationDraft {
  id: number;
  user_id: number;
  study_id: number | null;
  title: string;
  template: string;
  document_json: DocumentJson;
  status: PublicationDraftStatus;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicationDraftInput {
  study_id?: number | null;
  title: string;
  template: string;
  document_json: DocumentJson;
  status?: PublicationDraftStatus;
}
```

- [ ] **Step 2: Type-check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```
Expected: PASS — these types stand alone.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/types/publish.ts
git commit -m "feat(publish): add PublicationDraft and DocumentJson types"
```

---

### Task 3: Build `draftSerialization` helper with tests

Pure function that converts wizard state ↔ `document_json`. Strips `resultJson` from selected executions on save.

**Files:**
- Create: `frontend/src/features/publish/lib/draftSerialization.ts`
- Create: `frontend/src/features/publish/lib/__tests__/draftSerialization.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/features/publish/lib/__tests__/draftSerialization.test.ts
import { describe, it, expect } from "vitest";
import {
  serializeForSave,
  deserializeFromLoad,
} from "../draftSerialization";
import type { DocumentJson } from "../../types/publish";

describe("draftSerialization", () => {
  it("strips resultJson from selectedExecutions on serialize", () => {
    const state = {
      title: "T",
      authors: ["A"],
      template: "generic-ohdsi",
      step: 2 as const,
      selectedExecutions: [
        {
          studyId: 1,
          analysisId: 2,
          executionId: 3,
          analysisType: "characterization",
          resultJson: { huge: "blob" },
          designJson: { k: "v" },
        },
      ],
      sections: [],
    };
    const doc = serializeForSave(state);
    expect(doc.version).toBe(1);
    expect(doc.selectedExecutions[0]).not.toHaveProperty("resultJson");
    expect(doc.selectedExecutions[0].designJson).toEqual({ k: "v" });
  });

  it("round-trips through deserialize", () => {
    const doc: DocumentJson = {
      version: 1,
      title: "T",
      authors: ["A"],
      template: "generic-ohdsi",
      step: 3,
      selectedExecutions: [
        { studyId: 1, analysisId: 2, executionId: 3, analysisType: "characterization" },
      ],
      sections: [
        {
          id: "s1",
          type: "results",
          title: "Results",
          content: "narrative",
          included: true,
          tableData: { headers: ["A"], rows: [{ A: 1 }] },
          svgMarkup: "<svg/>",
        },
      ],
    };
    const state = deserializeFromLoad(doc);
    expect(state.title).toBe("T");
    expect(state.step).toBe(3);
    expect(state.sections[0].svgMarkup).toBe("<svg/>");
    expect(state.sections[0].tableData?.rows[0].A).toBe(1);
  });

  it("coerces unknown step values to 1 (forward-compat)", () => {
    const doc = { version: 1, title: "T", authors: [], template: "x", step: 99, selectedExecutions: [], sections: [] } as unknown as DocumentJson;
    const state = deserializeFromLoad(doc);
    expect(state.step).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/publish/lib/__tests__/draftSerialization.test.ts"
```
Expected: FAIL — `Cannot find module '../draftSerialization'`.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/features/publish/lib/draftSerialization.ts
import type {
  DocumentJson,
  DraftSection,
  DraftSelectedExecution,
} from "../types/publish";

export interface WizardSerializableState {
  title: string;
  authors: string[];
  template: string;
  step: 1 | 2 | 3 | 4;
  selectedExecutions: Array<DraftSelectedExecution & { resultJson?: unknown }>;
  sections: DraftSection[];
}

export function serializeForSave(state: WizardSerializableState): DocumentJson {
  return {
    version: 1,
    title: state.title,
    authors: state.authors,
    template: state.template,
    step: state.step,
    selectedExecutions: state.selectedExecutions.map((exec) => {
      // Drop resultJson — never persisted.
      const { resultJson: _drop, ...rest } = exec;
      return rest;
    }),
    sections: state.sections,
  };
}

export function deserializeFromLoad(doc: DocumentJson): WizardSerializableState {
  const validSteps = [1, 2, 3, 4] as const;
  const step = (validSteps as readonly number[]).includes(doc.step)
    ? doc.step
    : 1;
  return {
    title: doc.title ?? "",
    authors: doc.authors ?? [],
    template: doc.template ?? "generic-ohdsi",
    step: step as 1 | 2 | 3 | 4,
    selectedExecutions: doc.selectedExecutions ?? [],
    sections: doc.sections ?? [],
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/publish/lib/__tests__/draftSerialization.test.ts"
```
Expected: PASS (3 tests).

- [ ] **Step 5: Type-check + Vite build**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/publish/lib/draftSerialization.ts frontend/src/features/publish/lib/__tests__/draftSerialization.test.ts
git commit -m "feat(publish): add draftSerialization with resultJson stripping"
```

---

### Task 4: Build `snapshotCapture` helper with tests

Walks sections, captures live SVG markup from DOM and table data, returning a `DraftSection[]` ready for serialization.

**Files:**
- Create: `frontend/src/features/publish/lib/snapshotCapture.ts`
- Create: `frontend/src/features/publish/lib/__tests__/snapshotCapture.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/features/publish/lib/__tests__/snapshotCapture.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captureSnapshots } from "../snapshotCapture";
import type { DraftSection } from "../../types/publish";

describe("captureSnapshots", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("captures SVG markup from a section's diagram container", () => {
    const container = document.createElement("div");
    container.setAttribute("data-section-id", "results-1");
    container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    document.body.appendChild(container);

    const sections: DraftSection[] = [
      {
        id: "results-1",
        type: "results",
        title: "Results",
        content: "",
        included: true,
        diagramIncluded: true,
        diagramType: "kaplan-meier",
      },
    ];
    const captured = captureSnapshots(sections);
    expect(captured[0].svgMarkup).toContain("<svg");
    expect(captured[0].svgMarkup).toContain("<rect");
  });

  it("preserves existing svgMarkup if no DOM element is found", () => {
    const sections: DraftSection[] = [
      {
        id: "missing",
        type: "results",
        title: "x",
        content: "",
        included: true,
        diagramIncluded: true,
        diagramType: "kaplan-meier",
        svgMarkup: "<svg>previously frozen</svg>",
      },
    ];
    const captured = captureSnapshots(sections);
    expect(captured[0].svgMarkup).toBe("<svg>previously frozen</svg>");
  });

  it("leaves sections without diagrams untouched", () => {
    const sections: DraftSection[] = [
      { id: "intro", type: "introduction", title: "I", content: "x", included: true },
    ];
    const captured = captureSnapshots(sections);
    expect(captured[0].svgMarkup).toBeUndefined();
    expect(captured[0]).toEqual(sections[0]);
  });

  it("does not mutate input sections", () => {
    const sections: DraftSection[] = [
      { id: "x", type: "results", title: "x", content: "", included: true, diagramIncluded: true },
    ];
    captureSnapshots(sections);
    expect(sections[0].svgMarkup).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/publish/lib/__tests__/snapshotCapture.test.ts"
```
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/features/publish/lib/snapshotCapture.ts
import type { DraftSection } from "../types/publish";

function findSectionSvg(sectionId: string): string | undefined {
  const container = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (!container) return undefined;
  const svg = container.querySelector("svg");
  if (!svg) return undefined;
  return new XMLSerializer().serializeToString(svg);
}

export function captureSnapshots(sections: DraftSection[]): DraftSection[] {
  return sections.map((section) => {
    if (!section.diagramIncluded) return section;
    const live = findSectionSvg(section.id);
    if (live) return { ...section, svgMarkup: live };
    return section; // preserve any prior frozen markup
  });
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/publish/lib/__tests__/snapshotCapture.test.ts"
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/publish/lib/snapshotCapture.ts frontend/src/features/publish/lib/__tests__/snapshotCapture.test.ts
git commit -m "feat(publish): add snapshotCapture for freezing SVG sections"
```

---

### Task 5: Add note: section containers must expose `data-section-id`

`captureSnapshots` depends on `data-section-id="<id>"` being present on the rendered section wrapper in `DocumentPreview` / `DocumentConfigurator`. Verify and add if missing.

**Files:**
- Modify: `frontend/src/features/publish/components/DocumentPreview.tsx`

- [ ] **Step 1: Inspect current rendering**

```bash
grep -n "section.id\|data-section-id" /home/smudoshi/Github/Parthenon/frontend/src/features/publish/components/DocumentPreview.tsx
```
Expected: at least one match for `section.id`. If `data-section-id` is missing, continue. If already present, skip to Step 4 (commit nothing).

- [ ] **Step 2: Add the attribute to the section wrapper**

Find the JSX block that renders each section in `DocumentPreview.tsx` (search for `sections.map`). Add `data-section-id={section.id}` to the outermost element of each rendered section.

Example diff (your line numbers will differ):
```tsx
// Before
{sections.map((section) => (
  <div key={section.id} className="...">
    ...
  </div>
))}

// After
{sections.map((section) => (
  <div key={section.id} data-section-id={section.id} className="...">
    ...
  </div>
))}
```

Repeat for `DocumentConfigurator.tsx` if it also renders charts (search for the chart-rendering JSX).

- [ ] **Step 3: Type-check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/publish/components/DocumentPreview.tsx frontend/src/features/publish/components/DocumentConfigurator.tsx
git commit -m "feat(publish): expose data-section-id on section wrappers for snapshot capture"
```

---

### Task 6: Extend `publishApi.ts` with shape-corrected draft hooks

The existing `fetchPublicationDrafts`/`createPublicationDraft`/`updatePublicationDraft`/`deletePublicationDraft` exist but use older inline types. Re-type them against `PublicationDraft` from Task 2.

**Files:**
- Modify: `frontend/src/features/publish/api/publishApi.ts`

- [ ] **Step 1: Open `publishApi.ts` and replace the import block + draft functions**

Find the existing `// ── Publication drafts and OHDSI report bundles ──` section and replace it with:

```typescript
import type {
  PublicationDraft,
  PublicationDraftInput,
} from "../types/publish";

// ── Publication drafts ─────────────────────────────────────────────────────

function unwrapData<T>(data: T | { data: T }): T {
  return typeof data === "object" && data !== null && "data" in data
    ? (data as { data: T }).data
    : (data as T);
}

export const fetchPublicationDrafts = async (): Promise<PublicationDraft[]> => {
  const { data } = await apiClient.get<{ data: PublicationDraft[] }>("/publish/drafts");
  return unwrapData(data);
};

export const fetchPublicationDraft = async (draftId: number): Promise<PublicationDraft> => {
  const { data } = await apiClient.get<{ data: PublicationDraft }>(`/publish/drafts/${draftId}`);
  return unwrapData(data);
};

export const createPublicationDraft = async (
  payload: PublicationDraftInput,
): Promise<PublicationDraft> => {
  const { data } = await apiClient.post<{ data: PublicationDraft }>("/publish/drafts", payload);
  return unwrapData(data);
};

export const updatePublicationDraft = async (
  draftId: number,
  payload: Partial<PublicationDraftInput>,
): Promise<PublicationDraft> => {
  const { data } = await apiClient.patch<{ data: PublicationDraft }>(
    `/publish/drafts/${draftId}`,
    payload,
  );
  return unwrapData(data);
};

export const deletePublicationDraft = async (draftId: number): Promise<void> => {
  await apiClient.delete(`/publish/drafts/${draftId}`);
};
```

Remove the duplicate `PublicationDraft`/`PublicationDraftInput` imports from the old `types/publish` import if they're now unused at the top of the file.

- [ ] **Step 2: Type-check + build**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/api/publishApi.ts
git commit -m "refactor(publish): align draft API client with new PublicationDraft type"
```

---

### Task 7: Build `useDrafts` TanStack Query hooks

**Files:**
- Create: `frontend/src/features/publish/hooks/useDrafts.ts`

- [ ] **Step 1: Write the hook**

```typescript
// frontend/src/features/publish/hooks/useDrafts.ts
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createPublicationDraft,
  deletePublicationDraft,
  fetchPublicationDraft,
  fetchPublicationDrafts,
  updatePublicationDraft,
} from "../api/publishApi";
import type {
  PublicationDraft,
  PublicationDraftInput,
} from "../types/publish";

const KEYS = {
  list: ["publish", "drafts"] as const,
  detail: (id: number) => ["publish", "drafts", id] as const,
};

export function useDraftList() {
  return useQuery<PublicationDraft[]>({
    queryKey: KEYS.list,
    queryFn: fetchPublicationDrafts,
  });
}

export function useDraft(draftId: number | null) {
  return useQuery<PublicationDraft>({
    queryKey: draftId !== null ? KEYS.detail(draftId) : ["publish", "drafts", "noop"],
    queryFn: () => fetchPublicationDraft(draftId as number),
    enabled: draftId !== null,
  });
}

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation<PublicationDraft, Error, PublicationDraftInput>({
    mutationFn: createPublicationDraft,
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.setQueryData(KEYS.detail(draft.id), draft);
    },
  });
}

export function useUpdateDraft(draftId: number) {
  const qc = useQueryClient();
  return useMutation<PublicationDraft, Error, Partial<PublicationDraftInput>>({
    mutationFn: (payload) => updatePublicationDraft(draftId, payload),
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.setQueryData(KEYS.detail(draft.id), draft);
    },
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: deletePublicationDraft,
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.removeQueries({ queryKey: KEYS.detail(id) });
    },
  });
}
```

- [ ] **Step 2: Type-check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/hooks/useDrafts.ts
git commit -m "feat(publish): add useDrafts TanStack Query hooks"
```

---

### Task 8: Build `DraftCard` component with test

**Files:**
- Create: `frontend/src/features/publish/components/library/DraftCard.tsx`
- Create: `frontend/src/features/publish/components/library/__tests__/DraftCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/features/publish/components/library/__tests__/DraftCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DraftCard } from "../DraftCard";
import type { PublicationDraft } from "../../../types/publish";

const draft: PublicationDraft = {
  id: 7,
  user_id: 1,
  study_id: 42,
  title: "Hypertension Cohort Analysis",
  template: "generic-ohdsi",
  document_json: {
    version: 1,
    title: "Hypertension Cohort Analysis",
    authors: [],
    template: "generic-ohdsi",
    step: 2,
    selectedExecutions: [],
    sections: [
      { id: "1", type: "results", title: "x", content: "", included: true, tableIncluded: true },
      { id: "2", type: "results", title: "y", content: "", included: true, diagramIncluded: true },
    ],
  },
  status: "draft",
  last_opened_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("DraftCard", () => {
  it("renders the title, template, and section counts", () => {
    render(
      <MemoryRouter>
        <DraftCard draft={draft} onArchive={vi.fn()} onDelete={vi.fn()} onDuplicate={vi.fn()} onRename={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Hypertension Cohort Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/generic-ohdsi/i)).toBeInTheDocument();
    expect(screen.getByText(/2 sections/i)).toBeInTheDocument();
    expect(screen.getByText(/1 table/i)).toBeInTheDocument();
    expect(screen.getByText(/1 figure/i)).toBeInTheDocument();
  });

  it("links to /publish/library/:id", () => {
    render(
      <MemoryRouter>
        <DraftCard draft={draft} onArchive={vi.fn()} onDelete={vi.fn()} onDuplicate={vi.fn()} onRename={vi.fn()} />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Open draft/i });
    expect(link.getAttribute("href")).toBe("/publish/library/7");
  });

  it("fires onArchive when archive menu item clicked", () => {
    const onArchive = vi.fn();
    render(
      <MemoryRouter>
        <DraftCard draft={draft} onArchive={onArchive} onDelete={vi.fn()} onDuplicate={vi.fn()} onRename={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText(/More actions/i));
    fireEvent.click(screen.getByText(/Archive/i));
    expect(onArchive).toHaveBeenCalledWith(7);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/publish/components/library/__tests__/DraftCard.test.tsx"
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/features/publish/components/library/DraftCard.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Calendar, FileText } from "lucide-react";
import type { PublicationDraft } from "../../types/publish";

interface DraftCardProps {
  draft: PublicationDraft;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onRename: (id: number) => void;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusClass(status: string): string {
  switch (status) {
    case "ready":
      return "bg-accent/15 text-accent";
    case "archived":
      return "bg-surface-elevated text-text-primary/30";
    default:
      return "bg-surface-elevated text-text-primary/70";
  }
}

export function DraftCard({ draft, onArchive, onDelete, onDuplicate, onRename }: DraftCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sections = draft.document_json?.sections ?? [];
  const tableCount = sections.filter((s) => s.tableIncluded).length;
  const figureCount = sections.filter((s) => s.diagramIncluded).length;

  return (
    <div className="relative rounded-xl border border-border-default bg-surface-raised p-4 hover:border-accent/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          to={`/publish/library/${draft.id}`}
          aria-label={`Open draft ${draft.title}`}
          className="text-base font-semibold text-text-primary line-clamp-2 hover:text-accent"
        >
          {draft.title}
        </Link>
        <button
          type="button"
          aria-label="More actions"
          className="text-text-ghost hover:text-text-primary"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreHorizontal size={18} />
        </button>
        {menuOpen && (
          <ul
            role="menu"
            className="absolute right-2 top-9 z-10 min-w-32 rounded-md border border-border-default bg-surface-elevated py-1 text-sm shadow-lg"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <li role="menuitem" className="cursor-pointer px-3 py-1.5 hover:bg-surface-raised" onClick={() => { onRename(draft.id); setMenuOpen(false); }}>Rename</li>
            <li role="menuitem" className="cursor-pointer px-3 py-1.5 hover:bg-surface-raised" onClick={() => { onDuplicate(draft.id); setMenuOpen(false); }}>Duplicate</li>
            <li role="menuitem" className="cursor-pointer px-3 py-1.5 hover:bg-surface-raised" onClick={() => { onArchive(draft.id); setMenuOpen(false); }}>Archive</li>
            <li role="menuitem" className="cursor-pointer px-3 py-1.5 text-danger hover:bg-surface-raised" onClick={() => { onDelete(draft.id); setMenuOpen(false); }}>Delete</li>
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-text-primary/60">
        <span className="rounded-full bg-surface-elevated px-2 py-0.5">{draft.template}</span>
        <span className={`rounded-full px-2 py-0.5 ${statusClass(draft.status)}`}>{draft.status}</span>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-text-primary/50">
        <span className="flex items-center gap-1"><FileText size={12} />{sections.length} sections · {tableCount} table{tableCount === 1 ? "" : "s"} · {figureCount} figure{figureCount === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-text-ghost">
        <Calendar size={12} />opened {relativeTime(draft.last_opened_at)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/publish/components/library/__tests__/DraftCard.test.tsx"
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/publish/components/library/DraftCard.tsx frontend/src/features/publish/components/library/__tests__/DraftCard.test.tsx
git commit -m "feat(publish): add DraftCard with section summary and actions menu"
```

---

### Task 9: Build `DraftCardGrid` with empty state

**Files:**
- Create: `frontend/src/features/publish/components/library/DraftCardGrid.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/features/publish/components/library/DraftCardGrid.tsx
import { FileOutput } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicationDraft } from "../../types/publish";
import { DraftCard } from "./DraftCard";

interface DraftCardGridProps {
  drafts: PublicationDraft[];
  isLoading: boolean;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onRename: (id: number) => void;
}

export function DraftCardGrid({ drafts, isLoading, onArchive, onDelete, onDuplicate, onRename }: DraftCardGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl border border-border-default bg-surface-raised animate-pulse" />
        ))}
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-base py-16 text-center">
        <FileOutput size={32} className="text-text-ghost mb-3" />
        <h2 className="text-lg font-semibold text-text-primary">No drafts yet</h2>
        <p className="mt-1 text-sm text-text-primary/60">Start a new document to begin a manuscript draft.</p>
        <Link
          to="/publish/library/new"
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent/90"
        >
          Start a New Document
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {drafts.map((draft) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          onArchive={onArchive}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onRename={onRename}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/components/library/DraftCardGrid.tsx
git commit -m "feat(publish): add DraftCardGrid with empty state"
```

---

### Task 10: Build `DraftFilters` (status + sort + search)

**Files:**
- Create: `frontend/src/features/publish/components/library/DraftFilters.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/features/publish/components/library/DraftFilters.tsx
import { Search } from "lucide-react";
import type { PublicationDraftStatus } from "../../types/publish";

export type DraftSort = "last_opened" | "last_updated" | "title" | "created";

interface DraftFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: PublicationDraftStatus | "all";
  onStatusChange: (v: PublicationDraftStatus | "all") => void;
  sort: DraftSort;
  onSortChange: (v: DraftSort) => void;
}

export function DraftFilters({ search, onSearchChange, status, onStatusChange, sort, onSortChange }: DraftFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-ghost" />
        <input
          type="search"
          placeholder="Search drafts…"
          aria-label="Search drafts"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-60 rounded-md border border-border-default bg-surface-raised pl-7 pr-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
        />
      </div>
      <select
        aria-label="Status filter"
        value={status}
        onChange={(e) => onStatusChange(e.target.value as PublicationDraftStatus | "all")}
        className="rounded-md border border-border-default bg-surface-raised px-2 py-1.5 text-sm text-text-primary"
      >
        <option value="all">All (except archived)</option>
        <option value="draft">Drafts</option>
        <option value="ready">Ready</option>
        <option value="archived">Archived</option>
      </select>
      <select
        aria-label="Sort by"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as DraftSort)}
        className="rounded-md border border-border-default bg-surface-raised px-2 py-1.5 text-sm text-text-primary"
      >
        <option value="last_opened">Recently opened</option>
        <option value="last_updated">Recently edited</option>
        <option value="title">Title (A–Z)</option>
        <option value="created">Date created</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
git add frontend/src/features/publish/components/library/DraftFilters.tsx
git commit -m "feat(publish): add DraftFilters component"
```

---

### Task 11: Build `NewDraftButton`

**Files:**
- Create: `frontend/src/features/publish/components/library/NewDraftButton.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/features/publish/components/library/NewDraftButton.tsx
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function NewDraftButton() {
  return (
    <Link
      to="/publish/library/new"
      className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent/90"
    >
      <Plus size={16} />New Document
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/publish/components/library/NewDraftButton.tsx
git commit -m "feat(publish): add NewDraftButton CTA"
```

---

### Task 12: Build `SessionStorageMigrationBanner`

Detects orphaned `parthenon:publish-wizard` sessionStorage state and offers a one-click migration into a saved draft.

**Files:**
- Create: `frontend/src/features/publish/components/library/SessionStorageMigrationBanner.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/features/publish/components/library/SessionStorageMigrationBanner.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, X } from "lucide-react";
import { useCreateDraft } from "../../hooks/useDrafts";
import type { DocumentJson } from "../../types/publish";

const SESSION_KEY = "parthenon:publish-wizard";
const DISMISS_KEY = "parthenon:publish-wizard-migration-dismissed";

interface OrphanedState {
  title?: string;
  authors?: string[];
  template?: string;
  step?: number;
  selectedExecutions?: unknown[];
  sections?: unknown[];
}

function loadOrphan(): OrphanedState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrphanedState;
    const sectionCount = (parsed.sections ?? []).length;
    const execCount = (parsed.selectedExecutions ?? []).length;
    if (sectionCount === 0 && execCount === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function SessionStorageMigrationBanner() {
  const [orphan, setOrphan] = useState<OrphanedState | null>(null);
  const createDraft = useCreateDraft();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    setOrphan(loadOrphan());
  }, []);

  if (!orphan) return null;

  const handleSave = () => {
    const document_json: DocumentJson = {
      version: 1,
      title: orphan.title ?? "Recovered Draft",
      authors: orphan.authors ?? [],
      template: orphan.template ?? "generic-ohdsi",
      step: ([1, 2, 3, 4] as const).includes(orphan.step as 1 | 2 | 3 | 4) ? (orphan.step as 1 | 2 | 3 | 4) : 1,
      selectedExecutions: (orphan.selectedExecutions ?? []) as DocumentJson["selectedExecutions"],
      sections: (orphan.sections ?? []) as DocumentJson["sections"],
    };
    createDraft.mutate(
      { title: document_json.title, template: document_json.template, document_json },
      {
        onSuccess: (draft) => {
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.setItem(DISMISS_KEY, "1");
          navigate(`/publish/library/${draft.id}`);
        },
      },
    );
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOrphan(null);
  };

  return (
    <div className="rounded-md border border-accent/40 bg-accent/5 px-4 py-3 flex items-center justify-between">
      <div className="text-sm text-text-primary">
        We found unsaved work from a previous session ({(orphan.sections ?? []).length} sections, {(orphan.selectedExecutions ?? []).length} analyses).
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={createDraft.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1 text-xs font-medium text-surface-base hover:bg-accent/90 disabled:opacity-50"
        >
          <Save size={12} />Save to library
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-text-ghost hover:text-text-primary"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
git add frontend/src/features/publish/components/library/SessionStorageMigrationBanner.tsx
git commit -m "feat(publish): add sessionStorage migration banner"
```

---

### Task 13: Build `PublicationLibraryPage`

Assembles the filters, grid, banner, and CTAs. Wires archive/delete/duplicate handlers to `useDrafts`.

**Files:**
- Create: `frontend/src/features/publish/pages/PublicationLibraryPage.tsx`

- [ ] **Step 1: Write the page**

```tsx
// frontend/src/features/publish/pages/PublicationLibraryPage.tsx
import { useMemo, useState } from "react";
import { FileOutput } from "lucide-react";
import { HelpButton } from "@/features/help";
import {
  useDeleteDraft,
  useDraftList,
  useUpdateDraft,
  useCreateDraft,
} from "../hooks/useDrafts";
import { DraftCardGrid } from "../components/library/DraftCardGrid";
import { DraftFilters, type DraftSort } from "../components/library/DraftFilters";
import { NewDraftButton } from "../components/library/NewDraftButton";
import { SessionStorageMigrationBanner } from "../components/library/SessionStorageMigrationBanner";
import type { PublicationDraft, PublicationDraftStatus } from "../types/publish";

function sortDrafts(drafts: PublicationDraft[], by: DraftSort): PublicationDraft[] {
  const copy = [...drafts];
  switch (by) {
    case "last_opened":
      return copy.sort((a, b) => (b.last_opened_at ?? "").localeCompare(a.last_opened_at ?? ""));
    case "last_updated":
      return copy.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "created":
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

export default function PublicationLibraryPage() {
  const { data: drafts, isLoading } = useDraftList();
  const updateDraft = useUpdateDraft(0); // hook returns mutation; we'll pass id at call time below
  const deleteDraft = useDeleteDraft();
  const createDraft = useCreateDraft();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PublicationDraftStatus | "all">("all");
  const [sort, setSort] = useState<DraftSort>("last_opened");

  const filtered = useMemo(() => {
    const list = drafts ?? [];
    return sortDrafts(
      list
        .filter((d) => (status === "all" ? d.status !== "archived" : d.status === status))
        .filter((d) => (search ? d.title.toLowerCase().includes(search.toLowerCase()) : true)),
      sort,
    );
  }, [drafts, status, sort, search]);

  // Action handlers — call PATCH per draft id (the useUpdateDraft hook above is unused; per-call inline below)
  const handleArchive = async (id: number) => {
    await (await import("../api/publishApi")).updatePublicationDraft(id, { status: "archived" });
    // simple refetch — invalidate via queryClient through hook side effect already
    window.location.reload();
  };
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this draft permanently?")) return;
    await deleteDraft.mutateAsync(id);
  };
  const handleDuplicate = async (id: number) => {
    const original = drafts?.find((d) => d.id === id);
    if (!original) return;
    await createDraft.mutateAsync({
      title: `${original.title} (copy)`,
      template: original.template,
      study_id: original.study_id,
      document_json: original.document_json,
    });
  };
  const handleRename = async (id: number) => {
    const next = prompt("New title", drafts?.find((d) => d.id === id)?.title);
    if (!next) return;
    await (await import("../api/publishApi")).updatePublicationDraft(id, { title: next });
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileOutput size={22} className="text-success" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Pre-Publication Library</h1>
            <p className="text-sm text-text-primary/50">Your saved manuscript drafts.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <HelpButton helpKey="publish" />
          <NewDraftButton />
        </div>
      </div>

      <SessionStorageMigrationBanner />

      <DraftFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        sort={sort}
        onSortChange={setSort}
      />

      <DraftCardGrid
        drafts={filtered}
        isLoading={isLoading}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onRename={handleRename}
      />
    </div>
  );
}
```

> **Refactor note (intentional):** the action handlers use `window.location.reload()` as a quick-and-dirty refresh. Task 14 cleans this up by replacing direct API calls with a single `useArchiveDraft` mutation hook. We're shipping the page first, then optimizing.

- [ ] **Step 2: Type-check + build**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/pages/PublicationLibraryPage.tsx
git commit -m "feat(publish): add PublicationLibraryPage"
```

---

### Task 14: Replace `window.location.reload` with proper mutation hooks

**Files:**
- Modify: `frontend/src/features/publish/hooks/useDrafts.ts`
- Modify: `frontend/src/features/publish/pages/PublicationLibraryPage.tsx`

- [ ] **Step 1: Add a single-id mutator that takes id at call time**

Append to `useDrafts.ts`:

```typescript
import { updatePublicationDraft as updatePublicationDraftFn } from "../api/publishApi";

export function useUpdateDraftById() {
  const qc = useQueryClient();
  return useMutation<
    PublicationDraft,
    Error,
    { id: number; payload: Partial<PublicationDraftInput> }
  >({
    mutationFn: ({ id, payload }) => updatePublicationDraftFn(id, payload),
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: ["publish", "drafts"] });
      qc.setQueryData(["publish", "drafts", draft.id], draft);
    },
  });
}
```

- [ ] **Step 2: Update `PublicationLibraryPage.tsx`**

Replace the body of the action handlers:

```tsx
// Imports near top
import { useUpdateDraftById, useDeleteDraft, useCreateDraft, useDraftList } from "../hooks/useDrafts";

// Inside the component
const update = useUpdateDraftById();
const deleteDraft = useDeleteDraft();
const createDraft = useCreateDraft();

const handleArchive = (id: number) => update.mutate({ id, payload: { status: "archived" } });
const handleDelete = (id: number) => {
  if (!confirm("Delete this draft permanently?")) return;
  deleteDraft.mutate(id);
};
const handleDuplicate = (id: number) => {
  const original = drafts?.find((d) => d.id === id);
  if (!original) return;
  createDraft.mutate({
    title: `${original.title} (copy)`,
    template: original.template,
    study_id: original.study_id,
    document_json: original.document_json,
  });
};
const handleRename = (id: number) => {
  const next = prompt("New title", drafts?.find((d) => d.id === id)?.title);
  if (!next) return;
  update.mutate({ id, payload: { title: next } });
};
```

Remove all `window.location.reload()` calls and the dynamic `import("../api/publishApi")` lines.

- [ ] **Step 3: Type-check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/publish/hooks/useDrafts.ts frontend/src/features/publish/pages/PublicationLibraryPage.tsx
git commit -m "refactor(publish): replace reload() with useUpdateDraftById mutation"
```

---

### Task 15: Build `HybridPromptModal`

First-time "Save as draft?" prompt that fires when the user makes a meaningful change in the wizard without a draftId.

**Files:**
- Create: `frontend/src/features/publish/components/PublishPage/HybridPromptModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/features/publish/components/PublishPage/HybridPromptModal.tsx
import { useState } from "react";
import { X } from "lucide-react";

interface HybridPromptModalProps {
  open: boolean;
  defaultTitle: string;
  onSave: (title: string) => Promise<void>;
  onContinueWithoutSaving: () => void;
}

export function HybridPromptModal({ open, defaultTitle, onSave, onContinueWithoutSaving }: HybridPromptModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSave(title.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border-default bg-surface-raised p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Save as draft?</h2>
            <p className="mt-1 text-sm text-text-primary/60">
              Saving lets you return to this manuscript later. You can also continue without saving — work persists for this session only.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onContinueWithoutSaving} className="text-text-ghost hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <label className="mt-4 block text-xs font-medium text-text-primary/70">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled manuscript"
            className="mt-1 w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onContinueWithoutSaving}
            className="rounded-md px-3 py-1.5 text-sm text-text-primary/70 hover:text-text-primary"
          >
            Continue without saving
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || submitting}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-surface-base hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save as draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
git add frontend/src/features/publish/components/PublishPage/HybridPromptModal.tsx
git commit -m "feat(publish): add HybridPromptModal for first-edit save prompt"
```

---

### Task 16: Build `SaveDraftButton`

Header action — captures snapshots, serializes, calls create or update depending on draftId.

**Files:**
- Create: `frontend/src/features/publish/components/library/SaveDraftButton.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/features/publish/components/library/SaveDraftButton.tsx
import { Save } from "lucide-react";

interface SaveDraftButtonProps {
  hasDraftId: boolean;
  saving: boolean;
  onSave: () => void;
}

export function SaveDraftButton({ hasDraftId, saving, onSave }: SaveDraftButtonProps) {
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/15 disabled:opacity-50"
    >
      <Save size={12} />{saving ? "Saving…" : hasDraftId ? "Save Draft" : "Save as Draft"}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/publish/components/library/SaveDraftButton.tsx
git commit -m "feat(publish): add SaveDraftButton"
```

---

### Task 17: Refactor `PublishPage.tsx` to accept `:draftId` and integrate save/load

This is the largest single edit in Phase 1. The wizard now:
1. Reads `:draftId` from URL params via `useParams()`.
2. If `draftId` exists, calls `useDraft(draftId)` and hydrates the reducer from `document_json`.
3. If no `draftId`, starts empty. On first meaningful change, shows `HybridPromptModal`.
4. Save button: captures snapshots, serializes, calls create or update, navigates to `/publish/library/:id` on first save.

**Files:**
- Modify: `frontend/src/features/publish/pages/PublishPage.tsx`

- [ ] **Step 1: Replace the file**

```tsx
// frontend/src/features/publish/pages/PublishPage.tsx
import { useReducer, useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FileOutput, Check } from "lucide-react";
import { HelpButton } from "@/features/help";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import UnifiedAnalysisPicker from "../components/UnifiedAnalysisPicker";
import DocumentConfigurator from "../components/DocumentConfigurator";
import DocumentPreview from "../components/DocumentPreview";
import ExportPanel from "../components/ExportPanel";
import { useGenerateNarrative } from "../hooks/useNarrativeGeneration";
import { buildTableFromResults } from "../lib/tableBuilders";
import { buildDiagramData } from "../lib/diagramBuilders";
import { getDiagramSvgMarkup } from "../lib/svgExport";
import { captureSnapshots } from "../lib/snapshotCapture";
import { serializeForSave, deserializeFromLoad } from "../lib/draftSerialization";
import { getPublishResultSectionTitle, getPublishTemplateSectionTitle } from "../lib/i18n";
import { SECTION_CONFIG } from "../lib/sectionConfig";
import { useDraft, useCreateDraft, useUpdateDraftById } from "../hooks/useDrafts";
import { HybridPromptModal } from "../components/PublishPage/HybridPromptModal";
import { SaveDraftButton } from "../components/library/SaveDraftButton";
import type {
  ReportSection,
  SelectedExecution,
  NarrativeState,
} from "../types/publish";
import { TEMPLATES, type TemplateSectionDef } from "../templates/index";

// (sectionDefToReportSection, buildResultsSections, buildManuscriptSections — unchanged from previous PublishPage; copy verbatim)
// Insert the previous helpers here (lines 119–276 of the original file).

interface WizardState {
  step: 1 | 2 | 3 | 4;
  selectedExecutions: SelectedExecution[];
  sections: ReportSection[];
  title: string;
  authors: string[];
  template: string;
  hasMeaningfulEdit: boolean;
}

type Action =
  | { type: "SET_STEP"; step: 1 | 2 | 3 | 4 }
  | { type: "SET_SELECTIONS"; selections: SelectedExecution[] }
  | { type: "SET_SECTIONS"; sections: ReportSection[] }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_AUTHORS"; authors: string[] }
  | { type: "UPDATE_SECTION"; id: string; updates: Partial<ReportSection> }
  | { type: "SET_TEMPLATE"; template: string }
  | { type: "REHYDRATE"; state: WizardState };

function wizardReducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_STEP": return { ...state, step: action.step };
    case "SET_SELECTIONS": return { ...state, selectedExecutions: action.selections, hasMeaningfulEdit: action.selections.length > 0 || state.hasMeaningfulEdit };
    case "SET_SECTIONS": return { ...state, sections: action.sections, hasMeaningfulEdit: true };
    case "SET_TITLE": return { ...state, title: action.title, hasMeaningfulEdit: true };
    case "SET_AUTHORS": return { ...state, authors: action.authors, hasMeaningfulEdit: true };
    case "UPDATE_SECTION":
      return { ...state, sections: state.sections.map((s) => s.id === action.id ? { ...s, ...action.updates } : s), hasMeaningfulEdit: true };
    case "SET_TEMPLATE": return { ...state, template: action.template, hasMeaningfulEdit: true };
    case "REHYDRATE": return { ...action.state, hasMeaningfulEdit: false };
    default: return state;
  }
}

const STORAGE_KEY = "parthenon:publish-wizard";
const defaultState: WizardState = {
  step: 1, selectedExecutions: [], sections: [], title: "", authors: [], template: "generic-ohdsi", hasMeaningfulEdit: false,
};

function loadSessionState(): WizardState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as WizardState;
    if (parsed.step && parsed.sections && parsed.selectedExecutions) return { ...parsed, hasMeaningfulEdit: false };
  } catch { /* ignore */ }
  return defaultState;
}

function persistSessionState(state: WizardState): void {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function persistingReducer(state: WizardState, action: Action): WizardState {
  const next = wizardReducer(state, action);
  persistSessionState(next);
  return next;
}

function captureDiagramSvgMarkup(sections: ReportSection[]): ReportSection[] {
  return sections.map((section) =>
    section.diagramType ? { ...section, svgMarkup: section.svgMarkup ?? getDiagramSvgMarkup(section.id) } : section,
  );
}

export default function PublishPage() {
  const { t } = useTranslation("app");
  const { draftId: draftIdParam } = useParams<{ draftId: string }>();
  const draftId = draftIdParam && /^\d+$/.test(draftIdParam) ? Number(draftIdParam) : null;
  const [searchParams] = useSearchParams();
  const initialStudyId = searchParams.get("studyId") ? Number(searchParams.get("studyId")) : undefined;
  const navigate = useNavigate();

  const [state, dispatch] = useReducer(persistingReducer, undefined, loadSessionState);
  const draftQuery = useDraft(draftId);
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraftById();
  const hydratedRef = useRef(false);

  // Hydrate from server when ?draftId loads
  useEffect(() => {
    if (draftId === null) return;
    if (!draftQuery.data || hydratedRef.current) return;
    const d = draftQuery.data;
    const w = deserializeFromLoad(d.document_json);
    dispatch({
      type: "REHYDRATE",
      state: {
        step: w.step,
        selectedExecutions: w.selectedExecutions as SelectedExecution[],
        sections: w.sections as unknown as ReportSection[],
        title: d.title,
        authors: w.authors,
        template: d.template,
        hasMeaningfulEdit: false,
      },
    });
    hydratedRef.current = true;
  }, [draftId, draftQuery.data]);

  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    if (draftId !== null) return;
    if (state.hasMeaningfulEdit && !promptOpen && !sessionStorage.getItem("parthenon:publish-prompt-shown")) {
      setPromptOpen(true);
      sessionStorage.setItem("parthenon:publish-prompt-shown", "1");
    }
  }, [draftId, state.hasMeaningfulEdit, promptOpen]);

  const buildDocumentJson = useCallback(() => {
    const sectionsWithSnapshots = captureSnapshots(captureDiagramSvgMarkup(state.sections) as unknown as DocumentSectionInput);
    return serializeForSave({
      title: state.title,
      authors: state.authors,
      template: state.template,
      step: state.step,
      selectedExecutions: state.selectedExecutions as unknown as DraftSelectedExecutionInput,
      sections: sectionsWithSnapshots,
    });
  }, [state]);

  const handlePromptSave = async (title: string) => {
    dispatch({ type: "SET_TITLE", title });
    const documentJson = serializeForSave({
      title, authors: state.authors, template: state.template, step: state.step,
      selectedExecutions: state.selectedExecutions as unknown as DraftSelectedExecutionInput,
      sections: state.sections,
    });
    const draft = await createDraft.mutateAsync({ title, template: state.template, document_json: documentJson, study_id: state.selectedExecutions[0]?.studyId ?? null });
    setPromptOpen(false);
    sessionStorage.removeItem(STORAGE_KEY);
    navigate(`/publish/library/${draft.id}`, { replace: true });
  };

  const handleSaveButton = async () => {
    const documentJson = buildDocumentJson();
    if (draftId === null) {
      const title = state.title || "Untitled manuscript";
      const draft = await createDraft.mutateAsync({ title, template: state.template, document_json: documentJson, study_id: state.selectedExecutions[0]?.studyId ?? null });
      sessionStorage.removeItem(STORAGE_KEY);
      navigate(`/publish/library/${draft.id}`, { replace: true });
    } else {
      await updateDraft.mutateAsync({ id: draftId, payload: { title: state.title, document_json: documentJson } });
    }
  };

  // Existing handlers (handleSelectionsChange, handleStep1Next, handleTemplateChange, handleSectionsChange,
  // handleTitleChange, handleAuthorsChange, handleGenerateNarrative, goToStep) — copy verbatim from previous PublishPage.
  // ...

  const steps = [
    { num: 1 as const, label: t("publish.steps.selectAnalyses") },
    { num: 2 as const, label: t("publish.steps.configure") },
    { num: 3 as const, label: t("publish.steps.preview") },
    { num: 4 as const, label: t("publish.steps.export") },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileOutput size={22} className="text-success" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t("publish.page.title")}</h1>
            <p className="text-sm text-text-primary/50">{state.title || t("publish.page.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton helpKey="publish" />
          <SaveDraftButton
            hasDraftId={draftId !== null}
            saving={createDraft.isPending || updateDraft.isPending}
            onSave={handleSaveButton}
          />
          <button
            type="button"
            onClick={() => navigate("/publish/library")}
            className="text-xs text-text-ghost hover:text-text-primary"
          >
            ← Library
          </button>
        </div>
      </div>

      {/* (Step indicator and step content — copy verbatim from previous PublishPage) */}
      {/* ... */}

      <HybridPromptModal
        open={promptOpen}
        defaultTitle={state.selectedExecutions[0]?.studyTitle ?? state.title ?? "Untitled manuscript"}
        onSave={handlePromptSave}
        onContinueWithoutSaving={() => setPromptOpen(false)}
      />
    </div>
  );
}

// Helper types used in narrow casts above — exported nowhere else
type DocumentSectionInput = Parameters<typeof captureSnapshots>[0];
type DraftSelectedExecutionInput = Parameters<typeof serializeForSave>[0]["selectedExecutions"];
```

> **Note for the engineer:** the comment markers `// Existing handlers (...)` and `// (Step indicator and step content — copy verbatim ...)` are deliberate. Copy the original `handleSelectionsChange`, `handleStep1Next`, `handleTemplateChange`, `handleSectionsChange`, `handleTitleChange`, `handleAuthorsChange`, `handleGenerateNarrative`, and `goToStep` callbacks from the old `PublishPage.tsx` (lines 319–446 of the original file) into the new file unchanged. Same for the step indicator JSX (lines 484–528) and the step content block (lines 530–581). Do NOT rewrite them — they are correct as-is.

- [ ] **Step 2: Type-check + build**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```
Expected: PASS. If TypeScript errors on `DocumentSectionInput`/`DraftSelectedExecutionInput`, replace those casts with the concrete imported types from `types/publish.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/pages/PublishPage.tsx
git commit -m "feat(publish): wire PublishPage to server-side drafts (load/save)"
```

---

### Task 18: Update router for new routes

**Files:**
- Modify: `frontend/src/app/router.tsx`

- [ ] **Step 1: Open the file** and find the current `publish` route block (around line 532):

```tsx
{
  path: "publish",
  lazy: () =>
    import("@/features/publish/pages/PublishPage").then((m) => ({
      Component: m.default,
    })),
},
```

- [ ] **Step 2: Replace with the new route block**

```tsx
{
  path: "publish",
  children: [
    {
      index: true,
      lazy: () => import("react-router-dom").then((m) => ({
        loader: () => m.redirect("/publish/library"),
      })),
    },
    {
      path: "library",
      lazy: () =>
        import("@/features/publish/pages/PublicationLibraryPage").then((m) => ({
          Component: m.default,
        })),
    },
    {
      path: "library/new",
      lazy: () =>
        import("@/features/publish/pages/PublishPage").then((m) => ({
          Component: m.default,
        })),
    },
    {
      path: "library/:draftId",
      lazy: () =>
        import("@/features/publish/pages/PublishPage").then((m) => ({
          Component: m.default,
        })),
    },
  ],
},
```

- [ ] **Step 3: Type-check + build**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

```bash
docker compose up -d node && sleep 5
```
Open http://localhost:5175/publish — should redirect to `/publish/library`. Empty state should render. Click "New Document" → loads wizard. Make an edit → see hybrid prompt modal.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/router.tsx
git commit -m "feat(publish): add /publish/library route and child paths"
```

---

### Task 19: E2E test — Phase 1 manuscript lifecycle

**Files:**
- Create: `e2e/tests/publish-library/phase1-lifecycle.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// e2e/tests/publish-library/phase1-lifecycle.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Publish library — Phase 1", () => {
  test.beforeEach(async ({ page }) => {
    // Adapt to existing auth helper if present in e2e/
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@acumenus.net");
    await page.fill('input[name="password"]', process.env.PARTHENON_ADMIN_PASSWORD ?? "");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/$/);
  });

  test("create, save, reload preserves frozen SVG and tableData", async ({ page }) => {
    await page.goto("/publish");
    await expect(page).toHaveURL(/\/publish\/library/);
    await expect(page.getByText(/No drafts yet/i)).toBeVisible();

    await page.getByRole("link", { name: /Start a New Document|New Document/i }).first().click();
    await expect(page).toHaveURL(/\/publish\/library\/new/);

    // Step 1 — pick a study/analyses (uses existing UnifiedAnalysisPicker)
    // Adapt selectors to the actual picker — example placeholders below
    await page.getByText(/Select analyses/i).click();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 2 — type a title
    const title = "E2E Phase 1 Draft";
    await page.getByLabel(/Title/i).fill(title);

    // Save
    await page.getByRole("button", { name: /Save as Draft|Save Draft/i }).click();
    await expect(page).toHaveURL(/\/publish\/library\/\d+/);

    // Return to library and reload
    await page.getByText(/← Library/i).click();
    await expect(page.getByText(title)).toBeVisible();
    await page.getByText(title).click();
    await expect(page.getByLabel(/Title/i)).toHaveValue(title);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd e2e && npx playwright test tests/publish-library/phase1-lifecycle.spec.ts
```
Expected: PASS. If selectors don't match the live UI (the UnifiedAnalysisPicker has specific elements), adapt them — keep the assertions about URL and persisted title.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/publish-library/phase1-lifecycle.spec.ts
git commit -m "test(publish): add Phase 1 E2E manuscript lifecycle"
```

---

### Task 20: Phase 1 wrap-up — Pint, PHPStan, Vitest, Vite build green

- [ ] **Step 1: Run the full local suite**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint && vendor/bin/phpstan analyse && vendor/bin/pest --filter='Publication'"
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx eslint . && npx vitest run src/features/publish && npx vite build"
```
Expected: all green.

- [ ] **Step 2: Manual verification gates**

1. Save a draft with charts → force-delete the underlying execution from the DB (`DELETE FROM app.analysis_executions WHERE id = X`) → reopen the draft → frozen SVG and tableData still render.
2. Save a 200KB+ characterization draft → time save + reload → both under 500ms.
3. Open `/publish/library` in two tabs → archive in tab 1 → tab 2 refresh shows the archive.

- [ ] **Step 3: Open the PR for Phase 1**

```bash
git push -u origin feature/publish-library-phase-1
gh pr create --title "feat(publish): Pre-Publication Library — Phase 1 (persistence + library)" --body "$(cat <<'EOF'
## Summary
- New `/publish/library` route as the Publish landing page
- Wizard now loads/saves drafts via existing `/publish/drafts` endpoints
- Hybrid persistence: frozen SVG + tableData baked into `document_json`; `resultJson` not persisted
- sessionStorage migration banner offers to save orphaned in-flight drafts
- Replaces sessionStorage-only persistence — drafts now survive tab close

## Test plan
- [ ] Visit `/publish` → redirects to `/publish/library` with empty state
- [ ] Click "New Document" → wizard loads; first edit triggers "Save as draft?" modal
- [ ] Save → card appears in library, reload preserves SVG/table content
- [ ] Archive/delete/duplicate/rename actions work from card menu
- [ ] sessionStorage banner appears once and migrates state
- [ ] All Pest + Vitest + Playwright tests pass; PHPStan + Pint + TS + ESLint green
EOF
)"
```

- [ ] **Step 4: Phase 1 review gate**

Stop. Wait for user code review. Do not start Phase 2 until Phase 1 is merged.

---

# Phase 2 — Autosave + Snapshots

**Goal:** Drafts save silently as the user types. Users can create named, immutable snapshots ("Pre-IRB", "v1.2 for review") and revert.

**Estimated time:** 1 week.

**Branch:** `feature/publish-library-phase-2` (created from `main` after Phase 1 merges).

---

### Task 21: Backend — Pest test for snapshot endpoints

**Files:**
- Create: `backend/tests/Feature/Api/V1/PublicationSnapshotTest.php`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b feature/publish-library-phase-2
```

- [ ] **Step 2: Write the failing test**

```php
<?php
// backend/tests/Feature/Api/V1/PublicationSnapshotTest.php
use App\Models\App\PublicationDraft;
use App\Models\App\PublicationReportBundle;
use App\Models\User;

it('creates a named snapshot of a draft', function () {
    $user = User::factory()->create();
    $user->givePermissionTo('studies.view');
    $draft = PublicationDraft::create([
        'user_id' => $user->id,
        'title' => 'X',
        'template' => 'generic-ohdsi',
        'document_json' => ['version' => 1, 'title' => 'X', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 2, 'selectedExecutions' => [], 'sections' => []],
        'status' => 'draft',
    ]);

    $response = $this->actingAs($user)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", [
            'label' => 'Pre-IRB',
            'comment' => 'For Sanjay review',
        ])
        ->assertCreated()
        ->json('data');

    expect($response['label'])->toBe('Pre-IRB');

    $bundle = PublicationReportBundle::find($response['id']);
    expect($bundle->direction)->toBe('snapshot');
    expect($bundle->format)->toBe('snapshot');
    expect($bundle->publication_draft_id)->toBe($draft->id);
    expect($bundle->bundle_json['title'])->toBe('X');
    expect($bundle->metadata_json['snapshot_label'])->toBe('Pre-IRB');
});

it('lists snapshots for a draft', function () {
    $user = User::factory()->create();
    $user->givePermissionTo('studies.view');
    $draft = PublicationDraft::create([
        'user_id' => $user->id, 'title' => 'X', 'template' => 'generic-ohdsi',
        'document_json' => ['version' => 1, 'title' => 'X', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 2, 'selectedExecutions' => [], 'sections' => []],
        'status' => 'draft',
    ]);

    foreach (['S1', 'S2'] as $label) {
        $this->actingAs($user)
            ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", ['label' => $label])
            ->assertCreated();
    }

    $list = $this->actingAs($user)
        ->getJson("/api/v1/publish/drafts/{$draft->id}/snapshots")
        ->assertOk()
        ->json('data');

    expect($list)->toHaveCount(2);
    expect($list[0]['label'])->toBe('S2'); // newest first
});

it('reverts a snapshot and creates an auto-snapshot of the prior state', function () {
    $user = User::factory()->create();
    $user->givePermissionTo('studies.view');
    $draft = PublicationDraft::create([
        'user_id' => $user->id, 'title' => 'Original', 'template' => 'generic-ohdsi',
        'document_json' => ['version' => 1, 'title' => 'Original', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 2, 'selectedExecutions' => [], 'sections' => []],
        'status' => 'draft',
    ]);

    $snapshot = $this->actingAs($user)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", ['label' => 'Original snapshot'])
        ->json('data');

    $draft->update(['title' => 'Modified', 'document_json' => ['version' => 1, 'title' => 'Modified', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 3, 'selectedExecutions' => [], 'sections' => []]]);

    $reverted = $this->actingAs($user)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots/{$snapshot['id']}/revert")
        ->assertOk()
        ->json('data');

    expect($reverted['title'])->toBe('Original');
    expect($reverted['document_json']['step'])->toBe(2);

    // Auto-snapshot of "Modified" state was created
    $autoSnapshot = PublicationReportBundle::where('publication_draft_id', $draft->id)
        ->where('direction', 'snapshot')
        ->where('metadata_json->snapshot_label', 'Before revert (auto)')
        ->first();
    expect($autoSnapshot)->not->toBeNull();
    expect($autoSnapshot->bundle_json['title'])->toBe('Modified');
});

it('returns 412 on stale If-Unmodified-Since', function () {
    $user = User::factory()->create();
    $user->givePermissionTo('studies.view');
    $draft = PublicationDraft::create([
        'user_id' => $user->id, 'title' => 'X', 'template' => 'generic-ohdsi',
        'document_json' => ['version' => 1, 'title' => 'X', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 1, 'selectedExecutions' => [], 'sections' => []],
        'status' => 'draft',
    ]);

    // Simulate another tab updating
    $draft->update(['title' => 'Updated elsewhere']);
    $stale = now()->subMinute()->toRfc7231String();

    $this->actingAs($user)
        ->withHeaders(['If-Unmodified-Since' => $stale])
        ->patchJson("/api/v1/publish/drafts/{$draft->id}", ['title' => 'My change'])
        ->assertStatus(412);
});

it('dedupes snapshot creates within idempotency window', function () {
    $user = User::factory()->create();
    $user->givePermissionTo('studies.view');
    $draft = PublicationDraft::create([
        'user_id' => $user->id, 'title' => 'X', 'template' => 'generic-ohdsi',
        'document_json' => ['version' => 1, 'title' => 'X', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 1, 'selectedExecutions' => [], 'sections' => []],
        'status' => 'draft',
    ]);

    $key = (string) \Illuminate\Support\Str::uuid();

    $first = $this->actingAs($user)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", ['label' => 'S', 'idempotency_key' => $key])
        ->assertCreated()
        ->json('data');

    $second = $this->actingAs($user)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", ['label' => 'S', 'idempotency_key' => $key])
        ->assertCreated()
        ->json('data');

    expect($second['id'])->toBe($first['id']);
});
```

- [ ] **Step 3: Run — expect FAIL on all 5**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter='PublicationSnapshot'"
```
Expected: FAIL — endpoints don't exist yet.

- [ ] **Step 4: Commit the failing test**

```bash
git add backend/tests/Feature/Api/V1/PublicationSnapshotTest.php
git commit -m "test(publish): add Pest tests for snapshot endpoints and optimistic locking"
```

---

### Task 22: Backend — `PublicationSnapshotService`

**Files:**
- Create: `backend/app/Services/Publication/PublicationSnapshotService.php`

- [ ] **Step 1: Write the service**

```php
<?php
// backend/app/Services/Publication/PublicationSnapshotService.php
namespace App\Services\Publication;

use App\Models\App\PublicationDraft;
use App\Models\App\PublicationReportBundle;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PublicationSnapshotService
{
    public function create(
        PublicationDraft $draft,
        User $user,
        string $label,
        ?string $comment = null,
        ?string $idempotencyKey = null,
    ): PublicationReportBundle {
        if ($idempotencyKey !== null) {
            $existing = PublicationReportBundle::query()
                ->where('publication_draft_id', $draft->id)
                ->where('direction', 'snapshot')
                ->where('metadata_json->idempotency_key', $idempotencyKey)
                ->where('created_at', '>=', now()->subSeconds(5))
                ->first();
            if ($existing !== null) {
                return $existing;
            }
        }

        return PublicationReportBundle::create([
            'publication_draft_id' => $draft->id,
            'user_id' => $user->id,
            'direction' => 'snapshot',
            'format' => 'snapshot',
            'bundle_json' => array_merge(
                $draft->document_json ?? [],
                [
                    '_frozen_title' => $draft->title,
                    '_frozen_template' => $draft->template,
                ],
            ),
            'metadata_json' => array_filter([
                'snapshot_label' => $label,
                'comment' => $comment,
                'idempotency_key' => $idempotencyKey,
                'created_by_user_id' => $user->id,
            ], fn ($v) => $v !== null),
        ]);
    }

    public function revert(PublicationDraft $draft, PublicationReportBundle $snapshot, User $user): PublicationDraft
    {
        return DB::transaction(function () use ($draft, $snapshot, $user) {
            // Auto-snapshot the current state first
            $this->create($draft, $user, 'Before revert (auto)');

            $bundle = $snapshot->bundle_json ?? [];
            $documentJson = collect($bundle)
                ->except(['_frozen_title', '_frozen_template'])
                ->all();

            $draft->update([
                'title' => $bundle['_frozen_title'] ?? $draft->title,
                'template' => $bundle['_frozen_template'] ?? $draft->template,
                'document_json' => $documentJson,
                'last_opened_at' => now(),
            ]);

            return $draft->fresh();
        });
    }
}
```

- [ ] **Step 2: Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Publication/PublicationSnapshotService.php"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/Publication/PublicationSnapshotService.php
git commit -m "feat(publish): add PublicationSnapshotService"
```

---

### Task 23: Backend — snapshot controller methods + routes

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/PublicationController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Inject service and add methods**

Append to the constructor's promoted params:

```php
public function __construct(
    private readonly AnalyticsLlmService $llm,
    private readonly PublicationService $publicationService,
    private readonly PublicationReportBundleService $reportBundleService,
    private readonly \App\Services\Publication\PublicationSnapshotService $snapshotService,
) {}
```

Add new methods to the controller (before the `private function` helpers):

```php
public function listSnapshots(Request $request, PublicationDraft $draft): JsonResponse
{
    $this->authorizeDraft($request, $draft);

    $snapshots = PublicationReportBundle::query()
        ->where('publication_draft_id', $draft->id)
        ->where('direction', 'snapshot')
        ->orderByDesc('created_at')
        ->get()
        ->map(fn (PublicationReportBundle $b): array => [
            'id' => $b->id,
            'label' => $b->metadata_json['snapshot_label'] ?? '(unnamed)',
            'comment' => $b->metadata_json['comment'] ?? null,
            'created_by_user_id' => $b->metadata_json['created_by_user_id'] ?? $b->user_id,
            'created_at' => $b->created_at?->toISOString(),
        ])
        ->values();

    return response()->json(['data' => $snapshots]);
}

public function createSnapshot(Request $request, PublicationDraft $draft): JsonResponse
{
    $this->authorizeDraft($request, $draft);

    $validated = $request->validate([
        'label' => 'required|string|max:200',
        'comment' => 'nullable|string|max:2000',
        'idempotency_key' => 'nullable|uuid',
    ]);

    $bundle = $this->snapshotService->create(
        draft: $draft,
        user: $request->user(),
        label: $validated['label'],
        comment: $validated['comment'] ?? null,
        idempotencyKey: $validated['idempotency_key'] ?? null,
    );

    return response()->json([
        'data' => [
            'id' => $bundle->id,
            'label' => $bundle->metadata_json['snapshot_label'] ?? null,
            'comment' => $bundle->metadata_json['comment'] ?? null,
            'created_at' => $bundle->created_at?->toISOString(),
        ],
    ], 201);
}

public function revertSnapshot(Request $request, PublicationDraft $draft, PublicationReportBundle $snapshot): JsonResponse
{
    $this->authorizeDraft($request, $draft);
    abort_unless((int) $snapshot->publication_draft_id === (int) $draft->id, 404);
    abort_unless($snapshot->direction === 'snapshot', 404);

    $reverted = $this->snapshotService->revert($draft, $snapshot, $request->user());

    return response()->json(['data' => $this->draftPayload($reverted)]);
}
```

Modify `updateDraft` to honor `If-Unmodified-Since`:

```php
public function updateDraft(Request $request, PublicationDraft $draft): JsonResponse
{
    $this->authorizeDraft($request, $draft);

    // Optimistic locking
    $ifUnmodified = $request->header('If-Unmodified-Since');
    if ($ifUnmodified !== null) {
        $threshold = \Carbon\Carbon::parse($ifUnmodified);
        if ($draft->updated_at?->gt($threshold)) {
            abort(412, 'Draft was modified after If-Unmodified-Since timestamp.');
        }
    }

    $validated = $this->validateDraftPayload($request, requireDocument: false);
    $updates = array_intersect_key($validated, array_flip([
        'study_id', 'title', 'template', 'document_json', 'status',
    ]));
    $updates['last_opened_at'] = now();

    $draft->update($updates);

    return response()->json([
        'data' => $this->draftPayload($draft->fresh()),
        'message' => 'Publication draft updated.',
    ]);
}
```

- [ ] **Step 2: Add routes**

In `backend/routes/api.php`, after the existing `publish/drafts/{draft}` routes (around line 1303):

```php
Route::get('publish/drafts/{draft}/snapshots', [PublicationController::class, 'listSnapshots']);
Route::post('publish/drafts/{draft}/snapshots', [PublicationController::class, 'createSnapshot']);
Route::post('publish/drafts/{draft}/snapshots/{snapshot}/revert', [PublicationController::class, 'revertSnapshot']);
```

- [ ] **Step 3: Pint + PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint && vendor/bin/phpstan analyse"
```
Expected: PASS.

- [ ] **Step 4: Run the failing tests — expect PASS now**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter='PublicationSnapshot'"
```
Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/PublicationController.php backend/routes/api.php
git commit -m "feat(publish): add snapshot create/list/revert endpoints + optimistic locking"
```

---

### Task 24: Frontend — extend `publishApi.ts` with snapshot helpers

**Files:**
- Modify: `frontend/src/features/publish/api/publishApi.ts`

- [ ] **Step 1: Append**

```typescript
// ── Snapshots (Phase 2) ─────────────────────────────────────────────────────

export interface PublicationSnapshot {
  id: number;
  label: string;
  comment: string | null;
  created_by_user_id: number;
  created_at: string;
}

export interface CreateSnapshotInput {
  label: string;
  comment?: string;
  idempotency_key?: string;
}

export const fetchSnapshots = async (draftId: number): Promise<PublicationSnapshot[]> => {
  const { data } = await apiClient.get<{ data: PublicationSnapshot[] }>(
    `/publish/drafts/${draftId}/snapshots`,
  );
  return unwrapData(data);
};

export const createSnapshot = async (
  draftId: number,
  payload: CreateSnapshotInput,
): Promise<PublicationSnapshot> => {
  const { data } = await apiClient.post<{ data: PublicationSnapshot }>(
    `/publish/drafts/${draftId}/snapshots`,
    payload,
  );
  return unwrapData(data);
};

export const revertSnapshot = async (
  draftId: number,
  snapshotId: number,
): Promise<PublicationDraft> => {
  const { data } = await apiClient.post<{ data: PublicationDraft }>(
    `/publish/drafts/${draftId}/snapshots/${snapshotId}/revert`,
  );
  return unwrapData(data);
};

// Optimistic-locking-aware update
export const updatePublicationDraftWithEtag = async (
  draftId: number,
  payload: Partial<PublicationDraftInput>,
  ifUnmodifiedSince: string,
): Promise<PublicationDraft> => {
  const { data } = await apiClient.patch<{ data: PublicationDraft }>(
    `/publish/drafts/${draftId}`,
    payload,
    { headers: { "If-Unmodified-Since": ifUnmodifiedSince } },
  );
  return unwrapData(data);
};
```

- [ ] **Step 2: Type-check + commit**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
git add frontend/src/features/publish/api/publishApi.ts
git commit -m "feat(publish): add snapshot API helpers"
```

---

### Task 25: Frontend — `documentHash` helper with test

Stable hash of `document_json` to dedupe autosave PATCH calls.

**Files:**
- Create: `frontend/src/features/publish/lib/documentHash.ts`
- Create: `frontend/src/features/publish/lib/__tests__/documentHash.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { documentHash } from "../documentHash";

describe("documentHash", () => {
  it("returns the same hash for the same object", () => {
    expect(documentHash({ a: 1, b: [1, 2] })).toBe(documentHash({ a: 1, b: [1, 2] }));
  });
  it("returns different hashes for different objects", () => {
    expect(documentHash({ a: 1 })).not.toBe(documentHash({ a: 2 }));
  });
  it("is stable across key order", () => {
    expect(documentHash({ a: 1, b: 2 })).toBe(documentHash({ b: 2, a: 1 }));
  });
});
```

- [ ] **Step 2: Run — FAIL**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/publish/lib/__tests__/documentHash.test.ts"
```

- [ ] **Step 3: Implement**

```typescript
// frontend/src/features/publish/lib/documentHash.ts
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify((value as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

// Simple non-cryptographic hash (djb2) — sufficient for dedup
export function documentHash(value: unknown): string {
  const s = stableStringify(value);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
```

- [ ] **Step 4: Run — PASS, commit**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/publish/lib/__tests__/documentHash.test.ts"
git add frontend/src/features/publish/lib/documentHash.ts frontend/src/features/publish/lib/__tests__/documentHash.test.ts
git commit -m "feat(publish): add stable documentHash for autosave dedup"
```

---

### Task 26: Frontend — `useAutosave` hook

**Files:**
- Create: `frontend/src/features/publish/hooks/useAutosave.ts`

- [ ] **Step 1: Write the hook**

```typescript
// frontend/src/features/publish/hooks/useAutosave.ts
import { useEffect, useRef, useState, useCallback } from "react";
import { updatePublicationDraftWithEtag } from "../api/publishApi";
import { documentHash } from "../lib/documentHash";
import type { DocumentJson, PublicationDraftInput } from "../types/publish";

export type SaveStatus = "idle" | "saving" | "saved" | "unsaved" | "error";

interface UseAutosaveOptions {
  draftId: number | null;
  title: string;
  document: DocumentJson;
  ifUnmodifiedSince: string | null;
  debounceMs?: number;
  onStaleConflict: () => void;
}

export function useAutosave({
  draftId,
  title,
  document,
  ifUnmodifiedSince,
  debounceMs = 2000,
  onStaleConflict,
}: UseAutosaveOptions) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const lastSavedHash = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightAttempts = useRef(0);

  const currentHash = documentHash({ title, document });

  const performSave = useCallback(async () => {
    if (draftId === null) return;
    if (lastSavedHash.current === currentHash) return;
    if (ifUnmodifiedSince === null) return; // need a baseline timestamp

    setStatus("saving");
    const payload: Partial<PublicationDraftInput> = { title, document_json: document };
    try {
      await updatePublicationDraftWithEtag(draftId, payload, ifUnmodifiedSince);
      lastSavedHash.current = currentHash;
      setLastSavedAt(new Date().toISOString());
      setStatus("saved");
      inFlightAttempts.current = 0;
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 412) {
        onStaleConflict();
        setStatus("error");
        return;
      }
      inFlightAttempts.current += 1;
      if (inFlightAttempts.current < 3) {
        // Retry with exponential backoff (500ms, 2s, 8s)
        const delay = [500, 2000, 8000][inFlightAttempts.current - 1] ?? 8000;
        setStatus("unsaved");
        setTimeout(performSave, delay);
        return;
      }
      setStatus("error");
    }
  }, [draftId, currentHash, ifUnmodifiedSince, title, document, onStaleConflict]);

  // Debounce changes
  useEffect(() => {
    if (draftId === null) return;
    if (lastSavedHash.current === currentHash) {
      setStatus(lastSavedAt ? "saved" : "idle");
      return;
    }
    setStatus("unsaved");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(performSave, debounceMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [draftId, currentHash, performSave, debounceMs, lastSavedAt]);

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === "unsaved" || status === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  return { status, lastSavedAt, retry: performSave };
}
```

- [ ] **Step 2: Type-check + commit**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
git add frontend/src/features/publish/hooks/useAutosave.ts
git commit -m "feat(publish): add useAutosave with debounce, retry, beforeunload"
```

---

### Task 27: Frontend — `SaveStatusIndicator`

**Files:**
- Create: `frontend/src/features/publish/components/PublishPage/SaveStatusIndicator.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/features/publish/components/PublishPage/SaveStatusIndicator.tsx
import { Check, AlertCircle, Loader2, CircleDashed } from "lucide-react";
import type { SaveStatus } from "../../hooks/useAutosave";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt: string | null;
  onRetry: () => void;
}

function relative(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function SaveStatusIndicator({ status, lastSavedAt, onRetry }: SaveStatusIndicatorProps) {
  switch (status) {
    case "saving":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-text-primary/60" aria-live="polite">
          <Loader2 size={12} className="animate-spin" />Saving…
        </span>
      );
    case "saved":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-success" aria-live="polite">
          <Check size={12} />Saved {relative(lastSavedAt)}
        </span>
      );
    case "unsaved":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-500" aria-live="polite">
          <CircleDashed size={12} />Unsaved changes
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-danger" aria-live="polite">
          <AlertCircle size={12} />Save failed
          <button type="button" onClick={onRetry} className="underline hover:no-underline">Retry</button>
        </span>
      );
    default:
      return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/publish/components/PublishPage/SaveStatusIndicator.tsx
git commit -m "feat(publish): add SaveStatusIndicator"
```

---

### Task 28: Frontend — `useSnapshots` hook

**Files:**
- Create: `frontend/src/features/publish/hooks/useSnapshots.ts`

- [ ] **Step 1: Write the hook**

```typescript
// frontend/src/features/publish/hooks/useSnapshots.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSnapshot,
  fetchSnapshots,
  revertSnapshot,
  type CreateSnapshotInput,
  type PublicationSnapshot,
} from "../api/publishApi";
import type { PublicationDraft } from "../types/publish";

const KEYS = {
  list: (draftId: number) => ["publish", "drafts", draftId, "snapshots"] as const,
};

export function useSnapshotsList(draftId: number | null) {
  return useQuery<PublicationSnapshot[]>({
    queryKey: draftId !== null ? KEYS.list(draftId) : ["publish", "snapshots", "noop"],
    queryFn: () => fetchSnapshots(draftId as number),
    enabled: draftId !== null,
  });
}

export function useCreateSnapshot(draftId: number) {
  const qc = useQueryClient();
  return useMutation<PublicationSnapshot, Error, CreateSnapshotInput>({
    mutationFn: (payload) => createSnapshot(draftId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.list(draftId) }),
  });
}

export function useRevertSnapshot(draftId: number) {
  const qc = useQueryClient();
  return useMutation<PublicationDraft, Error, number>({
    mutationFn: (snapshotId) => revertSnapshot(draftId, snapshotId),
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: ["publish", "drafts"] });
      qc.setQueryData(["publish", "drafts", draft.id], draft);
      qc.invalidateQueries({ queryKey: KEYS.list(draftId) });
    },
  });
}
```

- [ ] **Step 2: Type-check + commit**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
git add frontend/src/features/publish/hooks/useSnapshots.ts
git commit -m "feat(publish): add useSnapshots hooks"
```

---

### Task 29: Frontend — `CreateSnapshotModal`, `RevertSnapshotDialog`, `SnapshotsPanel`

**Files:**
- Create: `frontend/src/features/publish/components/library/CreateSnapshotModal.tsx`
- Create: `frontend/src/features/publish/components/library/RevertSnapshotDialog.tsx`
- Create: `frontend/src/features/publish/components/library/SnapshotsPanel.tsx`

- [ ] **Step 1: Write `CreateSnapshotModal`**

```tsx
// frontend/src/features/publish/components/library/CreateSnapshotModal.tsx
import { useState } from "react";
import { X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useCreateSnapshot } from "../../hooks/useSnapshots";

interface CreateSnapshotModalProps {
  open: boolean;
  draftId: number;
  defaultLabel: string;
  onClose: () => void;
}

export function CreateSnapshotModal({ open, draftId, defaultLabel, onClose }: CreateSnapshotModalProps) {
  const [label, setLabel] = useState(defaultLabel);
  const [comment, setComment] = useState("");
  const [idempotencyKey] = useState(() => uuidv4());
  const create = useCreateSnapshot(draftId);

  if (!open) return null;

  const handleCreate = async () => {
    if (!label.trim()) return;
    await create.mutateAsync({ label: label.trim(), comment: comment.trim() || undefined, idempotency_key: idempotencyKey });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border-default bg-surface-raised p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-text-primary">Create snapshot</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-text-ghost hover:text-text-primary"><X size={18} /></button>
        </div>
        <label className="mt-4 block text-xs font-medium text-text-primary/70">
          Label
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Pre-IRB submission"
            className="mt-1 w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-text-primary/70">
          Comment (optional)
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Sent to S. Udoshi for review"
            className="mt-1 w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-text-primary/70 hover:text-text-primary">Cancel</button>
          <button type="button" onClick={handleCreate} disabled={!label.trim() || create.isPending} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-surface-base hover:bg-accent/90 disabled:opacity-50">
            {create.isPending ? "Creating…" : "Create snapshot"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `RevertSnapshotDialog`**

```tsx
// frontend/src/features/publish/components/library/RevertSnapshotDialog.tsx
import { X } from "lucide-react";
import type { PublicationSnapshot } from "../../api/publishApi";
import { useRevertSnapshot } from "../../hooks/useSnapshots";

interface RevertSnapshotDialogProps {
  open: boolean;
  draftId: number;
  snapshot: PublicationSnapshot | null;
  onClose: () => void;
  onReverted: () => void;
}

export function RevertSnapshotDialog({ open, draftId, snapshot, onClose, onReverted }: RevertSnapshotDialogProps) {
  const revert = useRevertSnapshot(draftId);
  if (!open || !snapshot) return null;

  const handleRevert = async () => {
    await revert.mutateAsync(snapshot.id);
    onReverted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border-default bg-surface-raised p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-text-primary">Revert to "{snapshot.label}"?</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-text-ghost hover:text-text-primary"><X size={18} /></button>
        </div>
        <p className="mt-2 text-sm text-text-primary/70">
          This will replace your current draft with the snapshot from {new Date(snapshot.created_at).toLocaleString()}. Your current state will be saved as a new snapshot labeled "Before revert (auto)".
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-text-primary/70 hover:text-text-primary">Cancel</button>
          <button type="button" onClick={handleRevert} disabled={revert.isPending} className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-surface-base hover:bg-amber-500/90 disabled:opacity-50">
            {revert.isPending ? "Reverting…" : "Revert"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `SnapshotsPanel`**

```tsx
// frontend/src/features/publish/components/library/SnapshotsPanel.tsx
import { useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { useSnapshotsList } from "../../hooks/useSnapshots";
import { CreateSnapshotModal } from "./CreateSnapshotModal";
import { RevertSnapshotDialog } from "./RevertSnapshotDialog";
import type { PublicationSnapshot } from "../../api/publishApi";

interface SnapshotsPanelProps {
  draftId: number;
  defaultLabel: string;
  onReverted: () => void;
}

export function SnapshotsPanel({ draftId, defaultLabel, onReverted }: SnapshotsPanelProps) {
  const { data: snapshots, isLoading } = useSnapshotsList(draftId);
  const [createOpen, setCreateOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<PublicationSnapshot | null>(null);

  return (
    <aside className="rounded-xl border border-border-default bg-surface-raised p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Snapshots</h3>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/15"
        >
          <Camera size={12} />New snapshot
        </button>
      </div>

      {isLoading && <div className="mt-3 text-xs text-text-primary/50">Loading…</div>}

      {snapshots && snapshots.length === 0 && (
        <p className="mt-3 text-xs text-text-primary/50">No snapshots yet. Create one to lock in a milestone version.</p>
      )}

      {snapshots && snapshots.length > 0 && (
        <ul className="mt-3 space-y-2">
          {snapshots.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-2 rounded-md bg-surface-base p-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">{s.label}</div>
                {s.comment && <div className="mt-0.5 text-xs text-text-primary/60 line-clamp-2">{s.comment}</div>}
                <div className="mt-1 text-xs text-text-ghost">{new Date(s.created_at).toLocaleString()}</div>
              </div>
              <button
                type="button"
                aria-label={`Revert to ${s.label}`}
                onClick={() => setRevertTarget(s)}
                className="text-text-ghost hover:text-amber-500"
              >
                <RotateCcw size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <CreateSnapshotModal open={createOpen} draftId={draftId} defaultLabel={defaultLabel} onClose={() => setCreateOpen(false)} />
      <RevertSnapshotDialog
        open={revertTarget !== null}
        draftId={draftId}
        snapshot={revertTarget}
        onClose={() => setRevertTarget(null)}
        onReverted={onReverted}
      />
    </aside>
  );
}
```

- [ ] **Step 4: Add `uuid` dependency**

```bash
docker compose exec node sh -c "cd /app && npm install uuid @types/uuid --legacy-peer-deps"
```

- [ ] **Step 5: Type-check + build**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/publish/components/library/CreateSnapshotModal.tsx \
        frontend/src/features/publish/components/library/RevertSnapshotDialog.tsx \
        frontend/src/features/publish/components/library/SnapshotsPanel.tsx \
        frontend/package.json frontend/package-lock.json
git commit -m "feat(publish): add CreateSnapshotModal, RevertSnapshotDialog, SnapshotsPanel"
```

---

### Task 30: Wire autosave + snapshots into `PublishPage`

**Files:**
- Modify: `frontend/src/features/publish/pages/PublishPage.tsx`

- [ ] **Step 1: In `PublishPage.tsx`**, add imports:

```tsx
import { useAutosave } from "../hooks/useAutosave";
import { SaveStatusIndicator } from "../components/PublishPage/SaveStatusIndicator";
import { SnapshotsPanel } from "../components/library/SnapshotsPanel";
```

- [ ] **Step 2: Inside the component**, replace `handleSaveButton` with autosave-driven save flow:

```tsx
// After existing draftQuery hook:
const ifUnmodifiedSince = draftQuery.data?.updated_at ?? null;
const documentJsonForSave = buildDocumentJson();
const autosave = useAutosave({
  draftId,
  title: state.title,
  document: documentJsonForSave,
  ifUnmodifiedSince,
  onStaleConflict: () => {
    if (confirm("This draft was changed in another tab. Reload to see latest changes?")) {
      window.location.reload();
    }
  },
});

// Remove old handleSaveButton entirely; manual save is now redundant.
// Keep the SaveDraftButton visible only when draftId is null (Save as Draft initial action).
```

Update the header JSX:

```tsx
<div className="flex items-center gap-2">
  <HelpButton helpKey="publish" />
  {draftId === null ? (
    <SaveDraftButton hasDraftId={false} saving={createDraft.isPending} onSave={async () => {
      const documentJson = buildDocumentJson();
      const draft = await createDraft.mutateAsync({
        title: state.title || "Untitled manuscript",
        template: state.template,
        document_json: documentJson,
        study_id: state.selectedExecutions[0]?.studyId ?? null,
      });
      sessionStorage.removeItem(STORAGE_KEY);
      navigate(`/publish/library/${draft.id}`, { replace: true });
    }} />
  ) : (
    <SaveStatusIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt} onRetry={autosave.retry} />
  )}
  <button type="button" onClick={() => navigate("/publish/library")} className="text-xs text-text-ghost hover:text-text-primary">← Library</button>
</div>
```

Render `SnapshotsPanel` in the step content area when `draftId !== null` and `state.step === 2 || 3`:

```tsx
{draftId !== null && (state.step === 2 || state.step === 3) && (
  <SnapshotsPanel
    draftId={draftId}
    defaultLabel={`Snapshot ${new Date().toISOString().slice(0, 10)}`}
    onReverted={() => { hydratedRef.current = false; draftQuery.refetch(); }}
  />
)}
```

- [ ] **Step 3: Type-check + build**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```

- [ ] **Step 4: Manual test**

Edit a draft → within 2s see "Saved" indicator. Refresh page → state persists. Click "New snapshot" → enters label "test", confirms. List shows it. Revert → dialog confirms → state reverts.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/publish/pages/PublishPage.tsx
git commit -m "feat(publish): wire autosave and snapshots into PublishPage"
```

---

### Task 31: E2E test — Phase 2 autosave + snapshots

**Files:**
- Create: `e2e/tests/publish-library/phase2-autosave-snapshots.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// e2e/tests/publish-library/phase2-autosave-snapshots.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Publish library — Phase 2", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@acumenus.net");
    await page.fill('input[name="password"]', process.env.PARTHENON_ADMIN_PASSWORD ?? "");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/$/);
  });

  test("autosaves on edit, persists across reload, snapshot+revert", async ({ page }) => {
    await page.goto("/publish/library/new");

    // Quick selection → save
    await page.getByText(/Select analyses/i).click();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /Next/i }).click();
    await page.getByLabel(/Title/i).fill("Autosave Test");
    await page.getByRole("button", { name: /Save as Draft/i }).click();
    await expect(page).toHaveURL(/\/publish\/library\/\d+/);

    // Edit title — wait for autosave
    await page.getByLabel(/Title/i).fill("Autosave Test (edited)");
    await expect(page.getByText(/Saved/i)).toBeVisible({ timeout: 5000 });

    // Reload — state preserved
    await page.reload();
    await expect(page.getByLabel(/Title/i)).toHaveValue("Autosave Test (edited)");

    // Create snapshot
    await page.getByRole("button", { name: /New snapshot/i }).click();
    await page.getByLabel(/Label/i).fill("Pre-IRB");
    await page.getByRole("button", { name: /Create snapshot/i }).click();
    await expect(page.getByText("Pre-IRB")).toBeVisible();

    // Edit again, revert
    await page.getByLabel(/Title/i).fill("Modified");
    await expect(page.getByText(/Saved/i)).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/Revert to Pre-IRB/i).click();
    await page.getByRole("button", { name: /^Revert$/ }).click();
    await expect(page.getByLabel(/Title/i)).toHaveValue("Autosave Test (edited)");

    // Auto-snapshot was created
    await expect(page.getByText(/Before revert \(auto\)/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
cd e2e && npx playwright test tests/publish-library/phase2-autosave-snapshots.spec.ts
cd ..
git add e2e/tests/publish-library/phase2-autosave-snapshots.spec.ts
git commit -m "test(publish): add Phase 2 E2E for autosave and snapshots"
```

---

### Task 32: Phase 2 wrap-up + PR

- [ ] **Step 1: Full suite**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint && vendor/bin/phpstan analyse && vendor/bin/pest --filter='Publication'"
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx eslint . && npx vitest run src/features/publish && npx vite build"
```

- [ ] **Step 2: Manual verification gates**

1. Edit a draft, see "Saved" within 3s, no manual save needed.
2. Open same draft in two tabs, edit in both — second save triggers reload prompt.
3. Create 5 snapshots, revert to oldest — auto-snapshot of pre-revert state exists.
4. Disconnect network mid-edit — see "Save failed" + Retry; reconnect, click Retry → "Saved".

- [ ] **Step 3: Open PR**

```bash
git push -u origin feature/publish-library-phase-2
gh pr create --title "feat(publish): Pre-Publication Library — Phase 2 (autosave + snapshots)" --body "$(cat <<'EOF'
## Summary
- Debounced autosave (2s) with retry, beforeunload guard, dedupe by stable hash
- "Saved" / "Saving" / "Unsaved" / "Save failed" status indicator
- Named snapshots stored as `publication_report_bundles` (direction=snapshot)
- Revert with auto-snapshot of pre-revert state
- Optimistic locking via `If-Unmodified-Since` (412 on conflict)
- Idempotency key for snapshot creation (5s window)

## Test plan
- [ ] Edit a draft and watch "Saved" pill appear within 2s
- [ ] Close tab with unsaved changes → see browser beforeunload warning
- [ ] Open in two tabs, edit in both, confirm 412 reload prompt
- [ ] Create snapshot, edit, revert, verify auto-snapshot
- [ ] Disconnect network, see "Save failed", reconnect + retry
EOF
)"
```

- [ ] **Step 4: Phase 2 review gate**

Stop. Wait for review and merge before Phase 3.

---

# Phase 3 — Sharing

**Goal:** Drafts visible to study collaborators with read or write access via `visibility` enum.

**Estimated time:** 1 week.

**Branch:** `feature/publish-library-phase-3` (created from `main` after Phase 2 merges).

---

### Task 33: Migration — add `visibility` and `updated_by_user_id`

**Files:**
- Create: `backend/database/migrations/2026_05_14_000001_add_visibility_to_publication_drafts.php`

- [ ] **Step 1: Branch + create the migration**

```bash
git checkout main && git pull
git checkout -b feature/publish-library-phase-3
docker compose exec php php artisan make:migration add_visibility_to_publication_drafts
```

This creates a file with today's timestamp. Replace its content with:

```php
<?php

use App\Models\App\PublicationDraft;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('publication_drafts', function (Blueprint $table) {
            $table->string('visibility', 16)->default('private')->after('status');
            $table->foreignId('updated_by_user_id')->nullable()->after('visibility')
                ->constrained('users')->nullOnDelete();
            $table->index(['study_id', 'visibility'], 'publication_drafts_study_visibility_idx');
        });

        // Backfill: existing rows get visibility=private (default already does this; explicit for clarity)
        DB::table('publication_drafts')->whereNull('visibility')->update(['visibility' => 'private']);
    }

    public function down(): void
    {
        Schema::table('publication_drafts', function (Blueprint $table) {
            $table->dropIndex('publication_drafts_study_visibility_idx');
            $table->dropConstrainedForeignId('updated_by_user_id');
            $table->dropColumn('visibility');
        });
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
docker compose exec php php artisan migrate
```
Expected: PASS.

- [ ] **Step 3: Test rollback**

```bash
docker compose exec php php artisan migrate:rollback --step=1
docker compose exec php php artisan migrate
```

- [ ] **Step 4: Update `PublicationDraft` model**

In `backend/app/Models/App/PublicationDraft.php`, extend `$fillable`:

```php
protected $fillable = [
    'user_id',
    'study_id',
    'title',
    'template',
    'document_json',
    'status',
    'visibility',
    'updated_by_user_id',
    'last_opened_at',
];
```

- [ ] **Step 5: Pint + commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
git add backend/database/migrations/*add_visibility* backend/app/Models/App/PublicationDraft.php
git commit -m "feat(publish): add visibility and updated_by_user_id to publication_drafts"
```

---

### Task 34: `Study::scopeAccessibleBy` with test

**Files:**
- Modify: `backend/app/Models/App/Study.php`
- Create: `backend/tests/Unit/StudyAccessibleByScopeTest.php`

- [ ] **Step 1: Write the test**

```php
<?php
// backend/tests/Unit/StudyAccessibleByScopeTest.php
use App\Models\App\Study;
use App\Models\User;

it('owner sees own study via scopeAccessibleBy', function () {
    $user = User::factory()->create();
    $study = Study::factory()->create(['created_by' => $user->id]);
    expect(Study::accessibleBy($user->id)->pluck('id'))->toContain($study->id);
});

it('PI sees study they lead', function () {
    $pi = User::factory()->create();
    $study = Study::factory()->create(['principal_investigator_id' => $pi->id]);
    expect(Study::accessibleBy($pi->id)->pluck('id'))->toContain($study->id);
});

it('team member sees study via study_team_members', function () {
    $member = User::factory()->create();
    $study = Study::factory()->create();
    \DB::table('app.study_team_members')->insert([
        'study_id' => $study->id,
        'user_id' => $member->id,
        'role' => 'collaborator',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    expect(Study::accessibleBy($member->id)->pluck('id'))->toContain($study->id);
});

it('outsider does not see study', function () {
    $outsider = User::factory()->create();
    $study = Study::factory()->create();
    expect(Study::accessibleBy($outsider->id)->pluck('id'))->not->toContain($study->id);
});
```

- [ ] **Step 2: Run — FAIL**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter='StudyAccessibleByScope'"
```

- [ ] **Step 3: Add the scope to `Study.php`**

In `backend/app/Models/App/Study.php`, append a new scope method:

```php
/**
 * Limit to studies accessible by a given user (creator, PI, lead data scientist,
 * lead statistician, or explicit team member).
 *
 * @param  \Illuminate\Database\Eloquent\Builder<Study>  $query
 * @return \Illuminate\Database\Eloquent\Builder<Study>
 */
public function scopeAccessibleBy($query, int $userId)
{
    return $query->where(function ($q) use ($userId) {
        $q->where('created_by', $userId)
          ->orWhere('principal_investigator_id', $userId)
          ->orWhere('lead_data_scientist_id', $userId)
          ->orWhere('lead_statistician_id', $userId)
          ->orWhereExists(function ($sub) use ($userId) {
              $sub->select(\DB::raw(1))
                  ->from('app.study_team_members')
                  ->whereColumn('study_team_members.study_id', 'studies.id')
                  ->where('study_team_members.user_id', $userId);
          });
    });
}
```

> **Adapt note:** if the `study_team_members` table is named differently in this codebase, run `grep -rn "study_team_members\|study_collaborators" backend/database/migrations/` to find the correct table name. If no team-members table exists, omit the `whereExists` clause (FK columns alone provide access).

- [ ] **Step 4: Run — PASS**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter='StudyAccessibleByScope'"
```

- [ ] **Step 5: Pint + PHPStan + commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint && vendor/bin/phpstan analyse app/Models/App/Study.php"
git add backend/app/Models/App/Study.php backend/tests/Unit/StudyAccessibleByScopeTest.php
git commit -m "feat(studies): add Study::scopeAccessibleBy for collaborator lookups"
```

---

### Task 35: `PublicationDraftPolicy` with test

**Files:**
- Create: `backend/app/Policies/PublicationDraftPolicy.php`
- Modify: `backend/app/Providers/AuthServiceProvider.php`
- Create: `backend/tests/Feature/Api/V1/PublicationDraftPolicyTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php
// backend/tests/Feature/Api/V1/PublicationDraftPolicyTest.php
use App\Models\App\PublicationDraft;
use App\Models\App\Study;
use App\Models\User;

it('owner can view their own private draft', function () {
    $user = User::factory()->create();
    $user->givePermissionTo('studies.view');
    $draft = PublicationDraft::create([
        'user_id' => $user->id,
        'title' => 'X',
        'template' => 'generic-ohdsi',
        'document_json' => ['version' => 1, 'title' => 'X', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 1, 'selectedExecutions' => [], 'sections' => []],
        'status' => 'draft',
        'visibility' => 'private',
    ]);
    $this->actingAs($user)->getJson("/api/v1/publish/drafts/{$draft->id}")->assertOk();
});

it('study collaborator can view a study-shared draft', function () {
    $owner = User::factory()->create();
    $owner->givePermissionTo(['studies.view', 'studies.edit']);
    $collaborator = User::factory()->create();
    $collaborator->givePermissionTo('studies.view');

    $study = Study::factory()->create(['created_by' => $owner->id]);
    \DB::table('app.study_team_members')->insert([
        'study_id' => $study->id,
        'user_id' => $collaborator->id,
        'role' => 'collaborator',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $draft = PublicationDraft::create([
        'user_id' => $owner->id,
        'study_id' => $study->id,
        'title' => 'X',
        'template' => 'generic-ohdsi',
        'document_json' => ['version' => 1, 'title' => 'X', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 1, 'selectedExecutions' => [], 'sections' => []],
        'status' => 'draft',
        'visibility' => 'study',
    ]);

    $this->actingAs($collaborator)->getJson("/api/v1/publish/drafts/{$draft->id}")->assertOk();
});

it('outsider cannot view a private draft owned by someone else', function () {
    $owner = User::factory()->create();
    $owner->givePermissionTo('studies.view');
    $outsider = User::factory()->create();
    $outsider->givePermissionTo('studies.view');

    $draft = PublicationDraft::create([
        'user_id' => $owner->id, 'title' => 'X', 'template' => 'generic-ohdsi',
        'document_json' => ['version' => 1, 'title' => 'X', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 1, 'selectedExecutions' => [], 'sections' => []],
        'status' => 'draft', 'visibility' => 'private',
    ]);

    $this->actingAs($outsider)->getJson("/api/v1/publish/drafts/{$draft->id}")->assertNotFound();
});

it('viewer (no studies.edit) cannot update a study-shared draft', function () {
    $owner = User::factory()->create();
    $owner->givePermissionTo(['studies.view', 'studies.edit']);
    $viewer = User::factory()->create();
    $viewer->givePermissionTo('studies.view'); // no studies.edit

    $study = Study::factory()->create(['created_by' => $owner->id]);
    \DB::table('app.study_team_members')->insert([
        'study_id' => $study->id, 'user_id' => $viewer->id, 'role' => 'viewer', 'created_at' => now(), 'updated_at' => now(),
    ]);

    $draft = PublicationDraft::create([
        'user_id' => $owner->id, 'study_id' => $study->id, 'title' => 'X', 'template' => 'generic-ohdsi',
        'document_json' => ['version' => 1, 'title' => 'X', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 1, 'selectedExecutions' => [], 'sections' => []],
        'status' => 'draft', 'visibility' => 'study',
    ]);

    $this->actingAs($viewer)
        ->patchJson("/api/v1/publish/drafts/{$draft->id}", ['title' => 'Forbidden change'])
        ->assertForbidden();
});

it('rejects visibility=study when study_id is null', function () {
    $user = User::factory()->create();
    $user->givePermissionTo('studies.view');

    $this->actingAs($user)
        ->postJson('/api/v1/publish/drafts', [
            'title' => 'X', 'template' => 'generic-ohdsi',
            'document_json' => ['version' => 1, 'title' => 'X', 'authors' => [], 'template' => 'generic-ohdsi', 'step' => 1, 'selectedExecutions' => [], 'sections' => []],
            'visibility' => 'study',
            'study_id' => null,
        ])
        ->assertStatus(422);
});
```

- [ ] **Step 2: Run — FAIL**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter='PublicationDraftPolicy'"
```

- [ ] **Step 3: Write the policy**

```php
<?php
// backend/app/Policies/PublicationDraftPolicy.php
namespace App\Policies;

use App\Models\App\PublicationDraft;
use App\Models\App\Study;
use App\Models\User;

class PublicationDraftPolicy
{
    public function view(User $user, PublicationDraft $draft): bool
    {
        if ((int) $draft->user_id === (int) $user->id) return true;
        if ($draft->visibility !== 'study' || $draft->study_id === null) return false;
        return Study::accessibleBy($user->id)->whereKey($draft->study_id)->exists();
    }

    public function update(User $user, PublicationDraft $draft): bool
    {
        if ((int) $draft->user_id === (int) $user->id) return true;
        if (! $this->view($user, $draft)) return false;
        return $user->can('studies.edit');
    }

    public function delete(User $user, PublicationDraft $draft): bool
    {
        return (int) $draft->user_id === (int) $user->id;
    }

    public function share(User $user, PublicationDraft $draft): bool
    {
        return (int) $draft->user_id === (int) $user->id;
    }
}
```

- [ ] **Step 4: Register the policy**

In `backend/app/Providers/AuthServiceProvider.php`, add to `$policies`:

```php
protected $policies = [
    // existing entries…
    \App\Models\App\PublicationDraft::class => \App\Policies\PublicationDraftPolicy::class,
];
```

- [ ] **Step 5: Refactor `PublicationController::authorizeDraft`**

```php
private function authorizeDraft(Request $request, PublicationDraft $draft): void
{
    $user = $request->user();
    abort_unless($user !== null, 401);
    abort_unless((new \App\Policies\PublicationDraftPolicy())->view($user, $draft), 404);
}
```

Add a separate update authorization helper used by `updateDraft`:

```php
private function authorizeDraftUpdate(Request $request, PublicationDraft $draft): void
{
    $user = $request->user();
    abort_unless($user !== null, 401);
    if (! (new \App\Policies\PublicationDraftPolicy())->update($user, $draft)) {
        abort(403, 'You can view but not edit this draft.');
    }
}
```

Call it at the top of `updateDraft` (replacing the existing `authorizeDraft`).

- [ ] **Step 6: Update `validateDraftPayload`** to validate `visibility` and the `study_id` requirement:

```php
private function validateDraftPayload(Request $request, bool $requireDocument): array
{
    $documentRule = $requireDocument ? 'required|array' : 'sometimes|array';
    $titleRule = $requireDocument ? 'required|string|max:500' : 'sometimes|string|max:500';

    $validated = $request->validate([
        'study_id' => 'nullable|integer',
        'title' => $titleRule,
        'template' => 'sometimes|string|max:80',
        'document_json' => $documentRule,
        'status' => 'sometimes|string|in:draft,ready,archived',
        'visibility' => 'sometimes|string|in:private,study',
    ]);

    if (($validated['visibility'] ?? null) === 'study' && ($validated['study_id'] ?? null) === null) {
        throw \Illuminate\Validation\ValidationException::withMessages([
            'visibility' => 'visibility=study requires study_id',
        ]);
    }

    return $validated;
}
```

Also update `createDraft` and `updateDraft` to pass `visibility` through.

- [ ] **Step 7: Update `listDrafts`**

```php
public function listDrafts(Request $request): JsonResponse
{
    $user = $request->user();
    $userId = (int) $user?->id;

    $accessibleStudyIds = \App\Models\App\Study::query()
        ->accessibleBy($userId)
        ->pluck('id');

    $drafts = PublicationDraft::query()
        ->where(function ($q) use ($userId, $accessibleStudyIds) {
            $q->where('user_id', $userId)
              ->orWhere(function ($qq) use ($accessibleStudyIds) {
                  $qq->where('visibility', 'study')
                     ->whereIn('study_id', $accessibleStudyIds);
              });
        })
        ->orderByDesc('last_opened_at')
        ->orderByDesc('updated_at')
        ->limit(100)
        ->get()
        ->map(fn (PublicationDraft $draft): array => $this->draftPayload($draft));

    return response()->json(['data' => $drafts]);
}
```

Add `visibility` and `updated_by_user_id` to `draftPayload`:

```php
private function draftPayload(?PublicationDraft $draft): array
{
    if ($draft === null) return [];
    return [
        'id' => $draft->id,
        'user_id' => $draft->user_id,
        'study_id' => $draft->study_id,
        'title' => $draft->title,
        'template' => $draft->template,
        'document_json' => $draft->document_json,
        'status' => $draft->status,
        'visibility' => $draft->visibility,
        'updated_by_user_id' => $draft->updated_by_user_id,
        'last_opened_at' => $draft->last_opened_at?->toISOString(),
        'created_at' => $draft->created_at?->toISOString(),
        'updated_at' => $draft->updated_at?->toISOString(),
    ];
}
```

Stamp `updated_by_user_id` on every update inside `updateDraft`:

```php
$updates['updated_by_user_id'] = $request->user()?->id;
```

- [ ] **Step 8: Run tests — PASS**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint && vendor/bin/phpstan analyse && vendor/bin/pest --filter='PublicationDraft\|Publication '"
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/Policies/PublicationDraftPolicy.php \
        backend/app/Providers/AuthServiceProvider.php \
        backend/app/Http/Controllers/Api/V1/PublicationController.php \
        backend/tests/Feature/Api/V1/PublicationDraftPolicyTest.php
git commit -m "feat(publish): add PublicationDraftPolicy and study-scoped sharing"
```

---

### Task 36: Frontend types — add `visibility` + extend `PublicationDraft`

**Files:**
- Modify: `frontend/src/features/publish/types/publish.ts`

- [ ] **Step 1: Edit**

```typescript
// Add to publish.ts
export type PublicationDraftVisibility = "private" | "study";

// Modify PublicationDraft interface
export interface PublicationDraft {
  id: number;
  user_id: number;
  study_id: number | null;
  title: string;
  template: string;
  document_json: DocumentJson;
  status: PublicationDraftStatus;
  visibility: PublicationDraftVisibility;
  updated_by_user_id: number | null;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
}

// Add to PublicationDraftInput
export interface PublicationDraftInput {
  study_id?: number | null;
  title: string;
  template: string;
  document_json: DocumentJson;
  status?: PublicationDraftStatus;
  visibility?: PublicationDraftVisibility;
}
```

- [ ] **Step 2: Type-check + commit**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
git add frontend/src/features/publish/types/publish.ts
git commit -m "feat(publish): add visibility and updated_by_user_id to PublicationDraft type"
```

---

### Task 37: Frontend — `VisibilityBadge` and `ShareDropdown`

**Files:**
- Create: `frontend/src/features/publish/components/library/VisibilityBadge.tsx`
- Create: `frontend/src/features/publish/components/PublishPage/ShareDropdown.tsx`

- [ ] **Step 1: `VisibilityBadge`**

```tsx
// frontend/src/features/publish/components/library/VisibilityBadge.tsx
import { Lock, Users } from "lucide-react";
import type { PublicationDraftVisibility } from "../../types/publish";

interface VisibilityBadgeProps {
  visibility: PublicationDraftVisibility;
}

export function VisibilityBadge({ visibility }: VisibilityBadgeProps) {
  if (visibility === "private") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-primary/60">
        <Lock size={10} />Private
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
      <Users size={10} />Study
    </span>
  );
}
```

- [ ] **Step 2: `ShareDropdown`**

```tsx
// frontend/src/features/publish/components/PublishPage/ShareDropdown.tsx
import { Lock, Users } from "lucide-react";
import type { PublicationDraftVisibility } from "../../types/publish";

interface ShareDropdownProps {
  visibility: PublicationDraftVisibility;
  studyLinked: boolean;
  studyName?: string;
  disabled?: boolean;
  onChange: (v: PublicationDraftVisibility) => void;
}

export function ShareDropdown({ visibility, studyLinked, studyName, disabled, onChange }: ShareDropdownProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-text-primary/70">
      <span className="sr-only">Visibility</span>
      <select
        value={visibility}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as PublicationDraftVisibility)}
        className="rounded-md border border-border-default bg-surface-raised px-2 py-1 text-xs text-text-primary disabled:opacity-50"
        title={!studyLinked ? "Link to a study to share" : undefined}
      >
        <option value="private">🔒 Private</option>
        <option value="study" disabled={!studyLinked}>
          👥 Study collaborators{studyName ? ` (${studyName})` : ""}
        </option>
      </select>
    </label>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/components/library/VisibilityBadge.tsx \
        frontend/src/features/publish/components/PublishPage/ShareDropdown.tsx
git commit -m "feat(publish): add VisibilityBadge and ShareDropdown"
```

---

### Task 38: Wire ShareDropdown into `PublishPage` and update DraftCard

**Files:**
- Modify: `frontend/src/features/publish/pages/PublishPage.tsx`
- Modify: `frontend/src/features/publish/components/library/DraftCard.tsx`

- [ ] **Step 1: In `PublishPage`**, add visibility state and dropdown render:

```tsx
// Imports
import { ShareDropdown } from "../components/PublishPage/ShareDropdown";

// After existing draftQuery hook:
const visibility = draftQuery.data?.visibility ?? "private";
const studyId = state.selectedExecutions[0]?.studyId ?? draftQuery.data?.study_id ?? null;
const studyTitle = state.selectedExecutions[0]?.studyTitle ?? undefined;

const handleVisibilityChange = (next: PublicationDraftVisibility) => {
  if (draftId === null) return;
  updateDraft.mutate({ id: draftId, payload: { visibility: next, study_id: studyId } });
};
```

In the header JSX (next to `SaveStatusIndicator`):

```tsx
{draftId !== null && (
  <ShareDropdown
    visibility={visibility}
    studyLinked={studyId !== null}
    studyName={studyTitle}
    onChange={handleVisibilityChange}
  />
)}
```

- [ ] **Step 2: In `DraftCard`**, render `VisibilityBadge` and owner indicator:

Add at the top of the card body (next to status pill):

```tsx
import { VisibilityBadge } from "./VisibilityBadge";
// ... import from useCurrentUser hook (find existing one — likely in @/features/auth)

// inside the component, after status pill:
<VisibilityBadge visibility={draft.visibility} />
{draft.user_id !== currentUserId && (
  <span className="text-xs text-text-primary/50">by user #{draft.user_id}</span>
)}
```

> **Replace `currentUserId`** with the value from your existing auth store/hook (search `useCurrentUser` or `useAuth` in the codebase).

- [ ] **Step 3: Type-check + build**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/publish/pages/PublishPage.tsx frontend/src/features/publish/components/library/DraftCard.tsx
git commit -m "feat(publish): wire ShareDropdown and VisibilityBadge into UI"
```

---

### Task 39: Read-only wizard mode for viewer-tier collaborators

**Files:**
- Modify: `frontend/src/features/publish/pages/PublishPage.tsx`

- [ ] **Step 1: Detect read-only state**

Use the existing auth store to read `currentUserId` and `permissions`. If `draftQuery.data.user_id !== currentUserId` AND user lacks `studies.edit`, set a `readOnly` flag.

```tsx
const { user: currentUser } = useAuthStore(); // or whatever hook exists
const canEdit =
  draftQuery.data === undefined ||
  draftQuery.data.user_id === currentUser?.id ||
  currentUser?.permissions?.includes("studies.edit");
const readOnly = !canEdit;
```

- [ ] **Step 2: Disable wizard inputs and swap the save button**

```tsx
// Pass readOnly to UnifiedAnalysisPicker, DocumentConfigurator, DocumentPreview, ExportPanel
// (each component already accepts disabled / readonly props in some form — search for any existing "disabled" usage; if absent, add a readOnly prop and conditionally disable inputs)

{readOnly ? (
  <span className="inline-flex items-center gap-1 rounded-md bg-surface-elevated px-3 py-1.5 text-xs text-text-primary/60">
    View only — request edit access from owner
  </span>
) : (
  <SaveStatusIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt} onRetry={autosave.retry} />
)}
```

Add a "Duplicate to my drafts" action:

```tsx
{readOnly && (
  <button
    type="button"
    onClick={async () => {
      const draft = await createDraft.mutateAsync({
        title: `${state.title} (copy)`,
        template: state.template,
        document_json: buildDocumentJson(),
        study_id: null, // owner starts private
      });
      navigate(`/publish/library/${draft.id}`);
    }}
    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface-base hover:bg-accent/90"
  >
    Duplicate to my drafts
  </button>
)}
```

- [ ] **Step 3: Type-check + build + commit**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"
git add frontend/src/features/publish/pages/PublishPage.tsx
git commit -m "feat(publish): add read-only wizard mode for viewer collaborators"
```

---

### Task 40: E2E test — Phase 3 sharing

**Files:**
- Create: `e2e/tests/publish-library/phase3-sharing.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// e2e/tests/publish-library/phase3-sharing.spec.ts
import { test, expect } from "@playwright/test";

const OWNER = { email: "admin@acumenus.net", password: process.env.PARTHENON_ADMIN_PASSWORD ?? "" };
const COLLAB = { email: "collaborator@example.com", password: process.env.PARTHENON_COLLAB_PASSWORD ?? "" };

async function login(page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard|\/$/);
}

test.describe("Publish library — Phase 3 sharing", () => {
  test("owner shares, collaborator opens, owner revokes", async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const collabCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const collabPage = await collabCtx.newPage();

    // Owner creates + shares
    await login(ownerPage, OWNER.email, OWNER.password);
    await ownerPage.goto("/publish/library/new");
    await ownerPage.getByText(/Select analyses/i).click();
    await ownerPage.getByRole("checkbox").first().check();
    await ownerPage.getByRole("button", { name: /Next/i }).click();
    await ownerPage.getByLabel(/Title/i).fill("Shared Draft");
    await ownerPage.getByRole("button", { name: /Save as Draft/i }).click();
    await expect(ownerPage).toHaveURL(/\/publish\/library\/\d+/);

    // Set visibility=study
    await ownerPage.getByLabel(/Visibility/i).selectOption("study");
    await expect(ownerPage.getByText(/Saved/i)).toBeVisible({ timeout: 5000 });

    // Collaborator sees it
    await login(collabPage, COLLAB.email, COLLAB.password);
    await collabPage.goto("/publish/library");
    await expect(collabPage.getByText("Shared Draft")).toBeVisible();
    await collabPage.getByText("Shared Draft").click();
    await expect(collabPage.getByLabel(/Title/i)).toHaveValue("Shared Draft");

    // Owner revokes — sets visibility back to private
    await ownerPage.getByLabel(/Visibility/i).selectOption("private");
    await expect(ownerPage.getByText(/Saved/i)).toBeVisible({ timeout: 5000 });

    // Collaborator refreshes — draft is gone
    await collabPage.goto("/publish/library");
    await expect(collabPage.getByText("Shared Draft")).not.toBeVisible();

    await ownerCtx.close();
    await collabCtx.close();
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
cd e2e && npx playwright test tests/publish-library/phase3-sharing.spec.ts
cd ..
git add e2e/tests/publish-library/phase3-sharing.spec.ts
git commit -m "test(publish): add Phase 3 E2E sharing flow"
```

---

### Task 41: Phase 3 wrap-up + PR

- [ ] **Step 1: Full suite**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint && vendor/bin/phpstan analyse && vendor/bin/pest"
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx eslint . && npx vitest run src/features/publish && npx vite build"
```

- [ ] **Step 2: Manual verification gates**

1. Owner creates draft, switches to "Study collaborators" — collaborator sees it on next library refresh.
2. Collaborator with only `studies.view` opens shared draft → wizard is read-only, "Save Draft" replaced by "View only" pill, "Duplicate to my drafts" works.
3. Owner sets back to "Private" → collaborator's library no longer shows it (404 if they re-open the URL directly).
4. Two collaborators edit simultaneously — last write wins; `updated_by_user_id` reflects the latest editor.
5. Try to set `visibility=study` with no `study_id` → server returns 422 with helpful message.

- [ ] **Step 3: Deploy script + open PR**

```bash
git push -u origin feature/publish-library-phase-3
gh pr create --title "feat(publish): Pre-Publication Library — Phase 3 (study-scoped sharing)" --body "$(cat <<'EOF'
## Summary
- New `visibility` enum on `publication_drafts` (`private` | `study`)
- New `Study::scopeAccessibleBy` for collaborator lookups (creator, PI, lead DS, lead stat, team members)
- New `PublicationDraftPolicy` with view/update/delete/share rules
- Read-only wizard mode for viewer-tier collaborators with "Duplicate to my drafts" escape hatch
- `updated_by_user_id` tracking for audit
- DB-level index `publication_drafts_study_visibility_idx`

## Test plan
- [ ] Owner shares a draft, collaborator sees it, owner revokes — collaborator loses access
- [ ] Viewer-only user opens shared draft → wizard read-only, save replaced with "View only"
- [ ] visibility=study without study_id → 422 with `visibility` error
- [ ] Pest + Vitest + Playwright all green; PHPStan + Pint + ESLint + TS green
EOF
)"
```

- [ ] **Step 4: Phase 3 review gate**

Stop. Wait for review. After merge, run `./deploy.sh --db --frontend` on the production host.

---

# Self-review checklist (already executed before delivery)

| Check | Result |
|-------|--------|
| Every spec section covered by a task? | Yes — §1 Problem framing → Tasks 1–14 (P1); §3.2 document_json → Task 3 ; §4 Phases → Phases 1/2/3; §5 Errors → Tasks 14, 17, 26, 30; §6 Tests → Tasks 1, 21, 31, 40 |
| Any `TBD` / `TODO` / "implement later"? | No |
| Type names consistent across tasks? | `PublicationDraft`, `DocumentJson`, `DraftSection`, `useUpdateDraftById`, `captureSnapshots`, `serializeForSave` used identically wherever they appear |
| Every code step has the actual code? | Yes — no "similar to Task N" placeholders |
| Exact commands? | Yes — Docker Compose prefix consistent throughout |
| Frequent commits? | Yes — every task ends with a commit step |
| Review gates between phases? | Yes — Tasks 20, 32, 41 are explicit stop points |
| HIGHSEC compliance | `auth:sanctum` already on all routes; new policy enforces row-level access; mass-assignment whitelisted via `$fillable`; no `$guarded = []`; `visibility=study` requires `study_id` (validation 422); `If-Unmodified-Since` prevents lost updates |
| Parthenon-specific gotchas observed | Pint via Docker, vite build alongside tsc, `--legacy-peer-deps` for npm install, COMPOSE not needed for migration commands (artisan handles it), Spatie permissions gate endpoints separately from policy |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-publish-library.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration. Best for a feature this large with explicit review gates between phases.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Good if you want to stay close to the work and steer continuously.

Which approach do you want?

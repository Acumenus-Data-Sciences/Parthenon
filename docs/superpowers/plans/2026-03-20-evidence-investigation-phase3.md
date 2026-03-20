# Evidence Investigation Phase 3 — Genomic Evidence Domain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Genomic Evidence domain panel with Open Targets GraphQL integration, GWAS Catalog REST integration, GWAS summary stats file upload with Manhattan/QQ plot visualizations, cross-domain linking engine, and evidence pinning — completing the third of four Evidence Board quadrants.

**Architecture:** Backend: new `GenomicProxyService` handles server-side proxying to Open Targets (`api.platform.opentargets.org/api/v4/graphql`) and GWAS Catalog (`www.ebi.ac.uk/gwas/rest/api`) with Redis caching (24h TTL) and rate limiting (10 req/min). GWAS file upload stores files locally and processes column mapping synchronously (file parsing is fast; visualization is client-side). Frontend: new `GenomicPanel` component with sub-tabs for each evidence source, D3 Manhattan/QQ plots, and cross-domain linking badges on pins.

**Scope change:** Risteys (FinnGen public data) has **no usable data API** — only a list of endpoint names. Replaced with enhanced Open Targets integration which already includes FinnGen GWAS data in its disease-gene associations. The endpoint list is used for validation only.

**Tech Stack:** Laravel 11 (server-side proxy + Redis caching), React 19, TypeScript, D3 v7 (Manhattan plot, QQ plot), TanStack Query, Open Targets GraphQL, GWAS Catalog REST/HAL

**Spec:** `docs/superpowers/specs/2026-03-20-finngen-evidence-investigation-design.md` (Phase 3 + Cross-Domain Linking sections)

**Depends on:** Phase 1 complete + Phase 1 cleanup (evidence_pins array columns exist)

---

## External API Summary

| API | URL | Auth | Method | Rate Limit | Cache TTL |
|-----|-----|------|--------|------------|-----------|
| Open Targets | `https://api.platform.opentargets.org/api/v4/graphql` | None | POST (GraphQL) | Undocumented (soft) | 24h |
| GWAS Catalog | `https://www.ebi.ac.uk/gwas/rest/api` | None | GET (REST/HAL) | Undocumented (soft) | 24h |
| Risteys | `https://risteys.finngen.fi/api/endpoints/` | None | GET | N/A | 7d (list only) |

---

## File Structure

### Backend — New Files

| File | Responsibility |
|------|---------------|
| `backend/app/Services/Investigation/GenomicProxyService.php` | Server-side proxy to Open Targets + GWAS Catalog with Redis caching |
| `backend/app/Http/Controllers/Api/V1/GenomicEvidenceController.php` | Genomic proxy + upload + cross-links endpoints |
| `backend/app/Http/Requests/Investigation/QueryOpenTargetsRequest.php` | Validation for OT queries |
| `backend/app/Http/Requests/Investigation/QueryGwasCatalogRequest.php` | Validation for GWAS Catalog queries |
| `backend/app/Http/Requests/Investigation/UploadGwasRequest.php` | Validation for GWAS file upload |
| `backend/tests/Feature/Api/V1/GenomicEvidenceTest.php` | Tests for proxy + upload + cross-links |

### Backend — Modified Files

| File | Changes |
|------|---------|
| `backend/routes/api.php` | Add genomic evidence routes under investigations prefix |
| `backend/config/services.php` | Add open_targets + gwas_catalog config entries |

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/investigation/components/genomic/GenomicPanel.tsx` | Genomic domain focus panel with sub-tabs |
| `frontend/src/features/investigation/components/genomic/OpenTargetsSearch.tsx` | Gene/disease search + results display |
| `frontend/src/features/investigation/components/genomic/OpenTargetsResults.tsx` | Disease associations, drug targets, tractability cards |
| `frontend/src/features/investigation/components/genomic/GwasCatalogSearch.tsx` | Trait/gene search + loci display |
| `frontend/src/features/investigation/components/genomic/GwasCatalogResults.tsx` | Studies, associations, SNP details |
| `frontend/src/features/investigation/components/genomic/GwasUploader.tsx` | File upload + column mapping UI |
| `frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx` | D3 canvas-based Manhattan plot |
| `frontend/src/features/investigation/components/genomic/QQPlot.tsx` | D3 QQ plot with lambda GC |
| `frontend/src/features/investigation/components/genomic/TopLociTable.tsx` | Sortable table of significant loci |
| `frontend/src/features/investigation/components/genomic/CrossLinkBadge.tsx` | Badge showing cross-domain links on findings |
| `frontend/src/features/investigation/hooks/useGenomicEvidence.ts` | TanStack Query hooks for genomic queries |

### Frontend — Modified Files

| File | Changes |
|------|---------|
| `frontend/src/features/investigation/components/EvidenceBoard.tsx` | Replace DomainPlaceholder with GenomicPanel |
| `frontend/src/features/investigation/components/ContextBar.tsx` | Add live Genomic domain summary |
| `frontend/src/features/investigation/types.ts` | Add OpenTargets/GwasCatalog response types |
| `frontend/src/features/investigation/api.ts` | Add genomic query + upload + cross-links functions |

---

## Task Breakdown

### Task 1: Backend — GenomicProxyService + config

**Files:**
- Create: `backend/app/Services/Investigation/GenomicProxyService.php`
- Modify: `backend/config/services.php`

- [ ] **Step 1: Add external API config**

In `backend/config/services.php`, add:

```php
'open_targets' => [
    'url' => env('OPEN_TARGETS_URL', 'https://api.platform.opentargets.org/api/v4/graphql'),
    'timeout' => env('OPEN_TARGETS_TIMEOUT', 10),
    'cache_ttl' => env('OPEN_TARGETS_CACHE_TTL', 86400), // 24h
],

'gwas_catalog' => [
    'url' => env('GWAS_CATALOG_URL', 'https://www.ebi.ac.uk/gwas/rest/api'),
    'timeout' => env('GWAS_CATALOG_TIMEOUT', 10),
    'cache_ttl' => env('GWAS_CATALOG_CACHE_TTL', 86400), // 24h
],
```

- [ ] **Step 2: Create GenomicProxyService**

Create `backend/app/Services/Investigation/GenomicProxyService.php`:

```php
<?php

namespace App\Services\Investigation;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GenomicProxyService
{
    /** Query Open Targets GraphQL API with Redis caching */
    public function queryOpenTargets(string $graphqlQuery, array $variables = []): array
    {
        $cacheKey = 'ot:' . md5($graphqlQuery . json_encode($variables));
        $ttl = (int) config('services.open_targets.cache_ttl', 86400);

        return Cache::remember($cacheKey, $ttl, function () use ($graphqlQuery, $variables) {
            $url = config('services.open_targets.url');
            $timeout = (int) config('services.open_targets.timeout', 10);

            $response = Http::timeout($timeout)
                ->post($url, [
                    'query' => $graphqlQuery,
                    'variables' => $variables,
                ]);

            if ($response->failed()) {
                Log::warning('Open Targets query failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return ['data' => null, 'errors' => [['message' => 'Open Targets API unavailable']]];
            }

            return $response->json();
        });
    }

    /** Query GWAS Catalog REST API with Redis caching */
    public function queryGwasCatalog(string $endpoint, array $params = []): array
    {
        $cacheKey = 'gwas:' . md5($endpoint . json_encode($params));
        $ttl = (int) config('services.gwas_catalog.cache_ttl', 86400);

        return Cache::remember($cacheKey, $ttl, function () use ($endpoint, $params) {
            $baseUrl = config('services.gwas_catalog.url');
            $timeout = (int) config('services.gwas_catalog.timeout', 10);

            $response = Http::timeout($timeout)
                ->get("{$baseUrl}{$endpoint}", $params);

            if ($response->failed()) {
                Log::warning('GWAS Catalog query failed', [
                    'status' => $response->status(),
                    'endpoint' => $endpoint,
                ]);
                return ['error' => 'GWAS Catalog API unavailable'];
            }

            return $response->json();
        });
    }

    /** Resolve cross-domain links for an investigation's evidence pins */
    public function resolveCrossLinks(int $investigationId): array
    {
        $pins = \App\Models\App\EvidencePin::where('investigation_id', $investigationId)
            ->whereNotNull('concept_ids')
            ->orWhere(function ($q) use ($investigationId) {
                $q->where('investigation_id', $investigationId)
                  ->whereNotNull('gene_symbols');
            })
            ->get();

        $conceptIndex = [];
        $geneIndex = [];

        foreach ($pins as $pin) {
            $conceptIds = $pin->concept_ids ?? [];
            $geneSymbols = $pin->gene_symbols ?? [];

            foreach ($conceptIds as $cid) {
                $conceptIndex[$cid][] = [
                    'pin_id' => $pin->id,
                    'domain' => $pin->domain,
                    'finding_type' => $pin->finding_type,
                ];
            }
            foreach ($geneSymbols as $gene) {
                $geneIndex[$gene][] = [
                    'pin_id' => $pin->id,
                    'domain' => $pin->domain,
                    'finding_type' => $pin->finding_type,
                ];
            }
        }

        $links = [];
        foreach ($pins as $pin) {
            $pinLinks = [];
            foreach ($pin->concept_ids ?? [] as $cid) {
                foreach ($conceptIndex[$cid] ?? [] as $ref) {
                    if ($ref['pin_id'] !== $pin->id) {
                        $pinLinks[] = array_merge($ref, ['link_type' => 'concept', 'link_value' => $cid]);
                    }
                }
            }
            foreach ($pin->gene_symbols ?? [] as $gene) {
                foreach ($geneIndex[$gene] ?? [] as $ref) {
                    if ($ref['pin_id'] !== $pin->id) {
                        $pinLinks[] = array_merge($ref, ['link_type' => 'gene', 'link_value' => $gene]);
                    }
                }
            }
            if (count($pinLinks) > 0) {
                $links[$pin->id] = $pinLinks;
            }
        }

        return $links;
    }
}
```

- [ ] **Step 3: Verify PHPStan**

Run: `cd backend && vendor/bin/phpstan analyse app/Services/Investigation/GenomicProxyService.php`

- [ ] **Step 4: Commit**

```bash
git add backend/app/Services/Investigation/GenomicProxyService.php backend/config/services.php
git commit -m "feat(investigation): add GenomicProxyService with Open Targets + GWAS Catalog caching"
```

---

### Task 2: Backend — Controller, routes, form requests, tests

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/GenomicEvidenceController.php`
- Create: `backend/app/Http/Requests/Investigation/QueryOpenTargetsRequest.php`
- Create: `backend/app/Http/Requests/Investigation/QueryGwasCatalogRequest.php`
- Create: `backend/app/Http/Requests/Investigation/UploadGwasRequest.php`
- Create: `backend/tests/Feature/Api/V1/GenomicEvidenceTest.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create form requests**

```bash
mkdir -p backend/app/Http/Requests/Investigation
```

`QueryOpenTargetsRequest.php`:
```php
<?php
namespace App\Http\Requests\Investigation;
use Illuminate\Foundation\Http\FormRequest;

class QueryOpenTargetsRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'query_type' => ['required', 'in:gene,disease'],
            'term' => ['required', 'string', 'min:2', 'max:200'],
        ];
    }
}
```

`QueryGwasCatalogRequest.php`:
```php
<?php
namespace App\Http\Requests\Investigation;
use Illuminate\Foundation\Http\FormRequest;

class QueryGwasCatalogRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'query_type' => ['required', 'in:trait,gene'],
            'term' => ['required', 'string', 'min:2', 'max:200'],
            'size' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
```

`UploadGwasRequest.php`:
```php
<?php
namespace App\Http\Requests\Investigation;
use Illuminate\Foundation\Http\FormRequest;

class UploadGwasRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:512000', 'mimes:csv,tsv,txt,gz'],
            'column_mapping' => ['sometimes', 'array'],
            'column_mapping.chr' => ['sometimes', 'string'],
            'column_mapping.pos' => ['sometimes', 'string'],
            'column_mapping.ref' => ['sometimes', 'string'],
            'column_mapping.alt' => ['sometimes', 'string'],
            'column_mapping.beta' => ['sometimes', 'string'],
            'column_mapping.se' => ['sometimes', 'string'],
            'column_mapping.p' => ['sometimes', 'string'],
        ];
    }
}
```

- [ ] **Step 2: Create GenomicEvidenceController**

Create `backend/app/Http/Controllers/Api/V1/GenomicEvidenceController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Investigation\QueryGwasCatalogRequest;
use App\Http\Requests\Investigation\QueryOpenTargetsRequest;
use App\Http\Requests\Investigation\UploadGwasRequest;
use App\Models\App\Investigation;
use App\Services\Investigation\GenomicProxyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GenomicEvidenceController extends Controller
{
    public function __construct(
        private readonly GenomicProxyService $service,
    ) {}

    public function queryOpenTargets(QueryOpenTargetsRequest $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validated = $request->validated();
        $queryType = $validated['query_type'];
        $term = $validated['term'];

        // Build GraphQL query based on type
        if ($queryType === 'gene') {
            $graphql = 'query($q: String!) { search(queryString: $q, entityNames: ["target"], page: { index: 0, size: 10 }) { hits { id name score object { ... on Target { id approvedSymbol biotype tractability { modality label value } } } } } }';
            $variables = ['q' => $term];
        } else {
            $graphql = 'query($q: String!) { search(queryString: $q, entityNames: ["disease"], page: { index: 0, size: 10 }) { hits { id name score object { ... on Disease { id name description therapeuticAreas { id name } } } } } }';
            $variables = ['q' => $term];
        }

        $result = $this->service->queryOpenTargets($graphql, $variables);

        return response()->json(['data' => $result]);
    }

    public function queryGwasCatalog(QueryGwasCatalogRequest $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validated = $request->validated();
        $queryType = $validated['query_type'];
        $term = $validated['term'];
        $size = $validated['size'] ?? 20;

        if ($queryType === 'trait') {
            $endpoint = '/efoTraits/search/findByEfoTrait';
            $params = ['trait' => $term, 'size' => $size];
        } else {
            $endpoint = '/singleNucleotidePolymorphisms/search/findByGene';
            $params = ['geneName' => $term, 'size' => $size];
        }

        $result = $this->service->queryGwasCatalog($endpoint, $params);

        return response()->json(['data' => $result]);
    }

    public function uploadGwas(UploadGwasRequest $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $file = $request->file('file');
        $uploadId = (string) \Illuminate\Support\Str::uuid();
        $storagePath = "investigations/{$investigation->id}/uploads";

        $file->storeAs($storagePath, "{$uploadId}_{$file->getClientOriginalName()}");

        // Parse first 5 rows for column preview
        $content = $file->get();
        $lines = array_slice(explode("\n", $content), 0, 6);
        $header = str_getcsv($lines[0] ?? '', "\t");
        $sampleRows = array_map(fn ($line) => str_getcsv($line, "\t"), array_slice($lines, 1));

        $totalLines = substr_count($content, "\n");

        return response()->json([
            'data' => [
                'upload_id' => $uploadId,
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
                'total_rows' => $totalLines,
                'columns' => $header,
                'sample_rows' => $sampleRows,
                'column_mapping' => $request->input('column_mapping', []),
            ],
        ]);
    }

    public function crossLinks(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $links = $this->service->resolveCrossLinks($investigation->id);

        return response()->json(['data' => $links]);
    }
}
```

- [ ] **Step 3: Register routes**

In `backend/routes/api.php`, add imports:
```php
use App\Http\Controllers\Api\V1\GenomicEvidenceController;
```

Inside the existing `investigations` route group, add:
```php
// Genomic Evidence
Route::post('/{investigation}/genomic/query-opentargets', [GenomicEvidenceController::class, 'queryOpenTargets']);
Route::post('/{investigation}/genomic/query-gwas-catalog', [GenomicEvidenceController::class, 'queryGwasCatalog']);
Route::post('/{investigation}/genomic/upload-gwas', [GenomicEvidenceController::class, 'uploadGwas']);
Route::get('/{investigation}/cross-links', [GenomicEvidenceController::class, 'crossLinks']);
```

- [ ] **Step 4: Create tests**

Create `backend/tests/Feature/Api/V1/GenomicEvidenceTest.php`:

Tests:
- Open Targets query (mock Http, verify caching)
- GWAS Catalog query (mock Http, verify caching)
- GWAS file upload (use fake file, verify storage + response shape)
- Cross-links resolution (create pins with overlapping concept_ids, verify links returned)
- Authorization (other user's investigation blocked)

Use `Http::fake()` for external API mocking. Use `Storage::fake('local')` for file uploads.

- [ ] **Step 5: Run tests**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/V1/GenomicEvidenceTest.php`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/GenomicEvidenceController.php backend/app/Http/Requests/Investigation/ backend/routes/api.php backend/tests/Feature/Api/V1/GenomicEvidenceTest.php
git commit -m "feat(investigation): add GenomicEvidenceController with proxy, upload, and cross-links endpoints"
```

---

### Task 3: Frontend — Genomic types + API + hooks

**Files:**
- Modify: `frontend/src/features/investigation/types.ts`
- Modify: `frontend/src/features/investigation/api.ts`
- Create: `frontend/src/features/investigation/hooks/useGenomicEvidence.ts`

- [ ] **Step 1: Add genomic response types**

In `types.ts`, add:

```typescript
// ── Open Targets types ────────────────────────────────────────────────

export interface OpenTargetsSearchHit {
  id: string;
  name: string;
  score: number;
  object: Record<string, unknown>;
}

export interface OpenTargetsResult {
  data: {
    search?: {
      hits: OpenTargetsSearchHit[];
    };
    target?: Record<string, unknown>;
    disease?: Record<string, unknown>;
  } | null;
  errors?: Array<{ message: string }>;
}

// ── GWAS Catalog types ────────────────────────────────────────────────

export interface GwasCatalogStudy {
  accessionId: string;
  diseaseTrait?: { trait: string };
  publicationInfo?: {
    pubmedId: string;
    publication: string;
    title: string;
    author: { fullname: string };
    publicationDate: string;
  };
  initialSampleSize: string;
  snpCount: number;
}

export interface GwasCatalogAssociation {
  pvalue: number;
  pvalueMantissa: number;
  pvalueExponent: number;
  orPerCopyNum: number | null;
  betaNum: number | null;
  betaDirection: string | null;
  range: string | null;
  riskFrequency: string | null;
  loci: Array<{
    strongestRiskAlleles: Array<{ riskAlleleName: string; riskFrequency: string }>;
    authorReportedGenes: Array<{ geneName: string; ensemblGeneIds: string[] }>;
  }>;
}

export interface GwasCatalogResult {
  _embedded?: Record<string, unknown[]>;
  page?: { totalElements: number; totalPages: number; number: number; size: number };
}

// ── GWAS Upload types ─────────────────────────────────────────────────

export interface GwasUploadResult {
  upload_id: string;
  file_name: string;
  file_size: number;
  total_rows: number;
  columns: string[];
  sample_rows: string[][];
  column_mapping: Record<string, string>;
}

export interface GwasSummaryRow {
  chr: string;
  pos: number;
  ref: string;
  alt: string;
  beta: number;
  se: number;
  p: number;
}

// ── Cross-Domain Links ────────────────────────────────────────────────

export interface CrossLink {
  pin_id: number;
  domain: string;
  finding_type: string;
  link_type: "concept" | "gene";
  link_value: number | string;
}

export type CrossLinksMap = Record<number, CrossLink[]>;
```

- [ ] **Step 2: Add genomic API functions**

In `api.ts`, add:

```typescript
// ── Genomic Evidence ──────────────────────────────────────────────────

export async function queryOpenTargets(
  investigationId: number,
  queryType: "gene" | "disease",
  term: string,
): Promise<OpenTargetsResult> {
  const { data } = await apiClient.post(
    `/investigations/${investigationId}/genomic/query-opentargets`,
    { query_type: queryType, term },
  );
  return data.data;
}

export async function queryGwasCatalog(
  investigationId: number,
  queryType: "trait" | "gene",
  term: string,
  size = 20,
): Promise<GwasCatalogResult> {
  const { data } = await apiClient.post(
    `/investigations/${investigationId}/genomic/query-gwas-catalog`,
    { query_type: queryType, term, size },
  );
  return data.data;
}

export async function uploadGwas(
  investigationId: number,
  file: File,
  columnMapping?: Record<string, string>,
): Promise<GwasUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (columnMapping) {
    Object.entries(columnMapping).forEach(([key, value]) => {
      formData.append(`column_mapping[${key}]`, value);
    });
  }
  const { data } = await apiClient.post(
    `/investigations/${investigationId}/genomic/upload-gwas`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.data;
}

export async function fetchCrossLinks(
  investigationId: number,
): Promise<CrossLinksMap> {
  const { data } = await apiClient.get(
    `/investigations/${investigationId}/cross-links`,
  );
  return data.data;
}
```

Import all new types from `./types`.

- [ ] **Step 3: Create useGenomicEvidence hooks**

Create `frontend/src/features/investigation/hooks/useGenomicEvidence.ts`:

```typescript
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryOpenTargets, queryGwasCatalog, uploadGwas, fetchCrossLinks } from "../api";

export function useOpenTargetsSearch(investigationId: number, queryType: "gene" | "disease", term: string) {
  return useQuery({
    queryKey: ["opentargets", investigationId, queryType, term],
    queryFn: () => queryOpenTargets(investigationId, queryType, term),
    enabled: !!investigationId && term.length >= 2,
    staleTime: 86_400_000, // 24h — matches backend cache
  });
}

export function useGwasCatalogSearch(investigationId: number, queryType: "trait" | "gene", term: string) {
  return useQuery({
    queryKey: ["gwas-catalog", investigationId, queryType, term],
    queryFn: () => queryGwasCatalog(investigationId, queryType, term),
    enabled: !!investigationId && term.length >= 2,
    staleTime: 86_400_000,
  });
}

export function useUploadGwas() {
  return useMutation({
    mutationFn: ({ investigationId, file, columnMapping }: {
      investigationId: number; file: File; columnMapping?: Record<string, string>;
    }) => uploadGwas(investigationId, file, columnMapping),
  });
}

export function useCrossLinks(investigationId: number) {
  return useQuery({
    queryKey: ["cross-links", investigationId],
    queryFn: () => fetchCrossLinks(investigationId),
    enabled: !!investigationId,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 4: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/types.ts frontend/src/features/investigation/api.ts frontend/src/features/investigation/hooks/useGenomicEvidence.ts
git commit -m "feat(investigation): add genomic evidence types, API functions, and query hooks"
```

---

### Task 4: Open Targets search + results components

**Files:**
- Create: `frontend/src/features/investigation/components/genomic/OpenTargetsSearch.tsx`
- Create: `frontend/src/features/investigation/components/genomic/OpenTargetsResults.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p frontend/src/features/investigation/components/genomic
```

- [ ] **Step 2: Create OpenTargetsSearch**

Search input with gene/disease toggle. Uses `useOpenTargetsSearch`. Debounced 500ms input. Renders `OpenTargetsResults` when data arrives. Pin-to-dossier on findings.

Props: `investigationId: number`, `onPinFinding: (finding) => void`

- Gene mode: search by gene symbol → show associated diseases, drug targets, tractability
- Disease mode: search by disease name → show associated genes, known drugs

- [ ] **Step 3: Create OpenTargetsResults**

Renders Open Targets search results as cards:
- **Gene results**: gene symbol, biotype, tractability badges (SmallMolecule/Antibody), "View associations" expand
- **Disease results**: disease name, therapeutic areas, association count
- Each result has a "Pin" button → `finding_type: "open_targets_association"`, `gene_symbols: [symbol]`
- Color scheme: gold accent for Open Targets brand

- [ ] **Step 4: Verify TypeScript + Commit**

```bash
git commit -m "feat(investigation): add Open Targets gene/disease search with results display"
```

---

### Task 5: GWAS Catalog search + results components

**Files:**
- Create: `frontend/src/features/investigation/components/genomic/GwasCatalogSearch.tsx`
- Create: `frontend/src/features/investigation/components/genomic/GwasCatalogResults.tsx`

- [ ] **Step 1: Create GwasCatalogSearch**

Search input with trait/gene toggle. Uses `useGwasCatalogSearch`. Debounced 500ms.

Props: `investigationId: number`, `onPinFinding: (finding) => void`

- Trait mode: search EFO traits → show associated studies
- Gene mode: search by gene symbol → show associated SNPs/studies

- [ ] **Step 2: Create GwasCatalogResults**

Renders HAL results:
- **Studies**: accession ID, trait, publication info, sample size, SNP count
- **Associations**: rs-ID, p-value, OR/beta, risk allele, gene name
- Each result has "Pin" button → `finding_type: "gwas_locus"`, `gene_symbols: [geneName]`
- Parses HAL `_embedded` and `page` envelope

- [ ] **Step 3: Verify TypeScript + Commit**

```bash
git commit -m "feat(investigation): add GWAS Catalog trait/gene search with HAL results display"
```

---

### Task 6: GWAS file upload + column mapping

**Files:**
- Create: `frontend/src/features/investigation/components/genomic/GwasUploader.tsx`

- [ ] **Step 1: Create GwasUploader**

File upload component for GWAS summary statistics.

Props: `investigationId: number`, `onUploadComplete: (result: GwasUploadResult) => void`

Implementation:
- Drag-and-drop zone + file input (accept `.tsv,.csv,.gz`)
- On file select: call `useUploadGwas` mutation
- Response shows: file name, size, row count, detected columns
- Column mapping UI: for each required column (chr, pos, ref, alt, beta/or, se, p), show a dropdown of detected columns with auto-detection (match by name similarity)
- "Confirm Mapping" button saves mapping and triggers visualization parsing
- After mapping confirmed, render ManhattanPlot + QQPlot + TopLociTable (Tasks 7-8)

- [ ] **Step 2: Verify TypeScript + Commit**

```bash
git commit -m "feat(investigation): add GWAS summary stats upload with column mapping"
```

---

### Task 7: D3 Manhattan Plot + QQ Plot

**Files:**
- Create: `frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx`
- Create: `frontend/src/features/investigation/components/genomic/QQPlot.tsx`

- [ ] **Step 1: Create ManhattanPlot**

D3 **canvas**-based Manhattan plot (not SVG — per spec NFRs, datasets >1M variants use canvas).

Props:
```typescript
interface ManhattanPlotProps {
  data: Array<{ chr: string; pos: number; p: number }>;
  significanceThreshold?: number;  // default 5e-8
  suggestiveThreshold?: number;    // default 1e-5
  width?: number;
  height?: number;
  onLocusClick?: (chr: string, pos: number) => void;
}
```

Implementation:
- X axis: genomic position (chromosomes laid end-to-end, alternating colors)
- Y axis: -log10(p-value)
- Points colored by chromosome (alternating teal/zinc-500 for odd/even)
- Significance line: crimson dashed at -log10(5e-8) = 7.3
- Suggestive line: gold dashed at -log10(1e-5) = 5
- Click a peak to trigger `onLocusClick`
- Canvas rendering for performance with >1M points
- Use `useRef<HTMLCanvasElement>` + `useEffect` for D3 imperative drawing
- Dark theme: #0E0E11 canvas bg, zinc-300 axes, zinc-600 grid

- [ ] **Step 2: Create QQPlot**

D3 SVG QQ plot (typically <10K points after thinning).

Props:
```typescript
interface QQPlotProps {
  observedP: number[];         // raw p-values
  lambdaGC?: number;           // genomic inflation factor
  width?: number;
  height?: number;
}
```

Implementation:
- X axis: expected -log10(p) (uniform distribution)
- Y axis: observed -log10(p)
- Diagonal line (y=x) in gold dashed
- Points: teal circles
- Lambda GC value displayed in corner badge
- 95% CI band in zinc-700 around diagonal
- Thin to max 5000 points for SVG performance (keep extreme tails)
- Dark theme

- [ ] **Step 3: Verify TypeScript + Commit**

```bash
git commit -m "feat(investigation): add D3 Manhattan plot (canvas) and QQ plot for GWAS visualization"
```

---

### Task 8: Top Loci Table + GenomicPanel + EvidenceBoard integration

**Files:**
- Create: `frontend/src/features/investigation/components/genomic/TopLociTable.tsx`
- Create: `frontend/src/features/investigation/components/genomic/CrossLinkBadge.tsx`
- Create: `frontend/src/features/investigation/components/genomic/GenomicPanel.tsx`
- Modify: `frontend/src/features/investigation/components/EvidenceBoard.tsx`
- Modify: `frontend/src/features/investigation/components/ContextBar.tsx`

- [ ] **Step 1: Create TopLociTable**

Sortable table of significant GWAS loci.

Props: `data: Array<{ chr, pos, ref?, alt?, p, beta?, or? }>`, `onPinLocus: (locus) => void`

Columns: Chr, Position, -log10(p), Beta/OR, Pin button. Sorted by p-value ascending. Only shows loci below significance threshold.

- [ ] **Step 2: Create CrossLinkBadge**

Small badge showing cross-domain links on a pin.

Props: `pinId: number`, `crossLinks: CrossLinksMap`

If `crossLinks[pinId]` has entries, show a teal badge: "🔗 N links" with tooltip listing linked pins by domain.

- [ ] **Step 3: Create GenomicPanel**

The genomic domain focus panel. Sub-tabs: "Open Targets", "GWAS Catalog", "Upload GWAS".

Props: `investigation: Investigation`

Each sub-tab renders the corresponding search/upload component. Wire `onPinFinding` through `useCreatePin` with `domain: "genomic"`, `section: "genomic_evidence"`. Auto-save genomic state with `useAutoSave`.

When a GWAS file is uploaded and mapped, show ManhattanPlot + QQPlot + TopLociTable below the uploader.

- [ ] **Step 4: Replace DomainPlaceholder in EvidenceBoard**

```typescript
case "genomic":
  return <GenomicPanel investigation={investigation} />;
```

- [ ] **Step 5: Update Genomic context card summary in ContextBar**

Derive summary from `investigation.genomic_state`:
- Open Targets queries count
- GWAS uploads count
- "N queries · N uploads" or "No genomic evidence"

- [ ] **Step 6: Verify TypeScript + Commit**

```bash
git commit -m "feat(investigation): add GenomicPanel with Open Targets, GWAS Catalog, upload, and cross-links"
```

---

### Task 9: Full verification

- [ ] **Step 1: Frontend TypeScript**
Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 2: Frontend ESLint**
Run: `cd frontend && npx eslint src/features/investigation/`

- [ ] **Step 3: Backend PHPStan**
Run: `cd backend && vendor/bin/phpstan analyse app/Services/Investigation/GenomicProxyService.php app/Http/Controllers/Api/V1/GenomicEvidenceController.php`

- [ ] **Step 4: Backend tests**
Run: `cd backend && vendor/bin/pest tests/Feature/Api/V1/GenomicEvidenceTest.php tests/Feature/Api/V1/InvestigationCrudTest.php tests/Feature/Api/V1/EvidencePinTest.php`

- [ ] **Step 5: Final commit if lint fixes needed**

```bash
git commit -m "chore: lint fixes after Phase 3 Genomic Evidence domain"
```

---

## Deferred to Phase 4

| Item | Reason |
|------|--------|
| Risteys deep integration | No public data API — only endpoint name list available |
| Colocalization result import | Phase 4 per spec |
| Fine-mapping result import | Phase 4 per spec |
| Locus zoom (regional association plot) | Requires LD reference panel — complex backend dependency |
| Cross-link badge on all existing pins | Phase 4 polish — badge component built here but integration into EvidenceSidebar deferred |

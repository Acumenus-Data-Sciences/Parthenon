# PACS Connector Admin Panel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a multi-PACS connection management page to the Admin Panel that lets super-admins configure, monitor, and browse studies on Orthanc and external DICOMweb PACS servers.

**Architecture:** Standalone `pacs_connections` table with optional FK to `sources`. Backend service wraps DICOMweb QIDO-RS for health checks, stats, and study browsing. Frontend admin page follows existing card-grid pattern (like AI Providers, FHIR Connections).

**Tech Stack:** Laravel 11 (migration, model, controller, form request, seeder), React 19 + TypeScript (TanStack Query, Zustand-free, Tailwind 4 dark theme), Guzzle HTTP for DICOMweb calls.

**Design doc:** `docs/plans/2026-03-09-pacs-connector-admin-design.md`

---

## Task 1: Migration — `pacs_connections` table

**Files:**
- Create: `backend/database/migrations/2026_03_09_200000_create_pacs_connections_table.php`

**Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pacs_connections', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->string('type', 50); // orthanc, dicomweb, google_healthcare, cloud_other
            $table->text('base_url');
            $table->string('auth_type', 50)->default('none'); // none, basic, bearer
            $table->text('credentials')->nullable(); // encrypted:array
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->timestamp('last_health_check_at')->nullable();
            $table->string('last_health_status', 20)->nullable(); // healthy, degraded, unreachable
            $table->jsonb('metadata_cache')->nullable();
            $table->timestamp('metadata_cached_at')->nullable();
            $table->timestamps();

            $table->index('is_active');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pacs_connections');
    }
};
```

**Step 2: Run migration**

Run: `docker compose exec php php artisan migrate`
Expected: `DONE` — table created in Docker PG `parthenon` database.

**Step 3: Commit**

```bash
git add backend/database/migrations/2026_03_09_200000_create_pacs_connections_table.php
git commit -m "feat: add pacs_connections migration"
```

---

## Task 2: Eloquent Model — `PacsConnection`

**Files:**
- Create: `backend/app/Models/App/PacsConnection.php`

**Step 1: Write the model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PacsConnection extends Model
{
    protected $table = 'pacs_connections';

    protected $fillable = [
        'name',
        'type',
        'base_url',
        'auth_type',
        'credentials',
        'is_default',
        'is_active',
        'source_id',
        'last_health_check_at',
        'last_health_status',
        'metadata_cache',
        'metadata_cached_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_active' => 'boolean',
            'credentials' => 'encrypted:array',
            'metadata_cache' => 'array',
            'last_health_check_at' => 'datetime',
            'metadata_cached_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @param Builder<PacsConnection> $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /** @param Builder<PacsConnection> $query */
    public function scopeDefault(Builder $query): void
    {
        $query->where('is_default', true);
    }

    /** @param Builder<PacsConnection> $query */
    public function scopeByType(Builder $query, string $type): void
    {
        $query->where('type', $type);
    }
}
```

**Step 2: Commit**

```bash
git add backend/app/Models/App/PacsConnection.php
git commit -m "feat: add PacsConnection eloquent model"
```

---

## Task 3: Service — `PacsConnectionService`

**Files:**
- Create: `backend/app/Services/Imaging/PacsConnectionService.php`

**Step 1: Write the service**

This service handles DICOMweb interactions for any `PacsConnection`. It builds an HTTP client from the connection's URL and credentials, then provides health checks, stats queries, and study browsing.

```php
<?php

namespace App\Services\Imaging;

use App\Models\App\PacsConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PacsConnectionService
{
    /**
     * Test connectivity to a PACS connection.
     *
     * @return array{success: bool, message: string, latency_ms: int|null, capabilities?: array<string, mixed>}
     */
    public function testConnection(PacsConnection $conn): array
    {
        $start = microtime(true);

        try {
            $client = $this->resolveClient($conn);
            $response = $client->get($this->studiesEndpoint($conn, ['limit' => 1]));
            $latency = (int) round((microtime(true) - $start) * 1000);

            if ($response->successful()) {
                $conn->update([
                    'last_health_check_at' => now(),
                    'last_health_status' => 'healthy',
                ]);

                return [
                    'success' => true,
                    'message' => 'PACS connection is reachable.',
                    'latency_ms' => $latency,
                ];
            }

            $conn->update([
                'last_health_check_at' => now(),
                'last_health_status' => 'degraded',
            ]);

            return [
                'success' => false,
                'message' => "PACS returned HTTP {$response->status()}.",
                'latency_ms' => $latency,
            ];
        } catch (\Throwable $e) {
            $conn->update([
                'last_health_check_at' => now(),
                'last_health_status' => 'unreachable',
            ]);

            Log::warning('PacsConnectionService: test failed', [
                'connection_id' => $conn->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => $e->getMessage(),
                'latency_ms' => null,
            ];
        }
    }

    /**
     * Refresh storage statistics from the PACS.
     *
     * @return array{studies_count: int, series_count: int|null, instances_count: int|null, disk_used_bytes: int|null}
     */
    public function refreshStats(PacsConnection $conn): array
    {
        $stats = [
            'studies_count' => 0,
            'series_count' => null,
            'instances_count' => null,
            'disk_used_bytes' => null,
        ];

        try {
            $client = $this->resolveClient($conn);

            // Orthanc has a dedicated /statistics endpoint
            if ($conn->type === 'orthanc') {
                $orthancBase = rtrim(preg_replace('#/dicom-web/?$#', '', $conn->base_url), '/');
                $response = $client->get("{$orthancBase}/statistics");

                if ($response->successful()) {
                    $data = $response->json();
                    $stats['studies_count'] = $data['CountStudies'] ?? 0;
                    $stats['series_count'] = $data['CountSeries'] ?? null;
                    $stats['instances_count'] = $data['CountInstances'] ?? null;
                    $diskMb = $data['TotalDiskSizeMB'] ?? null;
                    $stats['disk_used_bytes'] = $diskMb !== null ? (int) ($diskMb * 1024 * 1024) : null;
                }
            } else {
                // Generic DICOMweb — count studies via QIDO-RS with limit=1 + includefield
                $response = $client->get($this->studiesEndpoint($conn, [
                    'limit' => 1,
                    'includefield' => '00201208', // NumberOfStudyRelatedInstances
                ]));

                if ($response->successful()) {
                    // Can't get exact count from QIDO-RS without full enumeration
                    // Use the number of results as a lower bound indicator
                    $stats['studies_count'] = count($response->json() ?? []);
                }
            }

            $conn->update([
                'metadata_cache' => $stats,
                'metadata_cached_at' => now(),
            ]);

            return $stats;
        } catch (\Throwable $e) {
            Log::warning('PacsConnectionService: stats refresh failed', [
                'connection_id' => $conn->id,
                'error' => $e->getMessage(),
            ]);

            return $stats;
        }
    }

    /**
     * Browse studies on a PACS via QIDO-RS.
     *
     * @param  array{patient_name?: string, patient_id?: string, modality?: string, study_date_from?: string, study_date_to?: string, offset?: int, limit?: int}  $filters
     * @return array{studies: list<array<string, mixed>>, count: int}
     */
    public function browseStudies(PacsConnection $conn, array $filters = []): array
    {
        $params = ['limit' => $filters['limit'] ?? 25, 'offset' => $filters['offset'] ?? 0];

        if (! empty($filters['patient_name'])) {
            $params['PatientName'] = "*{$filters['patient_name']}*";
        }
        if (! empty($filters['patient_id'])) {
            $params['PatientID'] = $filters['patient_id'];
        }
        if (! empty($filters['modality'])) {
            $params['ModalitiesInStudy'] = $filters['modality'];
        }
        if (! empty($filters['study_date_from']) && ! empty($filters['study_date_to'])) {
            $params['StudyDate'] = "{$filters['study_date_from']}-{$filters['study_date_to']}";
        } elseif (! empty($filters['study_date_from'])) {
            $params['StudyDate'] = "{$filters['study_date_from']}-";
        }

        // Include useful fields
        $params['includefield'] = implode(',', [
            '00100010', // PatientName
            '00100020', // PatientID
            '00080020', // StudyDate
            '00080061', // ModalitiesInStudy
            '00081030', // StudyDescription
            '00201206', // NumberOfStudyRelatedSeries
            '00201208', // NumberOfStudyRelatedInstances
        ]);

        try {
            $client = $this->resolveClient($conn);
            $response = $client->get($this->studiesEndpoint($conn, $params));

            if (! $response->successful()) {
                return ['studies' => [], 'count' => 0];
            }

            $raw = $response->json() ?? [];
            $studies = array_map(fn (array $entry) => $this->normalizeStudy($entry), $raw);

            return ['studies' => $studies, 'count' => count($studies)];
        } catch (\Throwable $e) {
            Log::warning('PacsConnectionService: browse failed', [
                'connection_id' => $conn->id,
                'error' => $e->getMessage(),
            ]);

            return ['studies' => [], 'count' => 0];
        }
    }

    /**
     * Build an HTTP client configured for the given PACS connection.
     */
    public function resolveClient(PacsConnection $conn): PendingRequest
    {
        $client = Http::timeout(15)
            ->acceptJson()
            ->withHeaders(['Accept' => 'application/dicom+json']);

        $creds = $conn->credentials ?? [];

        return match ($conn->auth_type) {
            'basic' => $client->withBasicAuth($creds['username'] ?? '', $creds['password'] ?? ''),
            'bearer' => $client->withToken($creds['token'] ?? ''),
            default => $client,
        };
    }

    /**
     * Build the QIDO-RS studies URL for the connection.
     *
     * @param  array<string, mixed>  $params
     */
    private function studiesEndpoint(PacsConnection $conn, array $params = []): string
    {
        $base = rtrim($conn->base_url, '/');

        // Orthanc DICOMweb plugin: base_url already includes /dicom-web
        // Generic DICOMweb: base_url is the WADO-RS root
        $url = "{$base}/studies";

        if (! empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        return $url;
    }

    /**
     * Normalize a QIDO-RS study entry to a flat array.
     *
     * @param  array<string, mixed>  $entry  Raw DICOM JSON
     * @return array<string, mixed>
     */
    private function normalizeStudy(array $entry): array
    {
        return [
            'study_instance_uid' => $this->dicomValue($entry, '0020000D'),
            'patient_name' => $this->dicomValue($entry, '00100010'),
            'patient_id' => $this->dicomValue($entry, '00100020'),
            'study_date' => $this->dicomValue($entry, '00080020'),
            'modalities' => $this->dicomValue($entry, '00080061'),
            'study_description' => $this->dicomValue($entry, '00081030'),
            'num_series' => $this->dicomValue($entry, '00201206'),
            'num_instances' => $this->dicomValue($entry, '00201208'),
        ];
    }

    /**
     * Extract the first Value from a DICOM JSON tag.
     */
    private function dicomValue(array $entry, string $tag): mixed
    {
        $element = $entry[$tag] ?? null;
        if (! $element || ! isset($element['Value'])) {
            return null;
        }

        $val = $element['Value'][0] ?? null;

        // PersonName is nested: {"Alphabetic": "DOE^JOHN"}
        if (is_array($val) && isset($val['Alphabetic'])) {
            return $val['Alphabetic'];
        }

        return $val;
    }
}
```

**Step 2: Commit**

```bash
git add backend/app/Services/Imaging/PacsConnectionService.php
git commit -m "feat: add PacsConnectionService for DICOMweb health/stats/browse"
```

---

## Task 4: Form Request — `PacsConnectionRequest`

**Files:**
- Create: `backend/app/Http/Requests/PacsConnectionRequest.php`

**Step 1: Write the form request**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PacsConnectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Route middleware handles role check
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $isUpdate = $this->isMethod('PUT') || $this->isMethod('PATCH');
        $sometimes = $isUpdate ? 'sometimes' : 'required';

        return [
            'name' => "{$sometimes}|string|max:255",
            'type' => [
                $sometimes,
                'string',
                Rule::in(['orthanc', 'dicomweb', 'google_healthcare', 'cloud_other']),
            ],
            'base_url' => "{$sometimes}|url|max:2000",
            'auth_type' => [
                'sometimes',
                'string',
                Rule::in(['none', 'basic', 'bearer']),
            ],
            'credentials' => 'nullable|array',
            'credentials.username' => 'required_if:auth_type,basic|string|max:200',
            'credentials.password' => 'required_if:auth_type,basic|string|max:200',
            'credentials.token' => 'required_if:auth_type,bearer|string|max:2000',
            'is_active' => 'sometimes|boolean',
            'source_id' => 'nullable|integer|exists:sources,id',
        ];
    }
}
```

**Step 2: Commit**

```bash
git add backend/app/Http/Requests/PacsConnectionRequest.php
git commit -m "feat: add PacsConnectionRequest validation"
```

---

## Task 5: Controller — `PacsConnectionController`

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/Admin/PacsConnectionController.php`

**Step 1: Write the controller**

```php
<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\PacsConnectionRequest;
use App\Models\App\PacsConnection;
use App\Services\Imaging\PacsConnectionService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

#[Group('Administration', weight: 230)]
class PacsConnectionController extends Controller
{
    public function __construct(
        private readonly PacsConnectionService $pacsService,
    ) {}

    public function index(): JsonResponse
    {
        $connections = PacsConnection::with('source:id,source_name')
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $connections]);
    }

    public function show(PacsConnection $pacsConnection): JsonResponse
    {
        $pacsConnection->load('source:id,source_name');

        return response()->json(['data' => $pacsConnection]);
    }

    public function store(PacsConnectionRequest $request): JsonResponse
    {
        $connection = PacsConnection::create($request->validated());

        return response()->json(['data' => $connection], 201);
    }

    public function update(PacsConnectionRequest $request, PacsConnection $pacsConnection): JsonResponse
    {
        $pacsConnection->update($request->validated());

        return response()->json(['data' => $pacsConnection->fresh()]);
    }

    public function destroy(PacsConnection $pacsConnection): JsonResponse
    {
        $pacsConnection->update(['is_active' => false]);

        return response()->json(null, 204);
    }

    public function test(PacsConnection $pacsConnection): JsonResponse
    {
        $result = $this->pacsService->testConnection($pacsConnection);

        return response()->json($result);
    }

    public function refreshStats(PacsConnection $pacsConnection): JsonResponse
    {
        $stats = $this->pacsService->refreshStats($pacsConnection);

        return response()->json(['data' => $stats]);
    }

    public function studies(Request $request, PacsConnection $pacsConnection): JsonResponse
    {
        $filters = $request->validate([
            'patient_name' => 'nullable|string|max:200',
            'patient_id' => 'nullable|string|max:200',
            'modality' => 'nullable|string|max:10',
            'study_date_from' => 'nullable|date_format:Ymd',
            'study_date_to' => 'nullable|date_format:Ymd',
            'offset' => 'nullable|integer|min:0',
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        $result = $this->pacsService->browseStudies($pacsConnection, $filters);

        return response()->json(['data' => $result]);
    }

    public function setDefault(PacsConnection $pacsConnection): JsonResponse
    {
        DB::transaction(function () use ($pacsConnection) {
            PacsConnection::query()->update(['is_default' => false]);
            $pacsConnection->update(['is_default' => true]);
        });

        return response()->json(['data' => $pacsConnection->fresh()]);
    }
}
```

**Step 2: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/Admin/PacsConnectionController.php
git commit -m "feat: add PacsConnectionController with CRUD and DICOMweb actions"
```

---

## Task 6: Routes — API registration

**Files:**
- Modify: `backend/routes/api.php`

**Step 1: Add import at top of file** (around line 10, alongside other Admin imports)

Add this line after the existing `use App\Http\Controllers\Api\V1\Admin\FhirConnectionController;`:

```php
use App\Http\Controllers\Api\V1\Admin\PacsConnectionController;
```

**Step 2: Add route group** (inside the `Route::prefix('admin')->middleware('role:admin|super-admin')` group, after the FHIR connections block ~line 485)

```php
            // ── PACS Connections (super-admin only) ───────────────────────
            Route::middleware('role:super-admin')->prefix('pacs-connections')->group(function () {
                Route::get('/', [PacsConnectionController::class, 'index']);
                Route::post('/', [PacsConnectionController::class, 'store']);
                Route::get('/{pacsConnection}', [PacsConnectionController::class, 'show']);
                Route::put('/{pacsConnection}', [PacsConnectionController::class, 'update']);
                Route::delete('/{pacsConnection}', [PacsConnectionController::class, 'destroy']);
                Route::post('/{pacsConnection}/test', [PacsConnectionController::class, 'test']);
                Route::post('/{pacsConnection}/refresh-stats', [PacsConnectionController::class, 'refreshStats']);
                Route::get('/{pacsConnection}/studies', [PacsConnectionController::class, 'studies']);
                Route::post('/{pacsConnection}/set-default', [PacsConnectionController::class, 'setDefault']);
            });
```

**Step 3: Verify routes registered**

Run: `docker compose exec php php artisan route:list --path=admin/pacs`
Expected: 9 routes listed under `api/v1/admin/pacs-connections`

**Step 4: Commit**

```bash
git add backend/routes/api.php
git commit -m "feat: register PACS connection admin routes"
```

---

## Task 7: Seeder — Default Orthanc connection

**Files:**
- Create: `backend/database/seeders/PacsConnectionSeeder.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php` (add call)

**Step 1: Write the seeder**

```php
<?php

namespace Database\Seeders;

use App\Models\App\PacsConnection;
use Illuminate\Database\Seeder;

class PacsConnectionSeeder extends Seeder
{
    public function run(): void
    {
        PacsConnection::updateOrCreate(
            ['name' => 'Local Orthanc'],
            [
                'type' => 'orthanc',
                'base_url' => 'http://orthanc:8042/dicom-web',
                'auth_type' => 'none',
                'is_default' => true,
                'is_active' => true,
            ],
        );
    }
}
```

**Step 2: Add to DatabaseSeeder**

In `backend/database/seeders/DatabaseSeeder.php`, add `$this->call(PacsConnectionSeeder::class);` after the existing seeder calls.

**Step 3: Run the seeder**

Run: `docker compose exec php php artisan db:seed --class=PacsConnectionSeeder`
Expected: `Seeding: Database\Seeders\PacsConnectionSeeder` — 1 row created

**Step 4: Commit**

```bash
git add backend/database/seeders/PacsConnectionSeeder.php backend/database/seeders/DatabaseSeeder.php
git commit -m "feat: seed default local Orthanc PACS connection"
```

---

## Task 8: Frontend API client — `pacsApi.ts`

**Files:**
- Create: `frontend/src/features/administration/api/pacsApi.ts`

**Step 1: Write the API client**

```typescript
import apiClient from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────

export interface PacsConnection {
  id: number;
  name: string;
  type: "orthanc" | "dicomweb" | "google_healthcare" | "cloud_other";
  base_url: string;
  auth_type: "none" | "basic" | "bearer";
  is_default: boolean;
  is_active: boolean;
  source_id: number | null;
  source?: { id: number; source_name: string } | null;
  last_health_check_at: string | null;
  last_health_status: "healthy" | "degraded" | "unreachable" | null;
  metadata_cache: PacsStats | null;
  metadata_cached_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PacsStats {
  studies_count: number;
  series_count: number | null;
  instances_count: number | null;
  disk_used_bytes: number | null;
}

export interface PacsConnectionPayload {
  name: string;
  type: string;
  base_url: string;
  auth_type?: string;
  credentials?: Record<string, string>;
  is_active?: boolean;
  source_id?: number | null;
}

export interface PacsTestResult {
  success: boolean;
  message: string;
  latency_ms: number | null;
}

export interface PacsStudy {
  study_instance_uid: string | null;
  patient_name: string | null;
  patient_id: string | null;
  study_date: string | null;
  modalities: string | null;
  study_description: string | null;
  num_series: number | null;
  num_instances: number | null;
}

export interface PacsStudyBrowseResult {
  studies: PacsStudy[];
  count: number;
}

export interface PacsStudyFilters {
  patient_name?: string;
  patient_id?: string;
  modality?: string;
  study_date_from?: string;
  study_date_to?: string;
  offset?: number;
  limit?: number;
}

// ── API calls ────────────────────────────────────────────────────────────

const BASE = "/admin/pacs-connections";

export async function fetchPacsConnections(): Promise<PacsConnection[]> {
  const { data } = await apiClient.get(BASE);
  return data.data ?? data;
}

export async function fetchPacsConnection(id: number): Promise<PacsConnection> {
  const { data } = await apiClient.get(`${BASE}/${id}`);
  return data.data ?? data;
}

export async function createPacsConnection(payload: PacsConnectionPayload): Promise<PacsConnection> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data ?? data;
}

export async function updatePacsConnection(id: number, payload: Partial<PacsConnectionPayload>): Promise<PacsConnection> {
  const { data } = await apiClient.put(`${BASE}/${id}`, payload);
  return data.data ?? data;
}

export async function deletePacsConnection(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function testPacsConnection(id: number): Promise<PacsTestResult> {
  const { data } = await apiClient.post(`${BASE}/${id}/test`);
  return data.data ?? data;
}

export async function refreshPacsStats(id: number): Promise<PacsStats> {
  const { data } = await apiClient.post(`${BASE}/${id}/refresh-stats`);
  return data.data ?? data;
}

export async function browsePacsStudies(id: number, filters?: PacsStudyFilters): Promise<PacsStudyBrowseResult> {
  const { data } = await apiClient.get(`${BASE}/${id}/studies`, { params: filters });
  return data.data ?? data;
}

export async function setDefaultPacsConnection(id: number): Promise<PacsConnection> {
  const { data } = await apiClient.post(`${BASE}/${id}/set-default`);
  return data.data ?? data;
}
```

**Step 2: Commit**

```bash
git add frontend/src/features/administration/api/pacsApi.ts
git commit -m "feat: add PACS connections API client"
```

---

## Task 9: Frontend hooks — `usePacsConnections.ts`

**Files:**
- Create: `frontend/src/features/administration/hooks/usePacsConnections.ts`

**Step 1: Write TanStack Query hooks**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPacsConnections,
  createPacsConnection,
  updatePacsConnection,
  deletePacsConnection,
  testPacsConnection,
  refreshPacsStats,
  browsePacsStudies,
  setDefaultPacsConnection,
} from "../api/pacsApi";
import type { PacsConnectionPayload, PacsStudyFilters } from "../api/pacsApi";

const KEY = ["pacs-connections"] as const;

export function usePacsConnections() {
  return useQuery({
    queryKey: KEY,
    queryFn: fetchPacsConnections,
  });
}

export function useCreatePacsConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PacsConnectionPayload) => createPacsConnection(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdatePacsConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<PacsConnectionPayload> }) =>
      updatePacsConnection(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeletePacsConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePacsConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTestPacsConnection() {
  return useMutation({
    mutationFn: (id: number) => testPacsConnection(id),
  });
}

export function useRefreshPacsStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => refreshPacsStats(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePacsStudies(connectionId: number | null, filters?: PacsStudyFilters) {
  return useQuery({
    queryKey: [...KEY, connectionId, "studies", filters],
    queryFn: () => browsePacsStudies(connectionId!, filters),
    enabled: connectionId != null,
    staleTime: 30_000,
  });
}

export function useSetDefaultPacs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => setDefaultPacsConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

**Step 2: Commit**

```bash
git add frontend/src/features/administration/hooks/usePacsConnections.ts
git commit -m "feat: add TanStack Query hooks for PACS connections"
```

---

## Task 10: Frontend — `PacsConnectionCard.tsx`

**Files:**
- Create: `frontend/src/features/administration/components/PacsConnectionCard.tsx`

**Step 1: Write the card component**

Displays a single PACS connection with status dot, type badge, 4 stats metrics, and action buttons. Follows the dark clinical theme (`#0E0E11` base, `#2DD4BF` teal, `#C9A227` gold). Reference: existing `MetricCard` from `@/components/ui`.

```typescript
import { useState } from "react";
import {
  Loader2,
  Star,
  Pencil,
  Trash2,
  RefreshCw,
  Plug,
  FolderSearch,
  HardDrive,
  Database,
  Film,
  Image,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PacsConnection } from "../api/pacsApi";

interface PacsConnectionCardProps {
  connection: PacsConnection;
  onTest: (id: number) => void;
  onRefresh: (id: number) => void;
  onEdit: (conn: PacsConnection) => void;
  onDelete: (id: number) => void;
  onBrowse: (conn: PacsConnection) => void;
  onSetDefault: (id: number) => void;
  isTesting?: boolean;
  isRefreshing?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  orthanc: "Orthanc",
  dicomweb: "DICOMweb",
  google_healthcare: "Google Healthcare",
  cloud_other: "Cloud",
};

const STATUS_COLORS: Record<string, string> = {
  healthy: "#2DD4BF",
  degraded: "#C9A227",
  unreachable: "#E85A6B",
};

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export function PacsConnectionCard({
  connection: conn,
  onTest,
  onRefresh,
  onEdit,
  onDelete,
  onBrowse,
  onSetDefault,
  isTesting,
  isRefreshing,
}: PacsConnectionCardProps) {
  const stats = conn.metadata_cache;
  const statusColor = STATUS_COLORS[conn.last_health_status ?? ""] ?? "#5A5650";

  return (
    <div
      className={cn(
        "rounded-xl border bg-[#151518] overflow-hidden transition-opacity",
        conn.is_default ? "border-[#C9A227]/40" : "border-[#232328]",
        !conn.is_active && "opacity-50",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1C1C20]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status dot */}
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: statusColor }}
            title={conn.last_health_status ?? "unknown"}
          />
          <h3 className="text-sm font-semibold text-[#F0EDE8] truncate">{conn.name}</h3>
          {conn.is_default && (
            <Star size={12} className="text-[#C9A227] shrink-0" fill="#C9A227" />
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/10 text-[#2DD4BF]">
            {TYPE_LABELS[conn.type] ?? conn.type}
          </span>
          {!conn.is_default && conn.is_active && (
            <button
              type="button"
              onClick={() => onSetDefault(conn.id)}
              className="p-1 rounded text-[#5A5650] hover:text-[#C9A227] transition-colors"
              title="Set as default"
            >
              <Star size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(conn)}
            className="p-1 rounded text-[#5A5650] hover:text-[#F0EDE8] transition-colors"
            title="Edit"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(conn.id)}
            className="p-1 rounded text-[#5A5650] hover:text-[#E85A6B] transition-colors"
            title="Deactivate"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-px bg-[#232328]">
        {[
          { label: "Studies", value: formatCount(stats?.studies_count), icon: Database },
          { label: "Series", value: formatCount(stats?.series_count), icon: Film },
          { label: "Instances", value: formatCount(stats?.instances_count), icon: Image },
          { label: "Disk", value: formatBytes(stats?.disk_used_bytes), icon: HardDrive },
        ].map((m) => (
          <div key={m.label} className="bg-[#151518] px-3 py-2.5 text-center">
            <m.icon size={12} className="mx-auto text-[#5A5650] mb-1" />
            <p className="font-['IBM_Plex_Mono',monospace] text-sm font-medium text-[#F0EDE8]">
              {m.value}
            </p>
            <p className="text-[10px] text-[#5A5650]">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#151518] border-t border-[#232328]">
        <span className="text-[10px] text-[#5A5650]">
          {conn.metadata_cached_at
            ? `Stats updated ${new Date(conn.metadata_cached_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
            : "No stats cached"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTest(conn.id)}
            disabled={isTesting}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-50"
          >
            {isTesting ? <Loader2 size={10} className="animate-spin" /> : <Plug size={10} />}
            Test
          </button>
          <button
            type="button"
            onClick={() => onRefresh(conn.id)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-50"
          >
            {isRefreshing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Stats
          </button>
          <button
            type="button"
            onClick={() => onBrowse(conn)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-[#2DD4BF] hover:bg-[#2DD4BF]/10 transition-colors"
          >
            <FolderSearch size={10} />
            Browse
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/features/administration/components/PacsConnectionCard.tsx
git commit -m "feat: add PacsConnectionCard component"
```

---

## Task 11: Frontend — `PacsConnectionFormModal.tsx`

**Files:**
- Create: `frontend/src/features/administration/components/PacsConnectionFormModal.tsx`

**Step 1: Write the form modal**

Add/edit modal with fields: name, type, base_url, auth_type, conditional credentials, optional source link, and "Test Connection" button. Follows existing modal patterns (fixed overlay, dark background, teal primary actions).

The component receives `editConnection` (null for create mode) and uses `useCreatePacsConnection` / `useUpdatePacsConnection` mutations. The "Test Connection" button calls a temporary save then `useTestPacsConnection`, showing latency + success/fail inline before the user clicks "Save".

**Key implementation notes:**
- Form state via `useState` (no external form library — matches project pattern)
- Credentials fields appear/disappear based on `authType` select
- Source selector uses `fetchSources` from `@/features/data-sources/api/sourcesApi`
- Test result shown as inline banner (green/red) below the form
- Modal closes on successful save, triggers query invalidation

This component is ~200 lines. Write it following the exact patterns from `PacsConnectionCard.tsx` above for styling (same color tokens, IBM Plex Mono for values, Tailwind 4 classes).

**Step 2: Commit**

```bash
git add frontend/src/features/administration/components/PacsConnectionFormModal.tsx
git commit -m "feat: add PacsConnectionFormModal with test-before-save"
```

---

## Task 12: Frontend — `PacsStudyBrowser.tsx`

**Files:**
- Create: `frontend/src/features/administration/components/PacsStudyBrowser.tsx`

**Step 1: Write the study browser drawer**

Right-slide drawer that opens when "Browse" is clicked on a connection card. Contains:
- Search bar (patient name / patient ID input)
- Modality filter (select with CT, MR, PT, US, CR, DX, MG options)
- Results table: PatientName, PatientID, StudyDate, Modality, Description, Series, Instances
- Pagination (offset-based, 25 per page)
- Uses `usePacsStudies` hook with debounced search params

**Key implementation notes:**
- Fixed overlay panel sliding from right (`translate-x` transition)
- Close button (X) top-right
- Table rows show "Not indexed" badge if no matching `imaging_study` exists (future enhancement — for now just show the raw QIDO-RS data)
- Empty state: "No studies found" with search icon
- Loading state: spinner centered in table area

This component is ~180 lines. Dark theme, monospace for UID/counts, standard table styling.

**Step 2: Commit**

```bash
git add frontend/src/features/administration/components/PacsStudyBrowser.tsx
git commit -m "feat: add PacsStudyBrowser drawer for QIDO-RS browsing"
```

---

## Task 13: Frontend — `PacsConnectionsPage.tsx` (main page)

**Files:**
- Create: `frontend/src/features/administration/pages/PacsConnectionsPage.tsx`

**Step 1: Write the page**

Main admin page that composes the card, modal, and browser components. Layout:
- Header: "PACS Connections" title + "Add Connection" teal button
- Card grid (responsive: 1 col mobile, 2 col desktop) via `usePacsConnections` query
- `PacsConnectionFormModal` (controlled by `editConn` state, null = closed, `{}` = create, populated = edit)
- `PacsStudyBrowser` (controlled by `browseConn` state)
- Test/refresh mutations with per-connection loading state tracked by `testingId` / `refreshingId`

**Key implementation notes:**
- Loading skeleton: 2 placeholder cards with animate-pulse
- Error state: red banner with retry button
- Empty state: "No PACS connections configured" + "Add Connection" CTA
- After test, show toast-like result below the tested card (or use existing notification pattern)
- `export default` for lazy loading in router

This component is ~150 lines.

**Step 2: Commit**

```bash
git add frontend/src/features/administration/pages/PacsConnectionsPage.tsx
git commit -m "feat: add PacsConnectionsPage admin page"
```

---

## Task 14: Router + Admin Dashboard — Wire it up

**Files:**
- Modify: `frontend/src/app/router.tsx` (~line 444, after fhir-connections route)
- Modify: `frontend/src/features/administration/pages/AdminDashboardPage.tsx` (~line 78, add to NAV_CARDS)

**Step 1: Add route to router.tsx**

After the `fhir-connections` route entry (around line 444), add:

```typescript
          {
            path: "pacs-connections",
            lazy: () =>
              import(
                "@/features/administration/pages/PacsConnectionsPage"
              ).then((m) => ({ Component: m.default })),
          },
```

**Step 2: Add nav card to AdminDashboardPage.tsx**

Add a new entry to the `NAV_CARDS` array (after the FHIR entry, before the closing `];`):

```typescript
  {
    title: "PACS Connections",
    description: "Configure and monitor DICOM imaging servers. Browse studies, check health, manage multi-PACS.",
    icon: HardDrive,
    href: "/admin/pacs-connections",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    superAdminOnly: true,
  },
```

Also add `HardDrive` to the Lucide import at the top of the file.

**Step 3: Build and verify**

Run: `docker compose exec node sh -c "cd /app && npx vite build"`
Expected: Build succeeds, no TypeScript errors.

**Step 4: Commit**

```bash
git add frontend/src/app/router.tsx frontend/src/features/administration/pages/AdminDashboardPage.tsx
git commit -m "feat: wire PACS connections into router and admin dashboard"
```

---

## Task 15: DicomwebService — `forConnection()` method

**Files:**
- Modify: `backend/app/Services/Imaging/DicomwebService.php`

**Step 1: Add `forConnection` static factory**

Add this public static method to `DicomwebService` that configures a new instance from a `PacsConnection` model instead of config values:

```php
    /**
     * Create a DicomwebService configured from a PacsConnection model.
     */
    public static function forConnection(PacsConnection $conn): self
    {
        $instance = new self();
        $instance->baseUrl = rtrim($conn->base_url, '/');

        $creds = $conn->credentials ?? [];
        $instance->username = $creds['username'] ?? null;
        $instance->password = $creds['password'] ?? null;

        // Bearer token support — store in username field for now
        // (the request() method will need to check auth_type)

        return $instance;
    }
```

Also add `use App\Models\App\PacsConnection;` at the top of the file.

**Step 2: Commit**

```bash
git add backend/app/Services/Imaging/DicomwebService.php
git commit -m "feat: add DicomwebService::forConnection() for multi-PACS support"
```

---

## Task 16: Deploy + verify

**Step 1: Run migration on production**

Run: `./deploy.sh`
Expected: Migration runs, frontend rebuilds, caches clear.

**Step 2: Seed the default Orthanc connection**

Run: `docker compose exec php php artisan db:seed --class=PacsConnectionSeeder`

**Step 3: Manual verification**

1. Navigate to `https://parthenon.acumenus.net/admin`
2. Verify "PACS Connections" card appears (8th card, cyan icon)
3. Click into it — should show "Local Orthanc" card with default star
4. Click "Test" — should show green result with latency
5. Click "Refresh Stats" — should populate study/series/instance counts
6. Click "Browse" — should open drawer showing studies from Orthanc
7. Click "Add Connection" — should open modal with form fields
8. Test creating a second DICOMweb connection (can use Orthanc's URL again for testing)

**Step 4: Final commit with devlog**

```bash
# Write devlog
git add docs/devlog/pacs-connector-admin-panel.md
git add -A  # catch any remaining files
git commit -m "feat: PACS connector admin panel — multi-PACS management with DICOMweb"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Migration | 3 |
| 2 | Eloquent model | 2 |
| 3 | PacsConnectionService | 2 |
| 4 | Form request validation | 2 |
| 5 | Controller | 2 |
| 6 | API routes | 4 |
| 7 | Seeder | 4 |
| 8 | Frontend API client | 2 |
| 9 | Frontend hooks | 2 |
| 10 | PacsConnectionCard | 2 |
| 11 | PacsConnectionFormModal | 2 |
| 12 | PacsStudyBrowser | 2 |
| 13 | PacsConnectionsPage | 2 |
| 14 | Router + admin dashboard wiring | 4 |
| 15 | DicomwebService.forConnection() | 2 |
| 16 | Deploy + verify | 4 |
| **Total** | | **41 steps** |

# Ingestion Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the "Upload Files" tab to "Ingestion" and split ProjectDetailView into two columns — "Connect to Database" (left) and "Upload Files" (right) — so users can bring data into an Ingestion Project via direct database connection or flat file upload.

**Architecture:** The left column opens a modal to connect to any of 12 HADES-supported databases, browse tables, and select which to ingest. BlackRabbit's new `/tables` endpoint provides lightweight schema inspection. The backend stores encrypted connection config on the IngestionProject model and stages selected tables via BlackRabbit profiling.

**Tech Stack:** React 19, TypeScript, TanStack Query, Zustand (none needed), Laravel 11, BlackRabbit (FastAPI/SQLAlchemy)

**Spec:** `docs/superpowers/specs/2026-03-26-ingestion-page-redesign.md`

---

## File Map

```
New files:
  blackrabbit/app/routers/tables.py                                       -- POST /tables endpoint
  blackrabbit/tests/test_tables_api.py                                    -- Tests for /tables
  backend/database/migrations/xxxx_add_db_connection_to_ingestion_projects.php -- Migration
  frontend/src/features/ingestion/components/ConnectDatabaseModal.tsx      -- Connection form + table picker modal
  frontend/src/features/ingestion/components/ConnectDatabaseColumn.tsx     -- Left column (button + connected state)

Modified files:
  blackrabbit/app/main.py                                                 -- Register tables router
  blackrabbit/app/models.py                                               -- Add TablesRequest/TablesResponse models
  backend/app/Models/App/IngestionProject.php                             -- Add fillable + casts for new fields
  backend/app/Http/Controllers/Api/V1/IngestionProjectController.php      -- Add connectDb, confirmTables, stageDb methods
  backend/routes/api.php                                                  -- Add 3 new routes
  frontend/src/features/ingestion/api/ingestionApi.ts                     -- Add connectDb, confirmTables, stageDb functions + types
  frontend/src/features/ingestion/hooks/useIngestionProjects.ts           -- Add 3 new mutation hooks
  frontend/src/features/ingestion/pages/DataIngestionPage.tsx             -- Rename tab "Upload Files" → "Ingestion"
  frontend/src/features/ingestion/pages/ProjectDetailView.tsx             -- Split upload section into 2 columns
```

---

### Task 1: BlackRabbit `/tables` Endpoint

**Files:**
- Create: `blackrabbit/app/routers/tables.py`
- Modify: `blackrabbit/app/main.py`
- Modify: `blackrabbit/app/models.py`
- Test: `blackrabbit/tests/test_tables_api.py`

- [ ] **Step 1: Add Pydantic models for /tables**

Add to `blackrabbit/app/models.py`:

```python
class TableInfo(BaseModel):
    name: str
    column_count: int
    row_count: int | None = None


class TablesRequest(BaseModel):
    dbms: str = "postgresql"
    server: str
    port: int = 5432
    user: str = ""
    password: str = ""
    schema_name: str = Field("public", alias="schema")

    model_config = {"populate_by_name": True}


class TablesResponse(BaseModel):
    tables: list[TableInfo]
```

- [ ] **Step 2: Write test for /tables**

```python
# blackrabbit/tests/test_tables_api.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_tables_sqlite_returns_table_list():
    resp = client.post("/tables", json={
        "dbms": "sqlite",
        "server": ":memory:",
        "port": 0,
        "user": "",
        "password": "",
        "schema": "main",
    })
    # SQLite :memory: has no tables — expect empty list (not error)
    assert resp.status_code == 200
    data = resp.json()
    assert "tables" in data
    assert isinstance(data["tables"], list)


def test_tables_invalid_dialect_returns_422():
    resp = client.post("/tables", json={
        "dbms": "nosql",
        "server": "localhost/db",
        "port": 0,
        "schema": "public",
    })
    assert resp.status_code in (400, 422, 500)
```

- [ ] **Step 3: Write tables router**

```python
# blackrabbit/app/routers/tables.py
"""Lightweight schema inspection — lists tables without profiling."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.engine.connection import ConnectionFactory
from app.engine.inspector import SchemaInspector
from app.models import TablesRequest, TablesResponse, TableInfo

router = APIRouter()
log = logging.getLogger("blackrabbit.tables")


@router.post("/tables")
def list_tables(request: TablesRequest) -> TablesResponse:
    try:
        engine = ConnectionFactory.create_engine(
            dbms=request.dbms,
            server=request.server,
            port=request.port,
            user=request.user,
            password=request.password,
            schema=request.schema_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        inspector = SchemaInspector(engine, request.schema_name)
        table_names = inspector.list_tables()

        tables: list[TableInfo] = []
        schema_prefix = f"{request.schema_name}." if request.schema_name and request.schema_name != "main" else ""

        for name in table_names:
            columns = inspector.get_columns(name)
            # Quick row count
            row_count = None
            try:
                with engine.connect() as conn:
                    result = conn.execute(text(f"SELECT COUNT(*) FROM {schema_prefix}{name}"))
                    row_count = result.scalar()
            except Exception:
                pass

            tables.append(TableInfo(
                name=name,
                column_count=len(columns),
                row_count=row_count,
            ))

        engine.dispose()
        return TablesResponse(tables=tables)

    except Exception as e:
        engine.dispose()
        log.exception("Failed to list tables")
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 4: Register router in main.py**

Add to `blackrabbit/app/main.py`:

```python
from app.routers import health, scan, tables

# ... existing code ...

app.include_router(tables.router)
```

- [ ] **Step 5: Run tests**

```bash
cd blackrabbit && python -m pytest tests/ -v
```

Expected: All existing tests pass + 2 new table tests pass.

- [ ] **Step 6: Commit**

```bash
git add blackrabbit/
git commit -m "feat(blackrabbit): add /tables endpoint for lightweight schema inspection"
```

---

### Task 2: Laravel Migration + Model Update

**Files:**
- Create: `backend/database/migrations/xxxx_add_db_connection_to_ingestion_projects.php`
- Modify: `backend/app/Models/App/IngestionProject.php`

- [ ] **Step 1: Create migration**

```bash
docker compose exec -T php php /var/www/html/artisan make:migration add_db_connection_to_ingestion_projects --table=ingestion_projects
```

Edit the generated file:

```php
public function up(): void
{
    Schema::table('ingestion_projects', function (Blueprint $table) {
        $table->text('db_connection_config')->nullable()->after('notes');
        $table->jsonb('selected_tables')->nullable()->after('db_connection_config');
    });
}

public function down(): void
{
    Schema::table('ingestion_projects', function (Blueprint $table) {
        $table->dropColumn(['db_connection_config', 'selected_tables']);
    });
}
```

- [ ] **Step 2: Run migration**

```bash
docker compose exec -T php php /var/www/html/artisan migrate
```

- [ ] **Step 3: Update IngestionProject model**

Add to `$fillable` array in `backend/app/Models/App/IngestionProject.php`:

```php
protected $fillable = [
    'name', 'source_id', 'status', 'created_by',
    'file_count', 'total_size_bytes', 'notes',
    'db_connection_config', 'selected_tables',
];

/** @return array<string, string> */
protected function casts(): array
{
    return [
        'db_connection_config' => 'encrypted:array',
        'selected_tables' => 'array',
    ];
}
```

- [ ] **Step 4: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/ backend/app/Models/App/IngestionProject.php
git commit -m "feat(ingestion): add db_connection_config and selected_tables to IngestionProject"
```

---

### Task 3: Laravel Backend — Connect, Confirm, Stage Endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/IngestionProjectController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Add 3 new methods to IngestionProjectController**

Read the file first. Add these imports at the top:

```php
use App\Models\App\FieldProfile;
use App\Models\App\SourceProfile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
```

Add these methods to the controller class:

```php
/**
 * POST /ingestion-projects/{project}/connect-db
 *
 * Test database connection and return table list via BlackRabbit.
 */
public function connectDb(Request $request, IngestionProject $project): JsonResponse
{
    $validated = $request->validate([
        'dbms' => 'required|string|max:64',
        'host' => 'required|string|max:255',
        'port' => 'required|integer|min:1|max:65535',
        'user' => 'nullable|string|max:255',
        'password' => 'nullable|string|max:255',
        'database' => 'required|string|max:255',
        'schema' => 'required|string|max:255',
    ]);

    $blackRabbitUrl = rtrim(config('services.blackrabbit.url', 'http://blackrabbit:8090'), '/');

    try {
        $response = Http::timeout(30)->post("{$blackRabbitUrl}/tables", [
            'dbms' => $validated['dbms'],
            'server' => "{$validated['host']}/{$validated['database']}",
            'port' => $validated['port'],
            'user' => $validated['user'] ?? '',
            'password' => $validated['password'] ?? '',
            'schema' => $validated['schema'],
        ]);

        if ($response->failed()) {
            return response()->json([
                'error' => 'Connection failed',
                'message' => $response->json('detail') ?? 'Unable to connect to database.',
            ], 422);
        }

        // Save connection config (encrypted)
        $project->update([
            'db_connection_config' => $validated,
        ]);

        return response()->json([
            'data' => [
                'connected' => true,
                'tables' => $response->json('tables') ?? [],
            ],
        ]);
    } catch (\Throwable $e) {
        Log::warning('Database connection test failed', [
            'project_id' => $project->id,
            'error' => $e->getMessage(),
        ]);

        return response()->json([
            'error' => 'Connection failed',
            'message' => $e->getMessage(),
        ], 422);
    }
}

/**
 * POST /ingestion-projects/{project}/confirm-tables
 *
 * Save selected table list on the project.
 */
public function confirmTables(Request $request, IngestionProject $project): JsonResponse
{
    $validated = $request->validate([
        'tables' => 'required|array|min:1',
        'tables.*' => 'string|max:255',
    ]);

    $project->update([
        'selected_tables' => $validated['tables'],
    ]);

    return response()->json([
        'data' => [
            'tables' => $validated['tables'],
            'count' => count($validated['tables']),
        ],
    ]);
}

/**
 * POST /ingestion-projects/{project}/stage-db
 *
 * Trigger BlackRabbit scan on selected tables, persist results as IngestionJobs + SourceProfiles.
 */
public function stageDb(IngestionProject $project): JsonResponse
{
    $config = $project->db_connection_config;
    $tables = $project->selected_tables;

    if (! $config || ! $tables) {
        return response()->json([
            'error' => 'No database connection or tables configured',
        ], 422);
    }

    $blackRabbitUrl = rtrim(config('services.blackrabbit.url', 'http://blackrabbit:8090'), '/');

    try {
        // Start BlackRabbit scan
        $scanPayload = [
            'dbms' => $config['dbms'],
            'server' => "{$config['host']}/{$config['database']}",
            'port' => (int) $config['port'],
            'user' => $config['user'] ?? '',
            'password' => $config['password'] ?? '',
            'schema' => $config['schema'],
            'tables' => $tables,
        ];

        $startResp = Http::timeout(30)->post("{$blackRabbitUrl}/scan", $scanPayload);
        if ($startResp->failed()) {
            throw new \RuntimeException('BlackRabbit scan failed to start: '.($startResp->json('detail') ?? $startResp->body()));
        }

        $scanId = $startResp->json('scan_id');

        // Poll for result
        $maxWait = 600;
        $waited = 0;
        $scanData = null;
        while ($waited < $maxWait) {
            usleep(500_000);
            $waited += 0.5;

            $resultResp = Http::timeout(10)->get("{$blackRabbitUrl}/scan/{$scanId}/result");
            if ($resultResp->status() === 404) {
                continue;
            }
            if ($resultResp->successful()) {
                $scanData = $resultResp->json();
                break;
            }
            if ($resultResp->status() === 410) {
                throw new \RuntimeException('Scan expired');
            }
        }

        if (! $scanData) {
            throw new \RuntimeException('Scan timed out');
        }

        // Create IngestionJob + SourceProfile per table
        $jobIds = [];
        foreach ($scanData['tables'] ?? [] as $tableData) {
            $tableName = $tableData['table_name'] ?? '';
            if (! $tableName) {
                continue;
            }

            $job = IngestionJob::create([
                'ingestion_project_id' => $project->id,
                'status' => ExecutionStatus::Completed,
                'current_step' => IngestionStep::Profiling,
                'progress_percentage' => 100,
                'staging_table_name' => $tableName,
                'created_by' => auth()->id(),
                'stats_json' => [
                    'staging_table_name' => $tableName,
                    'row_count' => $tableData['row_count'] ?? 0,
                    'column_count' => $tableData['column_count'] ?? 0,
                    'source' => 'database',
                ],
            ]);

            $profile = SourceProfile::create([
                'ingestion_job_id' => $job->id,
                'scan_type' => 'blackrabbit',
                'table_count' => 1,
                'column_count' => $tableData['column_count'] ?? 0,
                'total_rows' => $tableData['row_count'] ?? 0,
                'row_count' => $tableData['row_count'] ?? 0,
                'scan_time_seconds' => $scanData['scan_time_seconds'] ?? 0,
                'overall_grade' => 'A',
            ]);

            // Persist field profiles
            foreach ($tableData['columns'] ?? [] as $idx => $col) {
                FieldProfile::create([
                    'source_profile_id' => $profile->id,
                    'table_name' => $tableName,
                    'row_count' => $tableData['row_count'] ?? 0,
                    'column_name' => $col['name'],
                    'column_index' => $idx,
                    'inferred_type' => $col['type'] ?? 'unknown',
                    'non_null_count' => $col['non_null_count'] ?? 0,
                    'null_count' => $col['null_count'] ?? 0,
                    'null_percentage' => $col['null_percentage'] ?? 0,
                    'distinct_count' => $col['distinct_count'] ?? 0,
                    'distinct_percentage' => $col['distinct_percentage'] ?? 0,
                    'sample_values' => $col['top_values'] ?? null,
                ]);
            }

            $jobIds[] = ['id' => $job->id, 'staging_table_name' => $tableName];
        }

        $project->update([
            'status' => 'ready',
            'file_count' => count($jobIds),
        ]);

        return response()->json([
            'data' => ['jobs' => $jobIds],
            'message' => 'Database tables profiled and staged.',
        ]);
    } catch (\Throwable $e) {
        Log::error('Database staging failed', [
            'project_id' => $project->id,
            'error' => $e->getMessage(),
        ]);

        return response()->json([
            'error' => 'Database staging failed',
            'message' => $e->getMessage(),
        ], 502);
    }
}
```

- [ ] **Step 2: Add routes to api.php**

Inside the existing `ingestion-projects` route group (after the `preview` route, before the closing `});`), add:

```php
Route::post('/{project}/connect-db', [IngestionProjectController::class, 'connectDb'])
    ->middleware('permission:ingestion.upload')
    ->where('project', '[0-9]+');
Route::post('/{project}/confirm-tables', [IngestionProjectController::class, 'confirmTables'])
    ->middleware('permission:ingestion.upload')
    ->where('project', '[0-9]+');
Route::post('/{project}/stage-db', [IngestionProjectController::class, 'stageDb'])
    ->middleware(['permission:ingestion.upload', 'throttle:5,10'])
    ->where('project', '[0-9]+');
```

- [ ] **Step 3: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/IngestionProjectController.php backend/routes/api.php
git commit -m "feat(ingestion): add connect-db, confirm-tables, and stage-db endpoints"
```

---

### Task 4: Frontend API + Hooks

**Files:**
- Modify: `frontend/src/features/ingestion/api/ingestionApi.ts`
- Modify: `frontend/src/features/ingestion/hooks/useIngestionProjects.ts`

- [ ] **Step 1: Add types and API functions to ingestionApi.ts**

Read the file first. Add the `IngestionProject` interface fields and new functions. First update the `IngestionProject` interface to include new fields:

```typescript
// Add to IngestionProject interface:
  db_connection_config?: {
    dbms: string;
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    schema: string;
  } | null;
  selected_tables?: string[] | null;
```

Then append these types and functions:

```typescript
// --- Database Connection types ---
export interface DbConnectionConfig {
  dbms: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  schema: string;
}

export interface DbTableInfo {
  name: string;
  column_count: number;
  row_count: number | null;
}

export interface ConnectDbResult {
  connected: boolean;
  tables: DbTableInfo[];
}

export async function connectDatabase(
  projectId: number,
  config: DbConnectionConfig,
): Promise<ConnectDbResult> {
  const { data } = await apiClient.post<{ data: ConnectDbResult }>(
    `/ingestion-projects/${projectId}/connect-db`,
    config,
  );
  return unwrap<ConnectDbResult>(data);
}

export async function confirmTables(
  projectId: number,
  tables: string[],
): Promise<{ tables: string[]; count: number }> {
  const { data } = await apiClient.post<{ data: { tables: string[]; count: number } }>(
    `/ingestion-projects/${projectId}/confirm-tables`,
    { tables },
  );
  return unwrap(data);
}

export async function stageDatabase(
  projectId: number,
): Promise<{ jobs: Array<{ id: number; staging_table_name: string }> }> {
  const { data } = await apiClient.post<{ data: { jobs: Array<{ id: number; staging_table_name: string }> } }>(
    `/ingestion-projects/${projectId}/stage-db`,
    {},
    { timeout: 600000 },
  );
  return unwrap(data);
}
```

- [ ] **Step 2: Add hooks to useIngestionProjects.ts**

Read the file first. Add these imports and hooks:

```typescript
import {
  // ... existing imports ...
  connectDatabase,
  confirmTables,
  stageDatabase,
  type DbConnectionConfig,
  type ConnectDbResult,
} from "../api/ingestionApi";

export function useConnectDatabase(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: DbConnectionConfig) => connectDatabase(projectId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-project", projectId] });
    },
  });
}

export function useConfirmTables(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tables: string[]) => confirmTables(projectId, tables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-project", projectId] });
    },
  });
}

export function useStageDatabase(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => stageDatabase(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-project", projectId] });
    },
  });
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/ingestion/api/ingestionApi.ts frontend/src/features/ingestion/hooks/useIngestionProjects.ts
git commit -m "feat(ingestion): add connectDatabase, confirmTables, stageDatabase API + hooks"
```

---

### Task 5: ConnectDatabaseModal Component

**Files:**
- Create: `frontend/src/features/ingestion/components/ConnectDatabaseModal.tsx`

- [ ] **Step 1: Write the modal component**

```tsx
// frontend/src/features/ingestion/components/ConnectDatabaseModal.tsx
import { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Database,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DbConnectionConfig, DbTableInfo } from "../api/ingestionApi";

const DIALECT_OPTIONS = [
  { value: "postgresql", label: "PostgreSQL", defaultPort: 5432 },
  { value: "sql server", label: "SQL Server", defaultPort: 1433 },
  { value: "oracle", label: "Oracle", defaultPort: 1521 },
  { value: "mysql", label: "MySQL", defaultPort: 3306 },
  { value: "mariadb", label: "MariaDB", defaultPort: 3306 },
  { value: "bigquery", label: "BigQuery", defaultPort: 443 },
  { value: "redshift", label: "Redshift", defaultPort: 5439 },
  { value: "snowflake", label: "Snowflake", defaultPort: 443 },
  { value: "spark", label: "Spark / Databricks", defaultPort: 443 },
  { value: "duckdb", label: "DuckDB", defaultPort: 0 },
  { value: "sqlite", label: "SQLite", defaultPort: 0 },
  { value: "synapse", label: "Synapse", defaultPort: 1433 },
] as const;

interface ConnectDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: DbConnectionConfig) => Promise<{ tables: DbTableInfo[] }>;
  onConfirm: (config: DbConnectionConfig, tables: string[]) => void;
  initialConfig?: DbConnectionConfig | null;
  initialSelectedTables?: string[] | null;
  isConnecting: boolean;
}

export default function ConnectDatabaseModal({
  isOpen,
  onClose,
  onConnect,
  onConfirm,
  initialConfig,
  initialSelectedTables,
  isConnecting,
}: ConnectDatabaseModalProps) {
  const [dbms, setDbms] = useState(initialConfig?.dbms ?? "postgresql");
  const [host, setHost] = useState(initialConfig?.host ?? "");
  const [port, setPort] = useState(initialConfig?.port ?? 5432);
  const [user, setUser] = useState(initialConfig?.user ?? "");
  const [password, setPassword] = useState(initialConfig?.password ?? "");
  const [database, setDatabase] = useState(initialConfig?.database ?? "");
  const [schema, setSchema] = useState(initialConfig?.schema ?? "");

  const [tables, setTables] = useState<DbTableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(
    new Set(initialSelectedTables ?? []),
  );
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when modal opens with initial config
  useEffect(() => {
    if (isOpen && initialConfig) {
      setDbms(initialConfig.dbms);
      setHost(initialConfig.host);
      setPort(initialConfig.port);
      setUser(initialConfig.user);
      setPassword(initialConfig.password);
      setDatabase(initialConfig.database);
      setSchema(initialConfig.schema);
      setSelectedTables(new Set(initialSelectedTables ?? []));
    }
  }, [isOpen, initialConfig, initialSelectedTables]);

  const handleDialectChange = (value: string) => {
    setDbms(value);
    const dialect = DIALECT_OPTIONS.find((d) => d.value === value);
    if (dialect) setPort(dialect.defaultPort);
    setConnected(false);
    setTables([]);
  };

  const handleTestConnection = async () => {
    setError(null);
    try {
      const config: DbConnectionConfig = { dbms, host, port, user, password, database, schema };
      const result = await onConnect(config);
      setTables(result.tables);
      setConnected(true);
      // Pre-select all tables
      setSelectedTables(new Set(result.tables.map((t) => t.name)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setConnected(false);
      setTables([]);
    }
  };

  const handleToggleTable = (name: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTables.size === tables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(tables.map((t) => t.name)));
    }
  };

  const handleConfirm = () => {
    const config: DbConnectionConfig = { dbms, host, port, user, password, database, schema };
    onConfirm(config, Array.from(selectedTables));
  };

  if (!isOpen) return null;

  const inputCls =
    "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:border-[#2DD4BF]/50 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-xl border border-[#232328] bg-[#151518] shadow-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#232328]">
            <div className="flex items-center gap-3">
              <Database size={20} className="text-[#2DD4BF]" />
              <h2 className="text-lg font-semibold text-[#F0EDE8]">Connect to Database</h2>
            </div>
            <button type="button" onClick={onClose} className="p-1 text-[#5A5650] hover:text-[#F0EDE8]">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Connection form */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#8A857D] mb-1">Database Type</label>
                <select className={inputCls} value={dbms} onChange={(e) => handleDialectChange(e.target.value)}>
                  {DIALECT_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8A857D] mb-1">Host / IP</label>
                <input className={inputCls} value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8A857D] mb-1">Port</label>
                <input className={inputCls} type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8A857D] mb-1">Username</label>
                <input className={inputCls} value={user} onChange={(e) => setUser(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8A857D] mb-1">Password</label>
                <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8A857D] mb-1">Database</label>
                <input className={inputCls} value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="parthenon" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8A857D] mb-1">Schema</label>
                <input className={inputCls} value={schema} onChange={(e) => setSchema(e.target.value)} placeholder="public" />
              </div>
            </div>

            {/* Test Connection */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={!host || !database || !schema || isConnecting}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF]/15 px-4 py-2 text-sm font-medium text-[#2DD4BF] hover:bg-[#2DD4BF]/25 disabled:opacity-40 transition-colors"
              >
                {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                Test Connection
              </button>
              {connected && (
                <span className="flex items-center gap-1 text-sm text-[#2DD4BF]">
                  <CheckCircle2 size={14} /> Connected — {tables.length} tables found
                </span>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-[#E85A6B]/10 border border-[#E85A6B]/30 px-3 py-2">
                <AlertTriangle size={14} className="text-[#E85A6B] mt-0.5 shrink-0" />
                <p className="text-sm text-[#E85A6B]">{error}</p>
              </div>
            )}

            {/* Table list */}
            {connected && tables.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#8A857D]">
                    Select Tables ({selectedTables.size} / {tables.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs text-[#2DD4BF] hover:text-[#2DD4BF]/80"
                  >
                    {selectedTables.size === tables.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-[#232328] divide-y divide-[#1E1E23]">
                  {tables.map((t) => (
                    <label
                      key={t.name}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-[#1C1C20] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTables.has(t.name)}
                        onChange={() => handleToggleTable(t.name)}
                        className="rounded border-[#323238] bg-[#0E0E11] text-[#2DD4BF] focus:ring-[#2DD4BF]/30"
                      />
                      <span className="text-sm text-[#F0EDE8] flex-1">{t.name}</span>
                      <span className="text-xs text-[#5A5650] font-mono">
                        {t.column_count} cols
                        {t.row_count != null && ` · ${t.row_count.toLocaleString()} rows`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#232328]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#323238] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedTables.size === 0}
              className="rounded-lg bg-[#9B1B30] px-4 py-2 text-sm font-medium text-[#F0EDE8] hover:bg-[#B82D42] disabled:opacity-40 transition-colors"
            >
              Confirm ({selectedTables.size} tables)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/ingestion/components/ConnectDatabaseModal.tsx
git commit -m "feat(ingestion): add ConnectDatabaseModal with dialect picker and table selection"
```

---

### Task 6: ConnectDatabaseColumn Component

**Files:**
- Create: `frontend/src/features/ingestion/components/ConnectDatabaseColumn.tsx`

- [ ] **Step 1: Write the column component**

```tsx
// frontend/src/features/ingestion/components/ConnectDatabaseColumn.tsx
import { useState } from "react";
import { Database, Pencil, Unplug, Loader2 } from "lucide-react";
import type { IngestionProject, DbConnectionConfig, DbTableInfo } from "../api/ingestionApi";
import { useConnectDatabase, useConfirmTables, useStageDatabase } from "../hooks/useIngestionProjects";
import ConnectDatabaseModal from "./ConnectDatabaseModal";

interface ConnectDatabaseColumnProps {
  project: IngestionProject;
}

export default function ConnectDatabaseColumn({ project }: ConnectDatabaseColumnProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const connectMutation = useConnectDatabase(project.id);
  const confirmMutation = useConfirmTables(project.id);
  const stageMutation = useStageDatabase(project.id);

  const hasConnection = !!project.db_connection_config;
  const hasSelectedTables = (project.selected_tables ?? []).length > 0;
  const config = project.db_connection_config ?? null;

  const handleConnect = async (cfg: DbConnectionConfig): Promise<{ tables: DbTableInfo[] }> => {
    const result = await connectMutation.mutateAsync(cfg);
    return { tables: result.tables };
  };

  const handleConfirm = (cfg: DbConnectionConfig, tables: string[]) => {
    confirmMutation.mutate(tables, {
      onSuccess: () => setModalOpen(false),
    });
  };

  const handleDisconnect = () => {
    confirmMutation.mutate([], {
      onSuccess: () => {
        // Clear connection — handled by backend on next project fetch
      },
    });
  };

  const handleStageDb = () => {
    stageMutation.mutate();
  };

  // Connected state
  if (hasConnection && hasSelectedTables) {
    const tables = project.selected_tables ?? [];
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-[#2DD4BF]">
          <Database size={14} />
          <span className="font-medium">
            {config?.dbms?.toUpperCase()} — {config?.host}/{config?.database} — {config?.schema}
          </span>
        </div>

        <div className="rounded-lg border border-[#232328] divide-y divide-[#1E1E23] max-h-48 overflow-y-auto">
          {tables.map((t) => (
            <div key={t} className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#C5C0B8]">
              <Database size={12} className="text-[#5A5650]" />
              {t}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#323238] px-3 py-1.5 text-xs text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
          >
            <Pencil size={12} /> Change
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#323238] px-3 py-1.5 text-xs text-[#8A857D] hover:text-[#E85A6B] transition-colors"
          >
            <Unplug size={12} /> Disconnect
          </button>
          <button
            type="button"
            onClick={handleStageDb}
            disabled={stageMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#9B1B30] px-4 py-1.5 text-xs font-medium text-[#F0EDE8] hover:bg-[#B82D42] disabled:opacity-40 transition-colors ml-auto"
          >
            {stageMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
            Profile & Stage
          </button>
        </div>

        {stageMutation.isError && (
          <p className="text-xs text-[#E85A6B]">
            {stageMutation.error instanceof Error ? stageMutation.error.message : "Staging failed"}
          </p>
        )}

        <ConnectDatabaseModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onConnect={handleConnect}
          onConfirm={handleConfirm}
          initialConfig={config}
          initialSelectedTables={project.selected_tables}
          isConnecting={connectMutation.isPending}
        />
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-14 h-14 rounded-full bg-[#2DD4BF]/10 flex items-center justify-center mb-4">
        <Database size={24} className="text-[#2DD4BF]" />
      </div>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="rounded-lg bg-[#2DD4BF]/15 px-5 py-2.5 text-sm font-medium text-[#2DD4BF] hover:bg-[#2DD4BF]/25 transition-colors"
      >
        Connect to Database
      </button>
      <p className="mt-2 text-xs text-[#5A5650]">Connect to any supported database to browse and select tables</p>

      <ConnectDatabaseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnect={handleConnect}
        onConfirm={handleConfirm}
        initialConfig={null}
        initialSelectedTables={null}
        isConnecting={connectMutation.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/ingestion/components/ConnectDatabaseColumn.tsx
git commit -m "feat(ingestion): add ConnectDatabaseColumn with connected/empty states"
```

---

### Task 7: Wire Into ProjectDetailView + Rename Tab

**Files:**
- Modify: `frontend/src/features/ingestion/pages/ProjectDetailView.tsx`
- Modify: `frontend/src/features/ingestion/pages/DataIngestionPage.tsx`

- [ ] **Step 1: Rename tab in DataIngestionPage.tsx**

Read the file. Change the TABS array entry:

```typescript
// Change:
{ id: "upload", label: "Upload Files" },
// To:
{ id: "upload", label: "Ingestion" },
```

- [ ] **Step 2: Split ProjectDetailView upload section into two columns**

Read `ProjectDetailView.tsx`. Find the "Upload Zone (collapsible)" section (the `<div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">` block starting around line 210).

Add the import at the top:
```typescript
import ConnectDatabaseColumn from "../components/ConnectDatabaseColumn";
```

Replace the entire upload zone `<div>` (from `{/* Upload Zone (collapsible) */}` through the closing `</div>` of that section) with a two-column layout:

```tsx
{/* Ingestion: Connect to Database + Upload Files */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  {/* Left column: Connect to Database */}
  <div className="rounded-lg border border-[#232328] bg-[#151518] p-5">
    <div className="flex items-center gap-2 mb-4">
      <h3 className="text-sm font-medium text-[#F0EDE8]">Connect to Database</h3>
    </div>
    <ConnectDatabaseColumn project={project} />
  </div>

  {/* Right column: Upload Files */}
  <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
    <button
      type="button"
      onClick={() => setUploadExpanded((v) => !v)}
      className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-[#1C1C20] transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#9B1B30]/15">
          <Plus size={16} className="text-[#9B1B30]" />
        </div>
        <div>
          <span className="text-sm font-medium text-[#F0EDE8]">
            {isDraft ? "Upload Source Files" : "Add More Files"}
          </span>
          <p className="text-xs text-[#8A857D]">
            Select CSV, TSV, or Excel files to stage into the project
          </p>
        </div>
      </div>
      {uploadExpanded ? (
        <ChevronUp size={16} className="text-[#8A857D]" />
      ) : (
        <ChevronDown size={16} className="text-[#8A857D]" />
      )}
    </button>

    {uploadExpanded && (
      <div className="px-5 pb-5 pt-1 border-t border-[#1C1C20] space-y-4">
        {selectedFiles.length === 0 ? (
          <MultiFileUploadZone onFilesSelect={handleFilesSelect} />
        ) : (
          <FileReviewList
            files={selectedFiles}
            tableNames={tableNames}
            onTableNameChange={handleTableNameChange}
            onRemove={handleRemoveFile}
            onStageAll={handleStageAll}
            isStaging={stageFilesMutation.isPending}
          />
        )}

        {stageFilesMutation.isError && (
          <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/10 px-4 py-2.5">
            <p className="text-sm text-[#E85A6B]">
              {stageFilesMutation.error instanceof Error
                ? stageFilesMutation.error.message
                : "Staging failed. Please try again."}
            </p>
          </div>
        )}
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 3: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 4: Deploy and verify**

```bash
./deploy.sh --php --frontend
```

Navigate to `/ingestion?tab=upload` — should now show "Ingestion" tab with two columns.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/ingestion/pages/ProjectDetailView.tsx frontend/src/features/ingestion/pages/DataIngestionPage.tsx
git commit -m "feat(ingestion): split page into Connect to Database + Upload Files columns, rename tab"
```

---

## Summary

| # | Task | Description |
|---|------|-------------|
| 1 | BlackRabbit /tables | Lightweight schema inspection endpoint |
| 2 | Migration + Model | Add db_connection_config + selected_tables to IngestionProject |
| 3 | Laravel Endpoints | connectDb, confirmTables, stageDb controller methods + routes |
| 4 | Frontend API + Hooks | TypeScript types, API functions, mutation hooks |
| 5 | ConnectDatabaseModal | Connection form, test, table picker, confirm/cancel |
| 6 | ConnectDatabaseColumn | Left column: empty state button + connected state display |
| 7 | Wire + Rename | Split ProjectDetailView into 2 columns, rename tab to "Ingestion" |

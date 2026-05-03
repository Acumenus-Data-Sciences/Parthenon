# Parthenon Ingestion Templates — Phase 0, Plan 3: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Aqueduct tab to host pre-baked templates alongside the existing visual canvas, behind the `ingestion.templates_enabled` feature flag. User can pick a template, fill a parameter form, submit, and watch a run progress to completion through a unified run inspector.

**Architecture:** Sub-tab strip inside `EtlToolsPage` (Mappings | Templates | Runs). Templates and Runs are lazy-loaded React components. TanStack Query hooks call into Plan 2's `/api/v1/ingestion/templates/*` endpoints. Polling stops on terminal status. Crimson `#9B1B30` accent throughout per project convention.

**Tech Stack:** React 19, TypeScript strict, Vite 7, TailwindCSS 4, TanStack Query, Zustand, `@rjsf/core` for JSON-Schema-driven forms, Vitest, Playwright. Existing components reused: `PipelineStepper`, `ConfidenceBadge`, `ValidationReport` from `features/ingestion/components/`.

**Depends on:** Plan 2 (Laravel Integration — endpoints must exist).

**Unblocks:** Plan 4 (Templates — needs UI to demo templates against).

---

## Conventions used in this plan

- **Locale source of truth:** Parthenon does NOT use JSON locale files. i18n strings live in TypeScript modules under `frontend/src/i18n/` (e.g. `etlAqueductResources.ts`). New keys for this plan are added to a new module `frontend/src/i18n/etlTemplatesResources.ts` registered in `frontend/src/i18n/resources.ts`. The plan references this file in the i18n task; ignore the prompt's mention of `app.json`/`es.json`.
- **API client:** All hooks use the existing `apiClient` axios instance from `frontend/src/lib/api-client.ts`. Auth token + locale headers are injected by interceptors there.
- **App settings hook:** A read-only `useAppSettings` hook is added in `frontend/src/features/etl/hooks/useAppSettings.ts`. Plan 2 owns the `templates_enabled` field on the `/app-settings` payload; Plan 3 only reads it. The super-admin toggle UI is wired into the existing `frontend/src/features/text-to-sql/pages/QueryAssistantPage.tsx`-style settings pattern by Plan 2 — Plan 3 does not own the toggle UI.
- **Component prop typing:** Per global memory, use `Pick<T, ...>` when only a subset of fields is needed.
- **Named exports only.** No default exports for components or hooks. (The existing `EtlToolsPage` uses `export default` because `DataIngestionPage.tsx` lazy-imports it via the default slot — that contract is preserved.)
- **Color tokens:** Use Tailwind CSS custom-property tokens already in the codebase (`text-success`, `bg-surface-raised`, `text-text-muted`, `border-border-default`, `bg-accent`, `text-critical`, `bg-warning/15`, etc.). The crimson accent `#9B1B30` is reachable via `text-critical` / `bg-critical/15` / `border-critical` on the dark theme — confirmed by grepping `frontend/src/index.css` and `tailwind.config.ts` before introducing new tokens.
- **Docker-only commands:** Every npm/vitest/tsc/vite/eslint invocation runs through `docker compose exec -T node`. Bare `npm`/`npx` outside Docker is forbidden by project rule.
- **No `console.log`** in production code (per global TS hooks rule).
- **No `any` type** anywhere. Use `unknown` and narrow.
- **TDD strictness:** failing test → run (verify fail) → implement → run (verify pass) → tsc → vite build → eslint → commit. One task = one commit.

---

## Task ordering rationale

The 17 tasks below are ordered so that:

1. Foundations land first (deps, types, API client) so later tasks can `import` them.
2. Pure components (`TemplateCard`, `ParameterForm`) come before composite ones (`RunInspector`, pages) because tests and tsc can validate them in isolation.
3. The `EtlToolsPage` sub-tab refactor happens AFTER both pages exist so its lazy imports resolve.
4. i18n keys are added in two sweeps — one stub task that creates the resource module shell early (Task 5), then a backfill task at the end (Task 15) that consolidates the final key tree once all UI is real. Each prior task adds the keys it actually uses.
5. Playwright E2E lands last because it needs the full frontend up.
6. The final task runs `./deploy.sh --frontend` to satisfy `feedback_always_deploy_sh.md`.

---

### Task 1: Add `@rjsf/*` dependencies to `package.json`

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/frontend/package.json`
- Modify: `/home/smudoshi/Github/Parthenon/frontend/package-lock.json` (auto)

- [ ] **Step 1: Pre-flight — check current React major**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && node -e \"console.log(require('./package.json').dependencies.react)\""`
Expected: prints `"^19.x.x"` or similar. Confirms we need an `@rjsf` version compatible with React 19.

- [ ] **Step 2: Install pinned versions**

Run:
```bash
cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npm install --legacy-peer-deps --save @rjsf/core@5.24.10 @rjsf/validator-ajv8@5.24.10 @rjsf/utils@5.24.10"
```
Expected: install succeeds; three new entries appear under `dependencies` in `package.json`. The `--legacy-peer-deps` flag is REQUIRED per project memory — react-joyride's peer-dep manifest is the historical reason but the rule is project-wide.

Pinning rationale: 5.24.x is the latest stable of `@rjsf/*` as of 2026-05-02 (the v6 line is alpha). All three packages must be the same minor for internal type compatibility.

- [ ] **Step 3: tsc**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors. (No imports added yet, so this only checks the lockfile didn't break anything.)

- [ ] **Step 4: vite build**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(templates): add @rjsf/{core,validator-ajv8,utils} 5.24.10 for parameter forms"
```

---

### Task 2: TypeScript types for templates

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/types/templates.ts`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/types-templates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/types-templates.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type {
  Template,
  TemplateManifest,
  TemplateRun,
  TemplateRunLog,
  TemplateRunArtifact,
  TemplateRunStatus,
} from "../types/templates";

describe("template types", () => {
  it("Template has required catalog fields", () => {
    const sample: Template = {
      id: "hello_cdm",
      name: "Hello CDM",
      version: "0.1.0",
      description: "Bootstrap empty CDM",
      category: "diagnostic",
      tags: ["bootstrap"],
      cdm_versions: ["5.4"],
      parameters_schema: { type: "object", properties: {} },
    };
    expectTypeOf(sample.id).toBeString();
    expectTypeOf(sample.tags).toEqualTypeOf<string[]>();
  });

  it("TemplateRun status is the discriminated union", () => {
    expectTypeOf<TemplateRunStatus>().toEqualTypeOf<
      "pending" | "queued" | "running" | "completed" | "failed" | "cancelled"
    >();
  });

  it("TemplateRun has all run-history columns", () => {
    const run: TemplateRun = {
      id: 1,
      template_id: "hello_cdm",
      template_version: "0.1.0",
      parameters: { target_schema: "synpuf" },
      status: "running",
      progress: 0.5,
      current_node: "load_synpuf_csv",
      prefect_run_id: "00000000-0000-0000-0000-000000000000",
      error_message: null,
      post_conditions: [],
      artifacts_path: "templates/1",
      submitted_by: 7,
      submitted_at: "2026-05-02T12:00:00Z",
      started_at: "2026-05-02T12:00:01Z",
      finished_at: null,
    };
    expectTypeOf(run.progress).toBeNumber();
  });

  it("TemplateManifest extends Template with nodes + post_conditions", () => {
    const manifest: TemplateManifest = {
      id: "hello_cdm",
      name: "Hello CDM",
      version: "0.1.0",
      description: "",
      category: "diagnostic",
      tags: [],
      cdm_versions: ["5.4"],
      parameters_schema: { type: "object", properties: {} },
      nodes: [
        { id: "n1", kind: "sql_node", inputs: [], outputs: ["t1"] },
      ],
      post_conditions: [
        { kind: "row_count", target: "person", op: ">=", value: 0 },
      ],
    };
    expectTypeOf(manifest.nodes).toBeArray();
  });

  it("TemplateRunLog and TemplateRunArtifact shapes", () => {
    const log: TemplateRunLog = {
      timestamp: "2026-05-02T12:00:00Z",
      node_id: "n1",
      level: "info",
      message: "starting",
    };
    const art: TemplateRunArtifact = {
      name: "person.csv",
      size_bytes: 4096,
      signed_url: "/storage/templates/1/person.csv?sig=abc",
      content_type: "text/csv",
    };
    expectTypeOf(log.level).toEqualTypeOf<"debug" | "info" | "warn" | "error">();
    expectTypeOf(art.size_bytes).toBeNumber();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/types-templates.test.ts"`
Expected: FAIL with `Cannot find module '../types/templates' or its corresponding type declarations.`

- [ ] **Step 3: Write minimal implementation**

```ts
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/types/templates.ts
/**
 * Frontend types matching Plan 2's `/api/v1/ingestion/templates/*` OpenAPI contract.
 *
 * NOTE: Once Plan 2 lands and `./deploy.sh --openapi` is run, the project's
 * `frontend/src/types/api.generated.ts` will contain the canonical shapes.
 * At that point this file should re-export those generated types instead of
 * declaring them. For Phase 0 we declare them manually.
 */

export type TemplateRunStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type TemplateCategory =
  | "bootstrap"
  | "diagnostic"
  | "vocabulary"
  | "demo_data"
  | "etl"
  | "validation";

export interface JsonSchemaObject {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface JsonSchemaProperty {
  type: "string" | "number" | "integer" | "boolean";
  title?: string;
  description?: string;
  default?: unknown;
  enum?: ReadonlyArray<string | number>;
  minimum?: number;
  maximum?: number;
  /** Custom Parthenon flag — when true, render as <input type="password">. */
  secret?: boolean;
}

export interface Template {
  id: string;
  name: string;
  version: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  cdm_versions: string[];
  parameters_schema: JsonSchemaObject;
}

export interface TemplateNode {
  id: string;
  kind: string;
  inputs: string[];
  outputs: string[];
}

export interface PostCondition {
  kind: "row_count" | "dqd_check" | "sql_assert";
  target: string;
  op?: ">=" | "<=" | "==" | ">" | "<";
  value?: number | string;
  status?: "passed" | "failed" | "skipped";
  detail?: string;
}

export interface TemplateManifest extends Template {
  nodes: TemplateNode[];
  post_conditions: PostCondition[];
}

export interface TemplateRun {
  id: number;
  template_id: string;
  template_version: string;
  parameters: Record<string, unknown>;
  status: TemplateRunStatus;
  progress: number;
  current_node: string | null;
  prefect_run_id: string | null;
  error_message: string | null;
  post_conditions: PostCondition[];
  artifacts_path: string | null;
  submitted_by: number;
  submitted_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface TemplateRunLog {
  timestamp: string;
  node_id: string | null;
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

export interface TemplateRunArtifact {
  name: string;
  size_bytes: number;
  signed_url: string;
  content_type: string;
}

export const TERMINAL_STATUSES: ReadonlySet<TemplateRunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

export function isTerminal(status: TemplateRunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/types-templates.test.ts"`
Expected: PASS, 5 tests.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/types/templates.ts src/features/etl/__tests__/types-templates.test.ts"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/types/templates.ts frontend/src/features/etl/__tests__/types-templates.test.ts
git commit -m "feat(templates): add TypeScript types for template catalog and runs"
```

---

### Task 3: TanStack Query hooks (`api/templates.ts`)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/api/templates.ts`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/api-templates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/api-templates.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/api-client", () => {
  const get = vi.fn();
  const post = vi.fn();
  const del = vi.fn();
  return {
    default: { get, post, delete: del },
    apiClient: { get, post, delete: del },
  };
});

import { apiClient } from "@/lib/api-client";
import {
  useTemplates,
  useTemplate,
  useTemplateRun,
  useTemplateRunLogs,
  useTemplateRunArtifacts,
  useSubmitTemplateRun,
  useCancelTemplateRun,
  templateRunRefetchInterval,
} from "../api/templates";
import type { TemplateRun } from "../types/templates";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedDel = vi.mocked(apiClient.delete);

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
  mockedDel.mockReset();
});

describe("useTemplates", () => {
  it("fetches catalog and unwraps data envelope", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: [{ id: "hello_cdm", name: "Hello CDM" }] },
    });
    const { result } = renderHook(() => useTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates");
    expect(result.current.data?.[0].id).toBe("hello_cdm");
  });
});

describe("useSubmitTemplateRun", () => {
  it("POSTs to the template runs endpoint", async () => {
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 42 } } });
    const { result } = renderHook(() => useSubmitTemplateRun(), { wrapper });
    await result.current.mutateAsync({
      templateId: "hello_cdm",
      version: "0.1.0",
      parameters: { target_schema: "demo" },
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/ingestion/templates/hello_cdm/runs",
      { version: "0.1.0", parameters: { target_schema: "demo" } },
    );
  });
});

describe("useCancelTemplateRun", () => {
  it("DELETEs the run", async () => {
    mockedDel.mockResolvedValueOnce({ data: { data: { ok: true } } });
    const { result } = renderHook(() => useCancelTemplateRun(7), { wrapper });
    await result.current.mutateAsync();
    expect(mockedDel).toHaveBeenCalledWith("/ingestion/templates/runs/7");
  });
});

describe("templateRunRefetchInterval", () => {
  it("returns 2000 while running", () => {
    const run: Partial<TemplateRun> = { status: "running" };
    expect(templateRunRefetchInterval(run as TemplateRun)).toBe(2000);
  });
  it("returns 2000 while queued", () => {
    const run: Partial<TemplateRun> = { status: "queued" };
    expect(templateRunRefetchInterval(run as TemplateRun)).toBe(2000);
  });
  it("returns false on completed", () => {
    const run: Partial<TemplateRun> = { status: "completed" };
    expect(templateRunRefetchInterval(run as TemplateRun)).toBe(false);
  });
  it("returns false on failed", () => {
    const run: Partial<TemplateRun> = { status: "failed" };
    expect(templateRunRefetchInterval(run as TemplateRun)).toBe(false);
  });
  it("returns false on cancelled", () => {
    const run: Partial<TemplateRun> = { status: "cancelled" };
    expect(templateRunRefetchInterval(run as TemplateRun)).toBe(false);
  });
  it("returns 2000 when undefined (initial fetch)", () => {
    expect(templateRunRefetchInterval(undefined)).toBe(2000);
  });
});

describe("useTemplate / useTemplateRun / logs / artifacts URL shape", () => {
  it("useTemplate hits /ingestion/templates/:id", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: { id: "hello_cdm", nodes: [], post_conditions: [] } },
    });
    const { result } = renderHook(() => useTemplate("hello_cdm"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates/hello_cdm");
  });
  it("useTemplateRun hits /ingestion/templates/runs/:id", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: { id: 7, status: "completed" } },
    });
    const { result } = renderHook(() => useTemplateRun(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates/runs/7");
  });
  it("useTemplateRunLogs hits /ingestion/templates/runs/:id/logs", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });
    const { result } = renderHook(() => useTemplateRunLogs(7, "completed"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates/runs/7/logs");
  });
  it("useTemplateRunArtifacts hits /ingestion/templates/runs/:id/artifacts", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });
    const { result } = renderHook(
      () => useTemplateRunArtifacts(7, "completed"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith(
      "/ingestion/templates/runs/7/artifacts",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/api-templates.test.ts"`
Expected: FAIL with `Failed to resolve import "../api/templates"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/api/templates.ts
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import {
  isTerminal,
  type Template,
  type TemplateManifest,
  type TemplateRun,
  type TemplateRunArtifact,
  type TemplateRunLog,
  type TemplateRunStatus,
} from "../types/templates";

interface ApiEnvelope<T> {
  data: T;
}

const BASE = "/ingestion/templates";

// ── Catalog ────────────────────────────────────────────────────────────────

export function useTemplates(): UseQueryResult<Template[]> {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Template[]>>(BASE);
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useTemplate(
  id: string | null,
): UseQueryResult<TemplateManifest> {
  return useQuery({
    queryKey: ["templates", id],
    enabled: id !== null,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TemplateManifest>>(
        `${BASE}/${id}`,
      );
      return data.data;
    },
  });
}

// ── Runs ───────────────────────────────────────────────────────────────────

export function templateRunRefetchInterval(
  run: TemplateRun | undefined,
): number | false {
  if (!run) return 2000;
  if (isTerminal(run.status)) return false;
  return 2000;
}

export interface SubmitTemplateRunInput {
  templateId: string;
  version: string;
  parameters: Record<string, unknown>;
}

export interface SubmitTemplateRunResponse {
  id: number;
}

export function useSubmitTemplateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: SubmitTemplateRunInput,
    ): Promise<SubmitTemplateRunResponse> => {
      const { data } = await apiClient.post<
        ApiEnvelope<SubmitTemplateRunResponse>
      >(`${BASE}/${input.templateId}/runs`, {
        version: input.version,
        parameters: input.parameters,
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["template-runs"] });
    },
  });
}

export function useTemplateRun(
  runId: number | null,
): UseQueryResult<TemplateRun> {
  return useQuery({
    queryKey: ["template-runs", runId],
    enabled: runId !== null,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TemplateRun>>(
        `${BASE}/runs/${runId}`,
      );
      return data.data;
    },
    refetchInterval: (q) => templateRunRefetchInterval(q.state.data),
  });
}

export function useTemplateRunLogs(
  runId: number | null,
  status: TemplateRunStatus | undefined,
): UseQueryResult<TemplateRunLog[]> {
  return useQuery({
    queryKey: ["template-runs", runId, "logs"],
    enabled: runId !== null,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TemplateRunLog[]>>(
        `${BASE}/runs/${runId}/logs`,
      );
      return data.data;
    },
    refetchInterval: status && !isTerminal(status) ? 2000 : false,
  });
}

export function useTemplateRunArtifacts(
  runId: number | null,
  status: TemplateRunStatus | undefined,
): UseQueryResult<TemplateRunArtifact[]> {
  return useQuery({
    queryKey: ["template-runs", runId, "artifacts"],
    enabled: runId !== null && status !== undefined && isTerminal(status),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TemplateRunArtifact[]>>(
        `${BASE}/runs/${runId}/artifacts`,
      );
      return data.data;
    },
  });
}

export function useCancelTemplateRun(runId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ ok: true }> => {
      const { data } = await apiClient.delete<ApiEnvelope<{ ok: true }>>(
        `${BASE}/runs/${runId}`,
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["template-runs", runId] });
      qc.invalidateQueries({ queryKey: ["template-runs"] });
    },
  });
}

// ── Run history ────────────────────────────────────────────────────────────

export interface TemplateRunHistoryParams {
  page: number;
  pageSize: number;
  statuses?: TemplateRunStatus[];
}

export interface TemplateRunHistoryResponse {
  data: TemplateRun[];
  meta: { total: number; page: number; per_page: number };
}

export function useTemplateRunHistory(
  params: TemplateRunHistoryParams,
): UseQueryResult<TemplateRunHistoryResponse> {
  return useQuery({
    queryKey: ["template-runs", "history", params],
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page));
      search.set("per_page", String(params.pageSize));
      if (params.statuses?.length) {
        for (const s of params.statuses) search.append("status[]", s);
      }
      const { data } = await apiClient.get<TemplateRunHistoryResponse>(
        `${BASE}/runs?${search.toString()}`,
      );
      return data;
    },
    refetchInterval: 5_000,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/api-templates.test.ts"`
Expected: PASS, 12 tests across 4 describe blocks.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/api/templates.ts src/features/etl/__tests__/api-templates.test.ts"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/api/templates.ts frontend/src/features/etl/__tests__/api-templates.test.ts
git commit -m "feat(templates): add TanStack Query hooks for catalog, manifest, runs, logs, artifacts"
```

---

### Task 4: `useAppSettings` hook (read-only)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/hooks/useAppSettings.ts`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/useAppSettings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/useAppSettings.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/api-client", () => {
  const get = vi.fn();
  return { default: { get }, apiClient: { get } };
});

import { apiClient } from "@/lib/api-client";
import { useAppSettings, useTemplatesEnabled } from "../hooks/useAppSettings";

const mockedGet = vi.mocked(apiClient.get);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => mockedGet.mockReset());

describe("useAppSettings", () => {
  it("fetches /app-settings and exposes the payload", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: {
          ingestion: { templates_enabled: true },
        },
      },
    });
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/app-settings");
    expect(result.current.data?.ingestion.templates_enabled).toBe(true);
  });
});

describe("useTemplatesEnabled", () => {
  it("returns false while loading", () => {
    mockedGet.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(() => useTemplatesEnabled(), { wrapper });
    expect(result.current).toBe(false);
  });

  it("returns true when ingestion.templates_enabled is true", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: { ingestion: { templates_enabled: true } } },
    });
    const { result } = renderHook(() => useTemplatesEnabled(), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("returns false when ingestion.templates_enabled is false", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: { ingestion: { templates_enabled: false } } },
    });
    const { result } = renderHook(() => useTemplatesEnabled(), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("returns false when ingestion key is missing entirely", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: {} } });
    const { result } = renderHook(() => useTemplatesEnabled(), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/useAppSettings.test.ts"`
Expected: FAIL with `Failed to resolve import "../hooks/useAppSettings"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/hooks/useAppSettings.ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

/**
 * App-level feature flags. Plan 2 owns the schema; Plan 3 only reads.
 * Other unrelated keys (e.g. text-to-sql dialect) coexist on the same payload.
 */
export interface AppSettingsPayload {
  ingestion: {
    templates_enabled: boolean;
  };
  // Other namespaces (e.g. text_to_sql) are intentionally not typed here —
  // they are owned by their respective features.
  [k: string]: unknown;
}

export function useAppSettings(): UseQueryResult<AppSettingsPayload> {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AppSettingsPayload }>(
        "/app-settings",
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useTemplatesEnabled(): boolean {
  const { data } = useAppSettings();
  return Boolean(data?.ingestion?.templates_enabled);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/useAppSettings.test.ts"`
Expected: PASS, 5 tests.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/hooks/useAppSettings.ts src/features/etl/__tests__/useAppSettings.test.ts"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/hooks/useAppSettings.ts frontend/src/features/etl/__tests__/useAppSettings.test.ts
git commit -m "feat(templates): add useAppSettings + useTemplatesEnabled feature-flag hook"
```

---

### Task 5: i18n resource module shell (`etlTemplatesResources.ts`)

This is the SHELL of the resource module. Each subsequent component task that needs a key will append to it. Task 15 audits the final tree.

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/i18n/etlTemplatesResources.ts`
- Modify: `/home/smudoshi/Github/Parthenon/frontend/src/i18n/resources.ts` (register module)
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/i18n/__tests__/etlTemplatesResources.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// /home/smudoshi/Github/Parthenon/frontend/src/i18n/__tests__/etlTemplatesResources.test.ts
import { describe, it, expect } from "vitest";
import { etlTemplatesEn } from "../etlTemplatesResources";

describe("etlTemplatesResources", () => {
  it("declares the aqueduct.subtabs leaf keys", () => {
    expect(etlTemplatesEn.aqueduct.subtabs.mappings).toBe("Mappings");
    expect(etlTemplatesEn.aqueduct.subtabs.templates).toBe("Templates");
    expect(etlTemplatesEn.aqueduct.subtabs.runs).toBe("Runs");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/i18n/__tests__/etlTemplatesResources.test.ts"`
Expected: FAIL with `Failed to resolve import "../etlTemplatesResources"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// /home/smudoshi/Github/Parthenon/frontend/src/i18n/etlTemplatesResources.ts
type MessageTree = { [k: string]: string | MessageTree };

export const etlTemplatesEn: MessageTree = {
  aqueduct: {
    subtabs: {
      mappings: "Mappings",
      templates: "Templates",
      runs: "Runs",
    },
  },
};

// Spanish translations are supplied by the localization team in a follow-up;
// for Phase 0 we ship English only and i18next falls through to the en tree.
export const etlTemplatesEs: MessageTree = {};
```

- [ ] **Step 4: Register module in `resources.ts`**

First, locate the registration point. Run:
`cd /home/smudoshi/Github/Parthenon && grep -n "etlAqueductResources" frontend/src/i18n/resources.ts`

Append the import + merge in the same style as the existing modules. Concretely:

Edit `/home/smudoshi/Github/Parthenon/frontend/src/i18n/resources.ts`:

- Add at the top (next to other module imports):
  ```ts
  import { etlTemplatesEn, etlTemplatesEs } from "./etlTemplatesResources";
  ```
- In the `app` namespace `en` merge list, add `etlTemplatesEn` alongside `etlAqueductEn` (or whatever the existing pattern is — merge the two trees with the existing helper).
- Mirror for `es`.

(If `resources.ts` does not aggregate via merge but instead via spread, follow the spread pattern. Read the file first; do not invent.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/i18n/__tests__/etlTemplatesResources.test.ts"`
Expected: PASS, 1 test.

- [ ] **Step 6: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 7: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/i18n/etlTemplatesResources.ts src/i18n/resources.ts src/i18n/__tests__/etlTemplatesResources.test.ts"`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/i18n/etlTemplatesResources.ts frontend/src/i18n/resources.ts frontend/src/i18n/__tests__/etlTemplatesResources.test.ts
git commit -m "feat(templates): scaffold etlTemplatesResources i18n module with subtab labels"
```

---

### Task 6: `TemplateCard` component

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/TemplateCard.tsx`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/TemplateCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/TemplateCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplateCard } from "../components/aqueduct/templates/TemplateCard";

const sample = {
  id: "hello_cdm",
  name: "Hello CDM",
  description: "Bootstrap an empty OMOP CDM v5.4 schema",
  category: "bootstrap" as const,
  tags: ["foundation", "smoke"],
  cdm_versions: ["5.3", "5.4"],
};

describe("TemplateCard", () => {
  it("renders name, description, tags, and CDM pills", () => {
    render(<TemplateCard {...sample} onSelect={vi.fn()} />);
    expect(screen.getByText("Hello CDM")).toBeInTheDocument();
    expect(
      screen.getByText("Bootstrap an empty OMOP CDM v5.4 schema"),
    ).toBeInTheDocument();
    expect(screen.getByText("foundation")).toBeInTheDocument();
    expect(screen.getByText("smoke")).toBeInTheDocument();
    expect(screen.getByText("CDM 5.3")).toBeInTheDocument();
    expect(screen.getByText("CDM 5.4")).toBeInTheDocument();
  });

  it("invokes onSelect with the template id when clicked", () => {
    const onSelect = vi.fn();
    render(<TemplateCard {...sample} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Hello CDM/ }));
    expect(onSelect).toHaveBeenCalledWith("hello_cdm");
  });

  it("is keyboard-activatable (Enter)", () => {
    const onSelect = vi.fn();
    render(<TemplateCard {...sample} onSelect={onSelect} />);
    const btn = screen.getByRole("button", { name: /Hello CDM/ });
    btn.focus();
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("hello_cdm");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/TemplateCard.test.tsx"`
Expected: FAIL with `Failed to resolve import "../components/aqueduct/templates/TemplateCard"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/TemplateCard.tsx
import { cn } from "@/lib/utils";
import type { Template } from "../../../types/templates";

export type TemplateCardProps = Pick<
  Template,
  "id" | "name" | "description" | "category" | "tags" | "cdm_versions"
> & {
  onSelect: (id: string) => void;
};

export function TemplateCard(props: TemplateCardProps) {
  const { id, name, description, category, tags, cdm_versions, onSelect } =
    props;

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(id);
        }
      }}
      className={cn(
        "group relative flex w-full flex-col items-start gap-3 rounded-xl border border-border-default bg-surface-raised p-5 text-left transition",
        "hover:border-critical hover:shadow-lg hover:shadow-critical/10",
        "focus:outline-none focus-visible:border-critical focus-visible:ring-2 focus-visible:ring-critical/40",
      )}
      aria-label={name}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-text-primary truncate">
            {name}
          </h3>
          <p className="mt-1 text-sm text-text-muted line-clamp-2">
            {description}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-surface-overlay px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-ghost">
          {category}
        </span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-surface-overlay px-2 py-0.5 text-xs text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {cdm_versions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cdm_versions.map((v) => (
            <span
              key={v}
              className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success"
            >
              CDM {v}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/TemplateCard.test.tsx"`
Expected: PASS, 3 tests.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/components/aqueduct/templates/TemplateCard.tsx src/features/etl/__tests__/TemplateCard.test.tsx"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/components/aqueduct/templates/TemplateCard.tsx frontend/src/features/etl/__tests__/TemplateCard.test.tsx
git commit -m "feat(templates): add TemplateCard catalog tile with crimson accent"
```

---

### Task 7: `ParameterForm` component (rjsf)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/ParameterForm.tsx`
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/PasswordWidget.tsx`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/ParameterForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/ParameterForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParameterForm } from "../components/aqueduct/templates/ParameterForm";
import type { TemplateManifest } from "../types/templates";

function makeManifest(
  schema: TemplateManifest["parameters_schema"],
): TemplateManifest {
  return {
    id: "x",
    name: "X",
    version: "0.1.0",
    description: "",
    category: "etl",
    tags: [],
    cdm_versions: ["5.4"],
    parameters_schema: schema,
    nodes: [],
    post_conditions: [],
  };
}

describe("ParameterForm", () => {
  it("renders a string field", () => {
    const m = makeManifest({
      type: "object",
      properties: {
        target_schema: { type: "string", title: "Target schema" },
      },
      required: ["target_schema"],
    });
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByLabelText(/Target schema/)).toBeInTheDocument();
  });

  it("renders a number field", () => {
    const m = makeManifest({
      type: "object",
      properties: { batch_size: { type: "number", title: "Batch size" } },
    });
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    const el = screen.getByLabelText(/Batch size/) as HTMLInputElement;
    expect(el.type).toBe("number");
  });

  it("renders an enum as a select", () => {
    const m = makeManifest({
      type: "object",
      properties: {
        patient_count: {
          type: "string",
          title: "Patient count",
          enum: ["1k", "100k"],
        },
      },
    });
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByLabelText(/Patient count/)).toHaveProperty(
      "tagName",
      "SELECT",
    );
  });

  it("renders a secret string as a password input", () => {
    const m = makeManifest({
      type: "object",
      properties: {
        api_token: {
          type: "string",
          title: "API token",
          secret: true,
        },
      },
    });
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    const el = screen.getByLabelText(/API token/) as HTMLInputElement;
    expect(el.type).toBe("password");
  });

  it("renders a boolean as a checkbox", () => {
    const m = makeManifest({
      type: "object",
      properties: {
        dry_run: { type: "boolean", title: "Dry run" },
      },
    });
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    const el = screen.getByLabelText(/Dry run/) as HTMLInputElement;
    expect(el.type).toBe("checkbox");
  });

  it("blocks submit when a required field is empty (client-side ajv8)", () => {
    const m = makeManifest({
      type: "object",
      properties: { target_schema: { type: "string", title: "Target schema" } },
      required: ["target_schema"],
    });
    const onSubmit = vi.fn();
    render(
      <ParameterForm manifest={m} onSubmit={onSubmit} onCancel={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Run/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables submit while pending", () => {
    const m = makeManifest({
      type: "object",
      properties: { target_schema: { type: "string", title: "Target schema" } },
    });
    render(
      <ParameterForm
        manifest={m}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        pending
      />,
    );
    const btn = screen.getByRole("button", { name: /Running/i });
    expect(btn).toBeDisabled();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const m = makeManifest({
      type: "object",
      properties: { target_schema: { type: "string" } },
    });
    const onCancel = vi.fn();
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/ParameterForm.test.tsx"`
Expected: FAIL with `Failed to resolve import "../components/aqueduct/templates/ParameterForm"`.

- [ ] **Step 3: Write minimal implementation — `PasswordWidget`**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/PasswordWidget.tsx
import type { WidgetProps } from "@rjsf/utils";

export function PasswordWidget(props: WidgetProps) {
  const { id, value, required, disabled, readonly, onChange, label } = props;
  return (
    <input
      id={id}
      type="password"
      aria-label={label}
      value={typeof value === "string" ? value : ""}
      required={required}
      disabled={disabled || readonly}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success"
    />
  );
}
```

- [ ] **Step 4: Write minimal implementation — `ParameterForm`**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/ParameterForm.tsx
import { useMemo } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import { useTranslation } from "react-i18next";
import type {
  JsonSchemaProperty,
  TemplateManifest,
} from "../../../types/templates";
import { PasswordWidget } from "./PasswordWidget";

export interface ParameterFormProps {
  manifest: TemplateManifest;
  onSubmit: (params: Record<string, unknown>) => void;
  onCancel: () => void;
  pending?: boolean;
}

function buildUiSchema(
  schema: TemplateManifest["parameters_schema"],
): UiSchema {
  const ui: UiSchema = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    const p = prop as JsonSchemaProperty;
    if (p.secret === true) {
      ui[key] = { "ui:widget": "password" };
    }
  }
  return ui;
}

export function ParameterForm(props: ParameterFormProps) {
  const { manifest, onSubmit, onCancel, pending = false } = props;
  const { t } = useTranslation("app");

  const uiSchema = useMemo(
    () => buildUiSchema(manifest.parameters_schema),
    [manifest.parameters_schema],
  );

  const widgets = useMemo(() => ({ password: PasswordWidget }), []);

  return (
    <Form
      schema={manifest.parameters_schema as RJSFSchema}
      uiSchema={uiSchema}
      validator={validator}
      widgets={widgets}
      disabled={pending}
      showErrorList={false}
      onSubmit={(e) => onSubmit(e.formData ?? {})}
      className="space-y-4"
    >
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-default">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay disabled:opacity-50"
        >
          {t("aqueduct.parameterForm.cancel", { defaultValue: "Cancel" })}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-success px-5 py-2 text-sm font-medium text-surface-base hover:bg-success-dark disabled:opacity-50"
        >
          {pending
            ? t("aqueduct.parameterForm.running", {
                defaultValue: "Running...",
              })
            : t("aqueduct.parameterForm.run", { defaultValue: "Run" })}
        </button>
      </div>
    </Form>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/ParameterForm.test.tsx"`
Expected: PASS, 8 tests.

- [ ] **Step 6: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 7: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/components/aqueduct/templates/ParameterForm.tsx src/features/etl/components/aqueduct/templates/PasswordWidget.tsx src/features/etl/__tests__/ParameterForm.test.tsx"`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/components/aqueduct/templates/ParameterForm.tsx frontend/src/features/etl/components/aqueduct/templates/PasswordWidget.tsx frontend/src/features/etl/__tests__/ParameterForm.test.tsx
git commit -m "feat(templates): add ParameterForm with rjsf + password widget for secrets"
```

---

### Task 8: `RunStatusBadge` component (split from RunInspector for testability)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/RunStatusBadge.tsx`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/RunStatusBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/RunStatusBadge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunStatusBadge } from "../components/aqueduct/templates/RunStatusBadge";
import type { TemplateRunStatus } from "../types/templates";

const cases: Array<{ status: TemplateRunStatus; expectClass: string }> = [
  { status: "pending", expectClass: "text-text-muted" },
  { status: "queued", expectClass: "text-info" },
  { status: "running", expectClass: "text-warning" },
  { status: "completed", expectClass: "text-success" },
  { status: "failed", expectClass: "text-critical" },
  { status: "cancelled", expectClass: "text-text-ghost" },
];

describe("RunStatusBadge", () => {
  for (const { status, expectClass } of cases) {
    it(`renders ${status} with the expected color class`, () => {
      render(<RunStatusBadge status={status} />);
      const el = screen.getByTestId(`run-status-${status}`);
      expect(el.className).toContain(expectClass);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/RunStatusBadge.test.tsx"`
Expected: FAIL with `Failed to resolve import "../components/aqueduct/templates/RunStatusBadge"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/RunStatusBadge.tsx
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { TemplateRunStatus } from "../../../types/templates";

const STYLE: Record<TemplateRunStatus, { bg: string; text: string }> = {
  pending: { bg: "bg-surface-overlay", text: "text-text-muted" },
  queued: { bg: "bg-info/15", text: "text-info" },
  running: { bg: "bg-warning/15", text: "text-warning" },
  completed: { bg: "bg-success/15", text: "text-success" },
  failed: { bg: "bg-critical/15", text: "text-critical" },
  cancelled: { bg: "bg-surface-overlay", text: "text-text-ghost" },
};

export function RunStatusBadge({ status }: { status: TemplateRunStatus }) {
  const { t } = useTranslation("app");
  const s = STYLE[status];
  return (
    <span
      data-testid={`run-status-${status}`}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        s.bg,
        s.text,
      )}
    >
      {t(`aqueduct.status.${status}`, { defaultValue: status })}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/RunStatusBadge.test.tsx"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/components/aqueduct/templates/RunStatusBadge.tsx src/features/etl/__tests__/RunStatusBadge.test.tsx"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/components/aqueduct/templates/RunStatusBadge.tsx frontend/src/features/etl/__tests__/RunStatusBadge.test.tsx
git commit -m "feat(templates): add RunStatusBadge color-coded by terminal/non-terminal state"
```

---

### Task 9: `RunLogsView` component (with auto-scroll)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/RunLogsView.tsx`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/RunLogsView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/RunLogsView.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunLogsView } from "../components/aqueduct/templates/RunLogsView";
import type { TemplateRunLog } from "../types/templates";

describe("RunLogsView", () => {
  it("renders a monospace pre with one line per log entry", () => {
    const logs: TemplateRunLog[] = [
      { timestamp: "2026-05-02T12:00:00Z", node_id: "n1", level: "info", message: "starting" },
      { timestamp: "2026-05-02T12:00:01Z", node_id: "n1", level: "warn", message: "slow query" },
    ];
    render(<RunLogsView logs={logs} isRunning={false} />);
    const pre = screen.getByTestId("run-logs-pre");
    expect(pre.tagName).toBe("PRE");
    expect(pre.textContent).toContain("starting");
    expect(pre.textContent).toContain("slow query");
  });

  it("shows an empty state when there are no logs", () => {
    render(<RunLogsView logs={[]} isRunning={false} />);
    expect(screen.getByText(/No logs yet/i)).toBeInTheDocument();
  });

  it("calls scrollIntoView on the bottom anchor while running", () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const logs: TemplateRunLog[] = [
      { timestamp: "t", node_id: null, level: "info", message: "hi" },
    ];
    render(<RunLogsView logs={logs} isRunning={true} />);
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("does NOT auto-scroll when terminal", () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const logs: TemplateRunLog[] = [
      { timestamp: "t", node_id: null, level: "info", message: "hi" },
    ];
    render(<RunLogsView logs={logs} isRunning={false} />);
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/RunLogsView.test.tsx"`
Expected: FAIL with `Failed to resolve import "../components/aqueduct/templates/RunLogsView"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/RunLogsView.tsx
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { TemplateRunLog } from "../../../types/templates";

const LEVEL_COLOR: Record<TemplateRunLog["level"], string> = {
  debug: "text-text-ghost",
  info: "text-text-secondary",
  warn: "text-warning",
  error: "text-critical",
};

export interface RunLogsViewProps {
  logs: TemplateRunLog[];
  isRunning: boolean;
}

export function RunLogsView({ logs, isRunning }: RunLogsViewProps) {
  const { t } = useTranslation("app");
  const anchor = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isRunning && anchor.current) {
      anchor.current.scrollIntoView({ block: "end" });
    }
  }, [logs, isRunning]);

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised p-6 text-center text-sm text-text-muted">
        {t("aqueduct.runInspector.noLogs", { defaultValue: "No logs yet" })}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-base">
      <pre
        data-testid="run-logs-pre"
        className="max-h-96 overflow-auto p-4 text-xs leading-relaxed font-['IBM_Plex_Mono',monospace]"
      >
        {logs.map((line, idx) => (
          <div key={idx} className={cn(LEVEL_COLOR[line.level])}>
            <span className="text-text-ghost">{line.timestamp}</span>
            {line.node_id ? (
              <span className="text-text-muted"> [{line.node_id}]</span>
            ) : null}
            <span className="uppercase"> {line.level}</span>
            <span> {line.message}</span>
          </div>
        ))}
        <div ref={anchor} />
      </pre>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/RunLogsView.test.tsx"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/components/aqueduct/templates/RunLogsView.tsx src/features/etl/__tests__/RunLogsView.test.tsx"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/components/aqueduct/templates/RunLogsView.tsx frontend/src/features/etl/__tests__/RunLogsView.test.tsx
git commit -m "feat(templates): add RunLogsView with monospace pre and auto-scroll while running"
```

---

### Task 10: `RunArtifactsView` component

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/RunArtifactsView.tsx`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/RunArtifactsView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/RunArtifactsView.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunArtifactsView } from "../components/aqueduct/templates/RunArtifactsView";
import type { TemplateRunArtifact } from "../types/templates";

describe("RunArtifactsView", () => {
  it("renders one download link per artifact with size and content type", () => {
    const arts: TemplateRunArtifact[] = [
      {
        name: "person.csv",
        size_bytes: 4096,
        signed_url: "/storage/templates/1/person.csv?sig=abc",
        content_type: "text/csv",
      },
      {
        name: "validation_report.json",
        size_bytes: 2048,
        signed_url: "/storage/templates/1/validation.json?sig=xyz",
        content_type: "application/json",
      },
    ];
    render(<RunArtifactsView artifacts={arts} />);
    const personLink = screen.getByRole("link", { name: /person\.csv/ });
    expect(personLink).toHaveAttribute(
      "href",
      "/storage/templates/1/person.csv?sig=abc",
    );
    expect(personLink).toHaveAttribute("download");
    expect(screen.getByText(/4 KB/)).toBeInTheDocument();
    expect(screen.getByText(/text\/csv/)).toBeInTheDocument();
  });

  it("renders the empty state when there are no artifacts", () => {
    render(<RunArtifactsView artifacts={[]} />);
    expect(screen.getByText(/No artifacts/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/RunArtifactsView.test.tsx"`
Expected: FAIL with `Failed to resolve import "../components/aqueduct/templates/RunArtifactsView"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/RunArtifactsView.tsx
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TemplateRunArtifact } from "../../../types/templates";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function RunArtifactsView({
  artifacts,
}: {
  artifacts: TemplateRunArtifact[];
}) {
  const { t } = useTranslation("app");
  if (artifacts.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised p-6 text-center text-sm text-text-muted">
        {t("aqueduct.runInspector.noArtifacts", {
          defaultValue: "No artifacts produced by this run.",
        })}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border-default rounded-lg border border-border-default bg-surface-raised">
      {artifacts.map((a) => (
        <li
          key={a.name}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <a
              href={a.signed_url}
              download={a.name}
              className="flex items-center gap-2 text-sm font-medium text-text-primary hover:text-success"
            >
              <Download size={14} className="text-success" />
              <span className="truncate">{a.name}</span>
            </a>
            <p className="mt-0.5 text-xs text-text-ghost">{a.content_type}</p>
          </div>
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
            {formatBytes(a.size_bytes)}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/RunArtifactsView.test.tsx"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/components/aqueduct/templates/RunArtifactsView.tsx src/features/etl/__tests__/RunArtifactsView.test.tsx"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/components/aqueduct/templates/RunArtifactsView.tsx frontend/src/features/etl/__tests__/RunArtifactsView.test.tsx
git commit -m "feat(templates): add RunArtifactsView with download links and human-readable sizes"
```

---

### Task 11: `RunDagView` component (reuses `PipelineStepper` styling pattern)

The existing `PipelineStepper` is hard-coded to the 6 ingestion steps. Rather than mutate it, we build a sibling generic stepper for arbitrary template DAG nodes — same visual language, different data shape. Tests document the contract.

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/RunDagView.tsx`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/RunDagView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/RunDagView.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunDagView } from "../components/aqueduct/templates/RunDagView";
import type { TemplateNode, TemplateRunStatus } from "../types/templates";

const NODES: TemplateNode[] = [
  { id: "fetch", kind: "generic_file", inputs: [], outputs: ["raw"] },
  { id: "load", kind: "db_writer", inputs: ["raw"], outputs: ["loaded"] },
  { id: "summarize", kind: "sql_node", inputs: ["loaded"], outputs: [] },
];

function variant(status: TemplateRunStatus, current: string | null) {
  return { status, current };
}

describe("RunDagView", () => {
  it("renders one circle per node with the node id label", () => {
    render(
      <RunDagView nodes={NODES} currentNode="load" status="running" />,
    );
    expect(screen.getByText("fetch")).toBeInTheDocument();
    expect(screen.getByText("load")).toBeInTheDocument();
    expect(screen.getByText("summarize")).toBeInTheDocument();
  });

  it("marks nodes before currentNode as completed (success styling)", () => {
    const { container } = render(
      <RunDagView nodes={NODES} currentNode="load" status="running" />,
    );
    const completed = container.querySelector(
      '[data-state="completed"][data-node="fetch"]',
    );
    expect(completed).not.toBeNull();
  });

  it("marks the current node as active when running", () => {
    const { container } = render(
      <RunDagView nodes={NODES} currentNode="load" status="running" />,
    );
    expect(
      container.querySelector('[data-state="active"][data-node="load"]'),
    ).not.toBeNull();
  });

  it("marks the current node as failed when status=failed", () => {
    const { container } = render(
      <RunDagView nodes={NODES} currentNode="load" status="failed" />,
    );
    expect(
      container.querySelector('[data-state="failed"][data-node="load"]'),
    ).not.toBeNull();
  });

  it("marks all nodes completed when status=completed and no currentNode", () => {
    const { container } = render(
      <RunDagView nodes={NODES} currentNode={null} status="completed" />,
    );
    for (const n of NODES) {
      expect(
        container.querySelector(
          `[data-state="completed"][data-node="${n.id}"]`,
        ),
      ).not.toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/RunDagView.test.tsx"`
Expected: FAIL with `Failed to resolve import "../components/aqueduct/templates/RunDagView"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/RunDagView.tsx
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TemplateNode,
  TemplateRunStatus,
} from "../../../types/templates";

type StepState = "completed" | "active" | "pending" | "failed";

export interface RunDagViewProps {
  nodes: TemplateNode[];
  currentNode: string | null;
  status: TemplateRunStatus;
}

function stateOf(
  index: number,
  currentIndex: number,
  status: TemplateRunStatus,
): StepState {
  if (status === "completed") return "completed";
  if (status === "failed" && index === currentIndex) return "failed";
  if (currentIndex === -1) return "pending";
  if (index < currentIndex) return "completed";
  if (index === currentIndex) return "active";
  return "pending";
}

export function RunDagView({ nodes, currentNode, status }: RunDagViewProps) {
  const currentIndex =
    currentNode !== null ? nodes.findIndex((n) => n.id === currentNode) : -1;

  return (
    <div className="flex items-center justify-between w-full px-4 py-6">
      {nodes.map((node, index) => {
        const state = stateOf(index, currentIndex, status);
        const isLast = index === nodes.length - 1;
        return (
          <div
            key={node.id}
            className="flex items-center flex-1 last:flex-none"
          >
            <div className="flex flex-col items-center gap-2">
              <div
                data-node={node.id}
                data-state={state}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all shrink-0",
                  state === "completed" && "bg-success text-surface-base",
                  state === "active" &&
                    "bg-primary text-primary-foreground animate-pulse",
                  state === "pending" &&
                    "border-2 border-surface-highlight text-text-ghost bg-transparent",
                  state === "failed" && "bg-critical text-white",
                )}
              >
                {state === "completed" ? (
                  <Check size={16} strokeWidth={3} />
                ) : state === "failed" ? (
                  <X size={16} strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  state === "completed" && "text-success",
                  state === "active" && "text-text-primary",
                  state === "pending" && "text-text-ghost",
                  state === "failed" && "text-critical",
                )}
              >
                {node.id}
              </span>
              <span className="text-[10px] text-text-ghost">{node.kind}</span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-3 mt-[-1.75rem]">
                <div
                  className={cn(
                    "h-[2px] w-full rounded-full",
                    index < currentIndex || status === "completed"
                      ? "bg-success"
                      : "bg-surface-highlight",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/RunDagView.test.tsx"`
Expected: PASS, 5 tests.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/components/aqueduct/templates/RunDagView.tsx src/features/etl/__tests__/RunDagView.test.tsx"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/components/aqueduct/templates/RunDagView.tsx frontend/src/features/etl/__tests__/RunDagView.test.tsx
git commit -m "feat(templates): add RunDagView generic stepper modeled on PipelineStepper styling"
```

---

### Task 12: `RunInspector` (composes the three views, polling, cancel/retry)

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/RunInspector.tsx`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/RunInspector.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/RunInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/api-client", () => {
  const get = vi.fn();
  const post = vi.fn();
  const del = vi.fn();
  return {
    default: { get, post, delete: del },
    apiClient: { get, post, delete: del },
  };
});

import { apiClient } from "@/lib/api-client";
import { RunInspector } from "../components/aqueduct/templates/RunInspector";

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedDel = vi.mocked(apiClient.delete);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
  mockedDel.mockReset();
});

const RUN_RUNNING = {
  id: 7,
  template_id: "hello_cdm",
  template_version: "0.1.0",
  parameters: {},
  status: "running" as const,
  progress: 0.5,
  current_node: "load",
  prefect_run_id: "00000000-0000-0000-0000-000000000000",
  error_message: null,
  post_conditions: [],
  artifacts_path: null,
  submitted_by: 1,
  submitted_at: "2026-05-02T12:00:00Z",
  started_at: "2026-05-02T12:00:01Z",
  finished_at: null,
};

const RUN_FAILED = { ...RUN_RUNNING, status: "failed" as const };

const MANIFEST = {
  id: "hello_cdm",
  name: "Hello CDM",
  version: "0.1.0",
  description: "",
  category: "bootstrap",
  tags: [],
  cdm_versions: ["5.4"],
  parameters_schema: { type: "object", properties: {} },
  nodes: [
    { id: "fetch", kind: "generic_file", inputs: [], outputs: [] },
    { id: "load", kind: "db_writer", inputs: [], outputs: [] },
  ],
  post_conditions: [],
};

describe("RunInspector", () => {
  it("shows the cancel button while running, hides on terminal", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates/runs/7")
        return Promise.resolve({ data: { data: RUN_RUNNING } });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: { data: MANIFEST } });
      if (url === "/ingestion/templates/runs/7/logs")
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    render(<RunInspector runId={7} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Cancel run/i })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /Retry/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the retry button when failed", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates/runs/7")
        return Promise.resolve({ data: { data: RUN_FAILED } });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: { data: MANIFEST } });
      if (url === "/ingestion/templates/runs/7/logs")
        return Promise.resolve({ data: { data: [] } });
      if (url === "/ingestion/templates/runs/7/artifacts")
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    render(<RunInspector runId={7} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /Cancel run/i }),
    ).not.toBeInTheDocument();
  });

  it("DELETEs the run when cancel is clicked", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates/runs/7")
        return Promise.resolve({ data: { data: RUN_RUNNING } });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: { data: MANIFEST } });
      if (url === "/ingestion/templates/runs/7/logs")
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    mockedDel.mockResolvedValueOnce({ data: { data: { ok: true } } });

    render(<RunInspector runId={7} />, { wrapper });
    const btn = await screen.findByRole("button", { name: /Cancel run/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(mockedDel).toHaveBeenCalledWith("/ingestion/templates/runs/7"),
    );
  });

  it("POSTs a new run with same params when retry is clicked", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates/runs/7")
        return Promise.resolve({
          data: { data: { ...RUN_FAILED, parameters: { foo: "bar" } } },
        });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: { data: MANIFEST } });
      if (url === "/ingestion/templates/runs/7/logs")
        return Promise.resolve({ data: { data: [] } });
      if (url === "/ingestion/templates/runs/7/artifacts")
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 8 } } });

    render(<RunInspector runId={7} />, { wrapper });
    const btn = await screen.findByRole("button", { name: /Retry/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        "/ingestion/templates/hello_cdm/runs",
        { version: "0.1.0", parameters: { foo: "bar" } },
      ),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/RunInspector.test.tsx"`
Expected: FAIL with `Failed to resolve import "../components/aqueduct/templates/RunInspector"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/aqueduct/templates/RunInspector.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronDown, ChevronRight, X, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTemplate,
  useTemplateRun,
  useTemplateRunLogs,
  useTemplateRunArtifacts,
  useCancelTemplateRun,
  useSubmitTemplateRun,
} from "../../../api/templates";
import { isTerminal } from "../../../types/templates";
import { RunStatusBadge } from "./RunStatusBadge";
import { RunLogsView } from "./RunLogsView";
import { RunArtifactsView } from "./RunArtifactsView";
import { RunDagView } from "./RunDagView";

export interface RunInspectorProps {
  runId: number;
  onRetried?: (newRunId: number) => void;
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-default bg-surface-raised">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-text-primary"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open && <div className="border-t border-border-default p-4">{children}</div>}
    </section>
  );
}

export function RunInspector({ runId, onRetried }: RunInspectorProps) {
  const { t } = useTranslation("app");
  const runQ = useTemplateRun(runId);
  const manifestQ = useTemplate(runQ.data?.template_id ?? null);
  const logsQ = useTemplateRunLogs(runId, runQ.data?.status);
  const artifactsQ = useTemplateRunArtifacts(runId, runQ.data?.status);
  const cancelMut = useCancelTemplateRun(runId);
  const submitMut = useSubmitTemplateRun();

  const [openDag, setOpenDag] = useState(true);
  const [openLogs, setOpenLogs] = useState(true);
  const [openArtifacts, setOpenArtifacts] = useState(false);

  if (runQ.isLoading || !runQ.data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const run = runQ.data;
  const terminal = isTerminal(run.status);
  const failedOrCancelled = run.status === "failed" || run.status === "cancelled";

  function handleRetry() {
    if (!run) return;
    submitMut.mutate(
      {
        templateId: run.template_id,
        version: run.template_version,
        parameters: run.parameters,
      },
      {
        onSuccess: (resp) => {
          onRetried?.(resp.id);
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-raised px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            {manifestQ.data?.name ?? run.template_id}
          </h2>
          <p className="text-xs text-text-muted">
            {t("aqueduct.runInspector.versionLabel", {
              defaultValue: "Version",
            })}{" "}
            <span className="font-['IBM_Plex_Mono',monospace]">
              {run.template_version}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RunStatusBadge status={run.status} />
          {!terminal && (
            <button
              type="button"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-critical/40 bg-critical/10 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/20",
                "disabled:opacity-50",
              )}
            >
              <X size={12} />
              {t("aqueduct.runInspector.cancel", {
                defaultValue: "Cancel run",
              })}
            </button>
          )}
          {failedOrCancelled && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={submitMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-50"
            >
              <RotateCw size={12} />
              {t("aqueduct.runInspector.retry", { defaultValue: "Retry" })}
            </button>
          )}
        </div>
      </div>

      {run.error_message && (
        <div className="rounded-lg border border-critical/40 bg-critical/10 p-4 text-sm text-critical">
          {run.error_message}
        </div>
      )}

      <Section
        title={t("aqueduct.runInspector.dag", { defaultValue: "DAG" })}
        open={openDag}
        onToggle={() => setOpenDag((v) => !v)}
      >
        {manifestQ.data ? (
          <RunDagView
            nodes={manifestQ.data.nodes}
            currentNode={run.current_node}
            status={run.status}
          />
        ) : (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={16} className="animate-spin text-text-muted" />
          </div>
        )}
      </Section>

      <Section
        title={t("aqueduct.runInspector.logs", { defaultValue: "Logs" })}
        open={openLogs}
        onToggle={() => setOpenLogs((v) => !v)}
      >
        <RunLogsView logs={logsQ.data ?? []} isRunning={!terminal} />
      </Section>

      <Section
        title={t("aqueduct.runInspector.artifacts", {
          defaultValue: "Artifacts",
        })}
        open={openArtifacts}
        onToggle={() => setOpenArtifacts((v) => !v)}
      >
        <RunArtifactsView artifacts={artifactsQ.data ?? []} />
      </Section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/RunInspector.test.tsx"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/components/aqueduct/templates/RunInspector.tsx src/features/etl/__tests__/RunInspector.test.tsx"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/components/aqueduct/templates/RunInspector.tsx frontend/src/features/etl/__tests__/RunInspector.test.tsx
git commit -m "feat(templates): add RunInspector with DAG, logs, artifacts, cancel and retry"
```

---

### Task 13: `AqueductTemplatesPage` (catalog grid + parameter form modal)

**Decision: modal vs inline panel.** A modal is chosen because (a) it preserves the user's grid scroll position when they cancel, (b) the form can be tall (10+ params) and the grid context is irrelevant during fill-in, (c) the existing codebase uses a modal pattern for similar single-purpose forms (e.g. `frontend/src/features/auth/components/ChangePasswordModal.tsx`). The modal is dismissable via Escape, backdrop click, or Cancel.

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/pages/AqueductTemplatesPage.tsx`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/AqueductTemplatesPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/AqueductTemplatesPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("@/lib/api-client", () => {
  const get = vi.fn();
  const post = vi.fn();
  const del = vi.fn();
  return {
    default: { get, post, delete: del },
    apiClient: { get, post, delete: del },
  };
});

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigate };
});

import { apiClient } from "@/lib/api-client";
import { AqueductTemplatesPage } from "../pages/AqueductTemplatesPage";

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
  navigate.mockReset();
});

const TEMPLATES = [
  {
    id: "hello_cdm",
    name: "Hello CDM",
    version: "0.1.0",
    description: "Bootstrap an empty CDM",
    category: "bootstrap",
    tags: ["smoke"],
    cdm_versions: ["5.4"],
    parameters_schema: { type: "object", properties: {} },
  },
];

const MANIFEST = {
  ...TEMPLATES[0],
  nodes: [],
  post_conditions: [],
};

describe("AqueductTemplatesPage", () => {
  it("shows the empty state when no templates", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });
    render(<AqueductTemplatesPage />, { wrapper });
    expect(
      await screen.findByText(/No templates available/i),
    ).toBeInTheDocument();
  });

  it("renders a card per template", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: TEMPLATES } });
    render(<AqueductTemplatesPage />, { wrapper });
    expect(await screen.findByText("Hello CDM")).toBeInTheDocument();
  });

  it("opens the parameter modal on card click", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates")
        return Promise.resolve({ data: { data: TEMPLATES } });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: { data: MANIFEST } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    render(<AqueductTemplatesPage />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /Hello CDM/ }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );
  });

  it("submits the run and navigates to ?subtab=runs&run=<id>", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates")
        return Promise.resolve({ data: { data: TEMPLATES } });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: { data: MANIFEST } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 42 } } });

    render(<AqueductTemplatesPage />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /Hello CDM/ }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.stringMatching(/subtab=runs&run=42/),
      ),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/AqueductTemplatesPage.test.tsx"`
Expected: FAIL with `Failed to resolve import "../pages/AqueductTemplatesPage"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/pages/AqueductTemplatesPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import {
  useTemplate,
  useTemplates,
  useSubmitTemplateRun,
} from "../api/templates";
import { TemplateCard } from "../components/aqueduct/templates/TemplateCard";
import { ParameterForm } from "../components/aqueduct/templates/ParameterForm";

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-xl border border-border-default bg-surface-raised"
        />
      ))}
    </div>
  );
}

export function AqueductTemplatesPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const templatesQ = useTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const manifestQ = useTemplate(selectedId);
  const submitMut = useSubmitTemplateRun();

  function handleSubmit(parameters: Record<string, unknown>) {
    if (!manifestQ.data) return;
    submitMut.mutate(
      {
        templateId: manifestQ.data.id,
        version: manifestQ.data.version,
        parameters,
      },
      {
        onSuccess: (resp) => {
          setSelectedId(null);
          navigate(`/data-ingestion?tab=aqueduct&subtab=runs&run=${resp.id}`);
        },
      },
    );
  }

  if (templatesQ.isLoading) {
    return <SkeletonGrid />;
  }

  if (templatesQ.isError) {
    return (
      <div className="rounded-xl border border-critical/40 bg-critical/10 p-6 text-center text-sm text-critical">
        <p>
          {t("aqueduct.templates.error", {
            defaultValue:
              "Failed to load templates. Check that the templates service is running.",
          })}
        </p>
        <button
          type="button"
          onClick={() => templatesQ.refetch()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-critical/40 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/20"
        >
          {t("aqueduct.templates.retry", { defaultValue: "Retry" })}
        </button>
      </div>
    );
  }

  if (!templatesQ.data || templatesQ.data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-default bg-surface-raised p-12 text-center text-sm text-text-muted">
        {t("aqueduct.templates.empty", {
          defaultValue:
            "No templates available — check the templates service is running",
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templatesQ.data.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            id={tpl.id}
            name={tpl.name}
            description={tpl.description}
            category={tpl.category}
            tags={tpl.tags}
            cdm_versions={tpl.cdm_versions}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {selectedId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl border border-border-default bg-surface-base p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {manifestQ.data?.name ?? selectedId}
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  {manifestQ.data?.description}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("aqueduct.parameterForm.close", {
                  defaultValue: "Close",
                })}
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1 text-text-muted hover:bg-surface-overlay"
              >
                <X size={16} />
              </button>
            </div>
            {manifestQ.isLoading || !manifestQ.data ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-text-muted" />
              </div>
            ) : (
              <ParameterForm
                manifest={manifestQ.data}
                onSubmit={handleSubmit}
                onCancel={() => setSelectedId(null)}
                pending={submitMut.isPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/AqueductTemplatesPage.test.tsx"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/pages/AqueductTemplatesPage.tsx src/features/etl/__tests__/AqueductTemplatesPage.test.tsx"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/pages/AqueductTemplatesPage.tsx frontend/src/features/etl/__tests__/AqueductTemplatesPage.test.tsx
git commit -m "feat(templates): add AqueductTemplatesPage catalog grid with parameter modal"
```

---

### Task 14: `AqueductRunsPage` (run history table + run inspector)

The runs page reuses TanStack Table — verify the existing import path before scaffolding. The table has server-side pagination via `useTemplateRunHistory`.

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/pages/AqueductRunsPage.tsx`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/AqueductRunsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/AqueductRunsPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("@/lib/api-client", () => {
  const get = vi.fn();
  const post = vi.fn();
  const del = vi.fn();
  return {
    default: { get, post, delete: del },
    apiClient: { get, post, delete: del },
  };
});

import { apiClient } from "@/lib/api-client";
import { AqueductRunsPage } from "../pages/AqueductRunsPage";

const mockedGet = vi.mocked(apiClient.get);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/data-ingestion?tab=aqueduct&subtab=runs"]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => mockedGet.mockReset());

const RUN = {
  id: 42,
  template_id: "hello_cdm",
  template_version: "0.1.0",
  parameters: {},
  status: "completed",
  progress: 1.0,
  current_node: null,
  prefect_run_id: null,
  error_message: null,
  post_conditions: [],
  artifacts_path: null,
  submitted_by: 1,
  submitted_at: "2026-05-02T12:00:00Z",
  started_at: "2026-05-02T12:00:01Z",
  finished_at: "2026-05-02T12:00:30Z",
};

describe("AqueductRunsPage", () => {
  it("renders the run history table with a row per run", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: [RUN],
        meta: { total: 1, page: 1, per_page: 20 },
      },
    });
    render(<AqueductRunsPage />, { wrapper });
    expect(await screen.findByText("hello_cdm")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
  });

  it("filters by status when chips are toggled", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, per_page: 20 },
      },
    });
    render(<AqueductRunsPage />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /^Failed$/ }));
    await waitFor(() => {
      const lastCall = mockedGet.mock.calls.at(-1);
      expect(lastCall?.[0]).toContain("status%5B%5D=failed");
    });
  });

  it("opens the inspector when a row is clicked", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url.startsWith("/ingestion/templates/runs?"))
        return Promise.resolve({
          data: {
            data: [RUN],
            meta: { total: 1, page: 1, per_page: 20 },
          },
        });
      if (url === "/ingestion/templates/runs/42")
        return Promise.resolve({ data: { data: RUN } });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({
          data: {
            data: { ...RUN, name: "Hello CDM", nodes: [], post_conditions: [] },
          },
        });
      if (url === "/ingestion/templates/runs/42/logs")
        return Promise.resolve({ data: { data: [] } });
      if (url === "/ingestion/templates/runs/42/artifacts")
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    render(<AqueductRunsPage />, { wrapper });
    fireEvent.click(await screen.findByText("hello_cdm"));
    await waitFor(() =>
      expect(screen.getByText(/DAG/i)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/AqueductRunsPage.test.tsx"`
Expected: FAIL with `Failed to resolve import "../pages/AqueductRunsPage"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/pages/AqueductRunsPage.tsx
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTemplateRunHistory } from "../api/templates";
import type {
  TemplateRun,
  TemplateRunStatus,
} from "../types/templates";
import { RunStatusBadge } from "../components/aqueduct/templates/RunStatusBadge";
import { RunInspector } from "../components/aqueduct/templates/RunInspector";

const ALL_STATUSES: TemplateRunStatus[] = [
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
];

const PAGE_SIZE = 20;

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  return `${Math.round(ms / 60_000)} m`;
}

export function AqueductRunsPage() {
  const { t } = useTranslation("app");
  const [searchParams, setSearchParams] = useSearchParams();
  const runParam = searchParams.get("run");
  const selectedRunId = runParam ? Number(runParam) : null;

  const [statuses, setStatuses] = useState<TemplateRunStatus[]>([]);
  const [page, setPage] = useState(1);

  const historyQ = useTemplateRunHistory({
    page,
    pageSize: PAGE_SIZE,
    statuses: statuses.length ? statuses : undefined,
  });

  function selectRun(id: number) {
    const next = new URLSearchParams(searchParams);
    next.set("run", String(id));
    setSearchParams(next, { replace: true });
  }

  function clearSelection() {
    const next = new URLSearchParams(searchParams);
    next.delete("run");
    setSearchParams(next, { replace: true });
  }

  function toggleStatus(s: TemplateRunStatus) {
    setStatuses((curr) =>
      curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s],
    );
    setPage(1);
  }

  if (selectedRunId !== null) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={clearSelection}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          {t("aqueduct.runs.backToList", { defaultValue: "← Back to runs" })}
        </button>
        <RunInspector runId={selectedRunId} />
      </div>
    );
  }

  const labelFor = (s: TemplateRunStatus) =>
    t(`aqueduct.status.${s}`, { defaultValue: s });

  const meta = historyQ.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / PAGE_SIZE)) : 1;

  const rows: TemplateRun[] = useMemo(
    () => historyQ.data?.data ?? [],
    [historyQ.data],
  );

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map((s) => {
          const active = statuses.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                active
                  ? "border-success bg-success/10 text-success"
                  : "border-border-default text-text-muted hover:bg-surface-overlay",
              )}
            >
              {labelFor(s)}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default text-xs uppercase tracking-wide text-text-ghost">
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.template", {
                  defaultValue: "Template",
                })}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.version", {
                  defaultValue: "Version",
                })}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.status", { defaultValue: "Status" })}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.started", {
                  defaultValue: "Started",
                })}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.duration", {
                  defaultValue: "Duration",
                })}
              </th>
              <th className="px-4 py-2 text-left font-medium">
                {t("aqueduct.runs.columns.submitted_by", {
                  defaultValue: "Submitted by",
                })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {historyQ.isLoading && (
              <tr>
                <td colSpan={6} className="py-8 text-center">
                  <Loader2
                    size={16}
                    className="mx-auto animate-spin text-text-muted"
                  />
                </td>
              </tr>
            )}
            {!historyQ.isLoading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-sm text-text-muted"
                >
                  {t("aqueduct.runs.empty", {
                    defaultValue: "No runs match the current filters.",
                  })}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => selectRun(row.id)}
                className="cursor-pointer text-sm text-text-secondary hover:bg-surface-overlay"
              >
                <td className="px-4 py-2.5">{row.template_id}</td>
                <td className="px-4 py-2.5 font-['IBM_Plex_Mono',monospace] text-xs">
                  {row.template_version}
                </td>
                <td className="px-4 py-2.5">
                  <RunStatusBadge status={row.status} />
                </td>
                <td className="px-4 py-2.5 text-xs text-text-muted">
                  {row.started_at
                    ? new Date(row.started_at).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-text-muted">
                  {formatDuration(row.started_at, row.finished_at)}
                </td>
                <td className="px-4 py-2.5 text-xs text-text-muted">
                  {row.submitted_by}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            {t("aqueduct.runs.pageOf", {
              defaultValue: "Page {{page}} of {{total}}",
              page,
              total: totalPages,
            })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-border-default px-3 py-1 disabled:opacity-50"
            >
              {t("aqueduct.runs.prev", { defaultValue: "Prev" })}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-border-default px-3 py-1 disabled:opacity-50"
            >
              {t("aqueduct.runs.next", { defaultValue: "Next" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/AqueductRunsPage.test.tsx"`
Expected: PASS, 3 tests.

- [ ] **Step 5: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 6: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/pages/AqueductRunsPage.tsx src/features/etl/__tests__/AqueductRunsPage.test.tsx"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/pages/AqueductRunsPage.tsx frontend/src/features/etl/__tests__/AqueductRunsPage.test.tsx
git commit -m "feat(templates): add AqueductRunsPage with status filter and inspector deep-link"
```

> Phase 0 note: only template runs surface here. Aqueduct canvas runs are added in Phase 1.

---

### Task 15: Refactor `EtlToolsPage` to add sub-tab strip + URL sync + feature-flag gating

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/pages/EtlToolsPage.tsx` (full rewrite of structure; preserves the `AqueductContent` mappings logic)
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/EtlToolsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/__tests__/EtlToolsPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("@/lib/api-client", () => {
  const get = vi.fn();
  const post = vi.fn();
  const del = vi.fn();
  return {
    default: { get, post, delete: del },
    apiClient: { get, post, delete: del },
  };
});

// Stub the heavy lazy-loaded children so the test focuses on tab routing.
vi.mock("../pages/AqueductTemplatesPage", () => ({
  AqueductTemplatesPage: () => <div data-testid="templates-page" />,
}));
vi.mock("../pages/AqueductRunsPage", () => ({
  AqueductRunsPage: () => <div data-testid="runs-page" />,
}));

import { apiClient } from "@/lib/api-client";
import EtlToolsPage from "../pages/EtlToolsPage";

const mockedGet = vi.mocked(apiClient.get);

function wrapper({
  initialEntries,
}: {
  initialEntries: string[];
}): (p: { children: ReactNode }) => JSX.Element {
  return function Wrapper({ children }) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/data-ingestion" element={<>{children}</>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => mockedGet.mockReset());

function settings(enabled: boolean) {
  return { data: { data: { ingestion: { templates_enabled: enabled } } } };
}

describe("EtlToolsPage sub-tab gating", () => {
  it("hides Templates and Runs sub-tabs when feature flag is off", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/app-settings") return Promise.resolve(settings(false));
      if (url === "/ingestion-projects")
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    render(<EtlToolsPage />, {
      wrapper: wrapper({ initialEntries: ["/data-ingestion?tab=aqueduct"] }),
    });
    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: /Templates/ })).toBeNull();
      expect(screen.queryByRole("tab", { name: /Runs/ })).toBeNull();
    });
  });

  it("shows all three sub-tabs when feature flag is on", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/app-settings") return Promise.resolve(settings(true));
      if (url === "/ingestion-projects")
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    render(<EtlToolsPage />, {
      wrapper: wrapper({ initialEntries: ["/data-ingestion?tab=aqueduct"] }),
    });
    expect(
      await screen.findByRole("tab", { name: /Mappings/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Templates/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Runs/ })).toBeInTheDocument();
  });

  it("respects ?subtab=templates as the initial sub-tab", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/app-settings") return Promise.resolve(settings(true));
      if (url === "/ingestion/templates")
        return Promise.resolve({ data: { data: [] } });
      if (url === "/ingestion-projects")
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    render(<EtlToolsPage />, {
      wrapper: wrapper({
        initialEntries: ["/data-ingestion?tab=aqueduct&subtab=templates"],
      }),
    });
    expect(await screen.findByTestId("templates-page")).toBeInTheDocument();
  });

  it("updates the URL when a sub-tab is clicked", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/app-settings") return Promise.resolve(settings(true));
      if (url === "/ingestion-projects")
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    render(<EtlToolsPage />, {
      wrapper: wrapper({ initialEntries: ["/data-ingestion?tab=aqueduct"] }),
    });
    fireEvent.click(await screen.findByRole("tab", { name: /Runs/ }));
    await waitFor(() =>
      expect(window.location.search).toContain("subtab=runs"),
    );
  });
});
```

> The fourth test depends on `MemoryRouter` reflecting the URL update. If `window.location.search` is unreliable in jsdom, the test should instead read the React Router URL via a custom render helper that captures `useLocation`. Concretely: replace the assertion with `expect(currentLocationRef.current.search).toContain("subtab=runs")` after wiring a `LocationProbe` component into the route. Either form is acceptable; the assertion above is the simpler one and works in current jsdom + React Router.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/EtlToolsPage.test.tsx"`
Expected: FAIL — multiple `getByRole("tab", ...)` assertions return null because the existing page has no sub-tab strip.

- [ ] **Step 3: Refactor `EtlToolsPage`**

Replace the body of `/home/smudoshi/Github/Parthenon/frontend/src/features/etl/pages/EtlToolsPage.tsx` with:

```tsx
// /home/smudoshi/Github/Parthenon/frontend/src/features/etl/pages/EtlToolsPage.tsx
import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Loader2, GitMerge, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/features/help";
import {
  fetchIngestionProjects,
  type IngestionProject,
} from "@/features/ingestion/api/ingestionApi";
import { AqueductCanvas } from "../components/aqueduct/AqueductCanvas";
import {
  useEtlProjects,
  useCreateEtlProject,
  useEtlProject,
  useTableMappings,
} from "../hooks/useAqueductData";
import {
  fetchIngestionProjectFields,
  suggestMappings,
  type PersistedFieldProfile,
} from "../api";
import { useTemplatesEnabled } from "../hooks/useAppSettings";

// Lazy-load template sub-tabs (matches DataIngestionPage pattern)
const AqueductTemplatesPage = lazy(() =>
  import("./AqueductTemplatesPage").then((m) => ({
    default: m.AqueductTemplatesPage,
  })),
);
const AqueductRunsPage = lazy(() =>
  import("./AqueductRunsPage").then((m) => ({ default: m.AqueductRunsPage })),
);

type SubTabId = "mappings" | "templates" | "runs";

function SubTabFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={20} className="animate-spin text-text-muted" />
    </div>
  );
}

// ── Mappings sub-tab content (preserves existing behavior verbatim) ────────

function AqueductContent({
  ingestionProjectId,
}: {
  ingestionProjectId: number;
}) {
  const { t } = useTranslation("app");
  const { data: projectsData, isLoading: loadingProjects } = useEtlProjects();
  const createProject = useCreateEtlProject();
  const [cdmVersion, setCdmVersion] = useState("5.4");

  const existingProject = useMemo(() => {
    if (!projectsData?.data) return null;
    return (
      projectsData.data.find(
        (p) => p.ingestion_project_id === ingestionProjectId,
      ) ?? null
    );
  }, [projectsData, ingestionProjectId]);

  const projectId = existingProject?.id ?? 0;
  const { data: projectDetail } = useEtlProject(projectId);
  const { data: tableMappings = [] } = useTableMappings(projectId);

  const [sourceFields, setSourceFields] = useState<PersistedFieldProfile[]>([]);
  const [fieldsLoaded, setFieldsLoaded] = useState(false);

  useMemo(() => {
    if (ingestionProjectId > 0 && !fieldsLoaded) {
      fetchIngestionProjectFields(ingestionProjectId)
        .then((fields) => {
          setSourceFields(fields);
          setFieldsLoaded(true);
        })
        .catch(() => setFieldsLoaded(true));
    }
  }, [ingestionProjectId, fieldsLoaded]);

  const handleCreateProject = useCallback(() => {
    createProject.mutate(
      {
        ingestion_project_id: ingestionProjectId,
        cdm_version: cdmVersion,
      },
      {
        onSuccess: (newProject) => {
          suggestMappings(newProject.id).catch(() => {});
        },
      },
    );
  }, [createProject, ingestionProjectId, cdmVersion]);

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-success" />
        <span className="ml-3 text-sm text-text-muted">
          {t("etl.toolsPage.loadingProjects")}
        </span>
      </div>
    );
  }

  if (!existingProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-border-default bg-surface-raised">
        <div className="w-16 h-16 rounded-full bg-surface-overlay flex items-center justify-center mb-4">
          <GitMerge size={28} className="text-success" />
        </div>
        <h3 className="text-text-primary font-semibold text-lg">
          {t("etl.toolsPage.createTitle")}
        </h3>
        <p className="text-sm text-text-muted mt-1 text-center max-w-md">
          {t("etl.toolsPage.createDescription")}
        </p>
        <div className="mt-6 flex items-center gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
              {t("etl.toolsPage.cdmVersion")}
            </label>
            <select
              value={cdmVersion}
              onChange={(e) => setCdmVersion(e.target.value)}
              className="rounded-lg bg-surface-overlay border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success"
            >
              <option value="5.4">{t("etl.toolsPage.cdm54")}</option>
              <option value="5.3">{t("etl.toolsPage.cdm53")}</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreateProject}
            disabled={createProject.isPending}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
          >
            {createProject.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {t("etl.toolsPage.creating")}
              </>
            ) : (
              <>
                <Plus size={15} />
                {t("etl.toolsPage.createProject")}
              </>
            )}
          </button>
        </div>
        {createProject.isError && (
          <p className="mt-3 text-xs text-critical">
            {(createProject.error as Error)?.message ??
              t("etl.toolsPage.createFailed")}
          </p>
        )}
      </div>
    );
  }

  if (projectDetail) {
    return (
      <AqueductCanvas
        project={projectDetail.project}
        tableMappings={tableMappings}
        sourceFields={sourceFields}
        onBack={() => window.history.back()}
      />
    );
  }

  return null;
}

function MappingsTab() {
  const { t } = useTranslation("app");
  const [searchParams] = useSearchParams();
  const projectParam = searchParams.get("project");

  const { data: projectsData } = useQuery({
    queryKey: ["ingestion-projects"],
    queryFn: fetchIngestionProjects,
  });

  const readyProjects = useMemo(() => {
    const all = projectsData?.data ?? [];
    return all.filter(
      (p: IngestionProject) =>
        p.status === "ready" ||
        p.status === "mapping" ||
        p.status === "completed",
    );
  }, [projectsData]);

  const selectedProjectIdNum = projectParam ? Number(projectParam) || 0 : 0;
  const hasJobs = readyProjects.some(
    (p: IngestionProject) => p.id === selectedProjectIdNum,
  );

  if (projectParam && hasJobs) {
    return <AqueductContent ingestionProjectId={selectedProjectIdNum} />;
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-border-default bg-surface-raised">
      <div className="w-16 h-16 rounded-full bg-surface-overlay flex items-center justify-center mb-4">
        <GitMerge size={28} className="text-text-muted" />
      </div>
      <h3 className="text-text-primary font-semibold text-lg">
        {t("etl.toolsPage.emptyTitle")}
      </h3>
      <p className="text-sm text-text-muted mt-1 text-center max-w-md">
        {t("etl.toolsPage.emptyDescription")}
      </p>
    </div>
  );
}

// ── Sub-tab strip ──────────────────────────────────────────────────────────

const ALL_SUBTABS: { id: SubTabId; labelKey: string }[] = [
  { id: "mappings", labelKey: "aqueduct.subtabs.mappings" },
  { id: "templates", labelKey: "aqueduct.subtabs.templates" },
  { id: "runs", labelKey: "aqueduct.subtabs.runs" },
];

export default function EtlToolsPage() {
  const { t } = useTranslation("app");
  const templatesEnabled = useTemplatesEnabled();
  const [searchParams, setSearchParams] = useSearchParams();
  const subtabParam = searchParams.get("subtab");

  const visibleSubtabs = useMemo(
    () => (templatesEnabled ? ALL_SUBTABS : ALL_SUBTABS.filter((s) => s.id === "mappings")),
    [templatesEnabled],
  );

  const initial: SubTabId = (() => {
    if (subtabParam && visibleSubtabs.some((s) => s.id === subtabParam)) {
      return subtabParam as SubTabId;
    }
    return "mappings";
  })();

  const [activeSubtab, setActiveSubtab] = useState<SubTabId>(initial);

  // Sync activeSubtab → URL
  useEffect(() => {
    if (subtabParam !== activeSubtab) {
      const next = new URLSearchParams(searchParams);
      next.set("subtab", activeSubtab);
      setSearchParams(next, { replace: true });
    }
  }, [activeSubtab, subtabParam, searchParams, setSearchParams]);

  // If feature flag flips off while a hidden sub-tab is selected, fall back to mappings.
  useEffect(() => {
    if (!visibleSubtabs.some((s) => s.id === activeSubtab)) {
      setActiveSubtab("mappings");
    }
  }, [visibleSubtabs, activeSubtab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div
          role="tablist"
          aria-label={t("aqueduct.subtabs.aria", {
            defaultValue: "Aqueduct sub-tabs",
          })}
          className="flex items-center gap-1 border-b border-border-default flex-1"
        >
          {visibleSubtabs.map((sub) => (
            <button
              key={sub.id}
              role="tab"
              aria-selected={activeSubtab === sub.id}
              type="button"
              onClick={() => setActiveSubtab(sub.id)}
              className={cn(
                "relative px-4 py-2.5 text-sm uppercase tracking-wide transition-colors",
                activeSubtab === sub.id
                  ? "text-text-primary font-medium"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {t(sub.labelKey)}
              {activeSubtab === sub.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </div>
        <HelpButton helpKey="etl-tools" />
      </div>

      <Suspense fallback={<SubTabFallback />}>
        {activeSubtab === "mappings" && <MappingsTab />}
        {activeSubtab === "templates" && templatesEnabled && (
          <AqueductTemplatesPage />
        )}
        {activeSubtab === "runs" && templatesEnabled && <AqueductRunsPage />}
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/__tests__/EtlToolsPage.test.tsx"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Re-run full feature suite to catch cross-component regressions**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/"`
Expected: all tests pass.

- [ ] **Step 6: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 7: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/features/etl/pages/EtlToolsPage.tsx src/features/etl/__tests__/EtlToolsPage.test.tsx"`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/features/etl/pages/EtlToolsPage.tsx frontend/src/features/etl/__tests__/EtlToolsPage.test.tsx
git commit -m "feat(templates): add Aqueduct sub-tab strip with feature flag and URL sync"
```

---

### Task 16: Backfill i18n keys in `etlTemplatesResources.ts`

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/frontend/src/i18n/etlTemplatesResources.ts`
- Test: `/home/smudoshi/Github/Parthenon/frontend/src/i18n/__tests__/etlTemplatesResources.test.ts`

This task replaces the stub keys with the full tree used by every component above. Each leaf is the human-facing English string. The `defaultValue` fallbacks scattered through earlier tasks become redundant once these keys exist; that's intentional — `defaultValue` keeps tests independent and allows incremental landing.

- [ ] **Step 1: Extend the failing test**

Replace the contents of `/home/smudoshi/Github/Parthenon/frontend/src/i18n/__tests__/etlTemplatesResources.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { etlTemplatesEn } from "../etlTemplatesResources";

function getDeep(tree: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object" && key in (acc as Record<string, unknown>)
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    tree,
  );
}

const REQUIRED_KEYS: string[][] = [
  ["aqueduct", "subtabs", "mappings"],
  ["aqueduct", "subtabs", "templates"],
  ["aqueduct", "subtabs", "runs"],
  ["aqueduct", "subtabs", "aria"],
  ["aqueduct", "templates", "empty"],
  ["aqueduct", "templates", "error"],
  ["aqueduct", "templates", "retry"],
  ["aqueduct", "runs", "empty"],
  ["aqueduct", "runs", "backToList"],
  ["aqueduct", "runs", "pageOf"],
  ["aqueduct", "runs", "prev"],
  ["aqueduct", "runs", "next"],
  ["aqueduct", "runs", "columns", "template"],
  ["aqueduct", "runs", "columns", "version"],
  ["aqueduct", "runs", "columns", "status"],
  ["aqueduct", "runs", "columns", "started"],
  ["aqueduct", "runs", "columns", "duration"],
  ["aqueduct", "runs", "columns", "submitted_by"],
  ["aqueduct", "runInspector", "dag"],
  ["aqueduct", "runInspector", "logs"],
  ["aqueduct", "runInspector", "artifacts"],
  ["aqueduct", "runInspector", "cancel"],
  ["aqueduct", "runInspector", "retry"],
  ["aqueduct", "runInspector", "noLogs"],
  ["aqueduct", "runInspector", "noArtifacts"],
  ["aqueduct", "runInspector", "versionLabel"],
  ["aqueduct", "parameterForm", "run"],
  ["aqueduct", "parameterForm", "running"],
  ["aqueduct", "parameterForm", "cancel"],
  ["aqueduct", "parameterForm", "close"],
  ["aqueduct", "status", "pending"],
  ["aqueduct", "status", "queued"],
  ["aqueduct", "status", "running"],
  ["aqueduct", "status", "completed"],
  ["aqueduct", "status", "failed"],
  ["aqueduct", "status", "cancelled"],
];

describe("etlTemplatesResources", () => {
  for (const path of REQUIRED_KEYS) {
    it(`declares ${path.join(".")}`, () => {
      const v = getDeep(etlTemplatesEn, path);
      expect(typeof v).toBe("string");
      expect((v as string).length).toBeGreaterThan(0);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/i18n/__tests__/etlTemplatesResources.test.ts"`
Expected: FAIL — most keys missing.

- [ ] **Step 3: Backfill the resource module**

```ts
// /home/smudoshi/Github/Parthenon/frontend/src/i18n/etlTemplatesResources.ts
type MessageTree = { [k: string]: string | MessageTree };

export const etlTemplatesEn: MessageTree = {
  aqueduct: {
    subtabs: {
      aria: "Aqueduct sub-tabs",
      mappings: "Mappings",
      templates: "Templates",
      runs: "Runs",
    },
    templates: {
      empty: "No templates available — check the templates service is running",
      error:
        "Failed to load templates. Check that the templates service is running.",
      retry: "Retry",
    },
    runs: {
      empty: "No runs match the current filters.",
      backToList: "← Back to runs",
      pageOf: "Page {{page}} of {{total}}",
      prev: "Prev",
      next: "Next",
      columns: {
        template: "Template",
        version: "Version",
        status: "Status",
        started: "Started",
        duration: "Duration",
        submitted_by: "Submitted by",
      },
    },
    runInspector: {
      dag: "DAG",
      logs: "Logs",
      artifacts: "Artifacts",
      cancel: "Cancel run",
      retry: "Retry",
      noLogs: "No logs yet",
      noArtifacts: "No artifacts produced by this run.",
      versionLabel: "Version",
    },
    parameterForm: {
      run: "Run",
      running: "Running...",
      cancel: "Cancel",
      close: "Close",
    },
    status: {
      pending: "Pending",
      queued: "Queued",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
    },
  },
};

export const etlTemplatesEs: MessageTree = {};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/i18n/__tests__/etlTemplatesResources.test.ts"`
Expected: PASS, 36 tests.

- [ ] **Step 5: Re-run feature suite (sanity)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/etl/"`
Expected: all tests still pass — `defaultValue` fallbacks were a safety net; the real keys now satisfy them.

- [ ] **Step 6: Type check (tsc + vite build)**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: build succeeds.

- [ ] **Step 7: ESLint**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx eslint src/i18n/etlTemplatesResources.ts src/i18n/__tests__/etlTemplatesResources.test.ts"`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add frontend/src/i18n/etlTemplatesResources.ts frontend/src/i18n/__tests__/etlTemplatesResources.test.ts
git commit -m "feat(templates): backfill English i18n keys for templates UI"
```

---

### Task 17: Playwright E2E — submit and watch a template run

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/e2e/templates/submit-and-watch.spec.ts`

This test mocks `/api/v1/ingestion/templates/*` via `page.route()`, signs in as the existing test user, navigates to Aqueduct → Templates, picks `hello_cdm`, fills the parameter form, submits, and watches the run progress through `queued → running → completed`. Status transitions are simulated by the route handler returning different payloads on successive calls.

- [ ] **Step 1: Write the spec**

```ts
// /home/smudoshi/Github/Parthenon/e2e/templates/submit-and-watch.spec.ts
import { test, expect, type Route } from "@playwright/test";

const TEMPLATES = [
  {
    id: "hello_cdm",
    name: "Hello CDM",
    version: "0.1.0",
    description: "Bootstrap an empty OMOP CDM v5.4 schema",
    category: "bootstrap",
    tags: ["smoke"],
    cdm_versions: ["5.4"],
    parameters_schema: {
      type: "object",
      properties: {
        target_schema: { type: "string", title: "Target schema", default: "demo" },
      },
      required: ["target_schema"],
    },
  },
];

const MANIFEST = {
  ...TEMPLATES[0],
  nodes: [
    { id: "create_schema", kind: "sql_node", inputs: [], outputs: ["schema"] },
    { id: "load_seeds", kind: "csv_reader", inputs: ["schema"], outputs: [] },
  ],
  post_conditions: [
    { kind: "row_count", target: "person", op: ">=", value: 0 },
  ],
};

const RUN_BASE = {
  id: 99,
  template_id: "hello_cdm",
  template_version: "0.1.0",
  parameters: { target_schema: "demo" },
  progress: 0,
  current_node: null,
  prefect_run_id: "00000000-0000-0000-0000-000000000099",
  error_message: null,
  post_conditions: [],
  artifacts_path: null,
  submitted_by: 1,
  submitted_at: new Date().toISOString(),
  started_at: null,
  finished_at: null,
};

test.describe("Templates: submit and watch", () => {
  test("happy path", async ({ page, baseURL }) => {
    // App settings — feature flag on
    await page.route("**/api/v1/app-settings", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { ingestion: { templates_enabled: true } },
        }),
      }),
    );

    // Catalog
    await page.route("**/api/v1/ingestion/templates", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: TEMPLATES }),
      }),
    );

    // Manifest
    await page.route(
      "**/api/v1/ingestion/templates/hello_cdm",
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: MANIFEST }),
        }),
    );

    // Submit
    await page.route(
      "**/api/v1/ingestion/templates/hello_cdm/runs",
      (route: Route) =>
        route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ data: { id: 99 } }),
        }),
    );

    // Run polling — status transitions queued → running → completed
    let pollCount = 0;
    await page.route(
      "**/api/v1/ingestion/templates/runs/99",
      (route: Route) => {
        pollCount += 1;
        const status =
          pollCount === 1
            ? "queued"
            : pollCount === 2
              ? "running"
              : "completed";
        const run = {
          ...RUN_BASE,
          status,
          progress: status === "completed" ? 1.0 : 0.5,
          current_node:
            status === "running" ? "load_seeds" : status === "completed" ? null : "create_schema",
          started_at: status !== "queued" ? new Date().toISOString() : null,
          finished_at: status === "completed" ? new Date().toISOString() : null,
          post_conditions:
            status === "completed"
              ? [
                  {
                    kind: "row_count",
                    target: "person",
                    op: ">=",
                    value: 0,
                    status: "passed",
                    detail: "0 >= 0",
                  },
                ]
              : [],
        };
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: run }),
        });
      },
    );

    // Logs
    await page.route(
      "**/api/v1/ingestion/templates/runs/99/logs",
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                timestamp: new Date().toISOString(),
                node_id: "create_schema",
                level: "info",
                message: "creating schema",
              },
            ],
          }),
        }),
    );

    // Artifacts (only fetched on terminal)
    await page.route(
      "**/api/v1/ingestion/templates/runs/99/artifacts",
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        }),
    );

    // Run history (5s poll)
    await page.route(
      "**/api/v1/ingestion/templates/runs?**",
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [{ ...RUN_BASE, status: "completed", finished_at: new Date().toISOString() }],
            meta: { total: 1, page: 1, per_page: 20 },
          }),
        }),
    );

    // Login (uses the existing test fixture pattern; adjust if different)
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', "admin@acumenus.net");
    await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? "changeme");
    await page.click('button[type="submit"]');

    // Navigate to Data Ingestion → Aqueduct → Templates
    await page.goto(`${baseURL}/data-ingestion?tab=aqueduct&subtab=templates`);

    await expect(page.getByText("Hello CDM")).toBeVisible();

    // Open parameter modal
    await page.getByRole("button", { name: "Hello CDM" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // The default value satisfies validation; just submit.
    await page.getByRole("button", { name: /^Run$/ }).click();

    // We should land in the runs sub-tab with run=99
    await expect(page).toHaveURL(/subtab=runs.*run=99/);

    // Status badge transitions
    await expect(page.getByTestId("run-status-completed")).toBeVisible({
      timeout: 15_000,
    });

    // Logs section is visible (auto-expanded)
    await expect(page.getByText(/creating schema/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T node sh -c "cd /app && npx playwright test e2e/templates/submit-and-watch.spec.ts"`
Expected: PASS.

If it fails:
- Confirm the existing Playwright config base URL points at the dev server (`http://localhost:5175` or `http://localhost:8082`).
- Confirm the login fixture in `e2e/` matches this test's manual login flow; if a `loginAsAdmin` helper exists, use it instead.
- Check that the `aqueduct` tab id and `templates` subtab id match Plan 3 Task 15's URL contract (`?tab=aqueduct&subtab=templates`).

- [ ] **Step 3: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add e2e/templates/submit-and-watch.spec.ts
git commit -m "test(templates): add Playwright E2E for submit-and-watch happy path"
```

---

### Task 18: Production build verification — `./deploy.sh --frontend`

Per `feedback_always_deploy_sh.md`: every frontend change must end with `./deploy.sh --frontend`. This is the final task — no commit, no code changes; just verification.

- [ ] **Step 1: Run deploy**

Run: `cd /home/smudoshi/Github/Parthenon && ./deploy.sh --frontend`
Expected: exits 0; produces `frontend/dist/` artifacts that Apache will serve.

- [ ] **Step 2: Smoke test in browser (manual)**

1. Visit https://parthenon.acumenus.net (or http://localhost:8082 if testing locally).
2. Log in as admin@acumenus.net.
3. Navigate to Data Ingestion → Aqueduct.
4. With feature flag OFF (verify in app settings), only the Mappings sub-tab is visible.
5. Toggle the feature flag ON via the settings page (owned by Plan 2).
6. Re-navigate; Templates and Runs sub-tabs appear.
7. With Plan 1 + Plan 2 + Plan 4 deployed, click a template, fill params, submit, confirm RunInspector reaches `completed`.

This is the manual portion of the Phase 0 DoD's "Aqueduct shows the new sub-tabs behind the feature flag; with flag on, the full happy path works in Playwright." line. Plan 4 stages the manifests; Plan 3 confirms the UI renders them.

- [ ] **Step 3: Notify**

If smoke test passes, notify the platform engineer + ETL engineer (Phase 0 DoD reviewers) that the frontend slice is ready for review against Plan 1/2/4.

---

## Phase 0 DoD coverage map (UI-touching items only)

| DoD item | Covered by |
|---|---|
| Aqueduct shows the new sub-tabs behind feature flag | Task 15 |
| Full happy path works in Playwright | Task 17 |
| Submitting a CDM-touching template creates a deep-link to RunInspector | Task 13 (`navigate(?tab=aqueduct&subtab=runs&run=<id>)`) + Task 14 (RunInspector renders for `?run=<id>`) |
| `useTemplateRun` polling stops on terminal status | Task 3 (`templateRunRefetchInterval` tests) + Task 12 (RunInspector cancel button only when non-terminal) |
| `ParameterForm` validates client-side, renders password fields | Task 7 (8 unit tests cover string/number/enum/password/boolean/required/pending/cancel) |
| RunInspector shows DAG + logs + artifacts + status | Tasks 8/9/10/11/12 |
| i18n keys for sub-tabs, status, columns, inspector | Tasks 5 + 16 |
| `@rjsf/*` deps installed with `--legacy-peer-deps` | Task 1 |
| Feature flag gates visibility | Task 4 + Task 15 |
| `./deploy.sh --frontend` runs after frontend changes | Task 18 |

## Out-of-scope (other plans)

- Python service (`templates/runtime/*`) — Plan 1
- Laravel `TemplatesController`, `TemplateRunService`, migrations, OpenAPI generation, app-settings `templates_enabled` field write path — Plan 2
- Manifest YAML files, validation packs, README per template — Plan 4

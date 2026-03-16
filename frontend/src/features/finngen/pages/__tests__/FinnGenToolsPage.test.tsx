import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import FinnGenToolsPage from "../FinnGenToolsPage";
import { renderWithProviders } from "@/test/test-utils";

const apiMocks = vi.hoisted(() => ({
  previewFinnGenCohortOperations: vi.fn(async () => ({
    status: "ok",
    runtime: {
      service: "cohort_operations",
      mode: "external_command",
      mode_label: "External Command Adapter",
      adapter_configured: true,
      fallback_active: false,
      status: "adapter_executed",
      notes: ["Workbench results were produced by the configured external Cohort Operations adapter."],
    },
    source: {},
    compile_summary: {},
    attrition: [
      { label: "Compiled criteria", count: 10, percent: 100 },
      { label: "Preview cohort rows", count: 4, percent: 40 },
    ],
    criteria_timeline: [
      { step: 1, title: "Primary criteria", status: "ready", window: "Compile time", detail: "1 criterion compiled" },
    ],
    matching_summary: {
      eligible_rows: 40,
      matched_rows: 34,
      excluded_rows: 6,
      match_strategy: "nearest-neighbor",
      match_ratio: 1,
      match_caliper: 0.2,
      balance_score: 0.91,
    },
    matching_review: {
      matched_samples: [{ person_id: 81000, cohort_name: "Diabetes Enrollment Cohort", match_group: "matched" }],
      excluded_samples: [{ person_id: 91000, cohort_name: "Diabetes Enrollment Cohort", match_group: "excluded" }],
      balance_notes: ["Matching evidence is aligned to the selected operation builder settings."],
    },
    export_summary: {
      cohort_reference: "Union Diabetes Enrollment Cohort",
      export_target: "results.finngen_union_preview",
      handoff_ready: true,
    },
    operation_comparison: [
      { label: "Selected cohorts", value: 1 },
      { label: "Candidate rows", value: 40 },
      { label: "Derived rows", value: 34 },
      { label: "Retained ratio", value: "85%" },
    ],
    cohort_table_summary: {
      schema: "results",
      table: "cohort",
      qualified_name: "results.cohort",
      valid: true,
      row_count: 40,
      distinct_cohort_definition_ids: 3,
    },
    artifacts: [{ name: "preview.sql", summary: "Compiled SQL preview" }],
  })),
  previewFinnGenCo2Analysis: vi.fn(async () => ({
    status: "ok",
    runtime: {
      service: "co2_analysis",
      mode: "external_service",
      mode_label: "External Service Adapter",
      adapter_configured: true,
      fallback_active: false,
      status: "adapter_executed",
      notes: ["Workbench results were produced by the configured external CO2 adapter."],
    },
    source: {},
    analysis_summary: {},
    cohort_context: {
      cohort_reference: "Union Diabetes Enrollment Cohort",
      operation_type: "union",
      result_rows: 34,
      retained_ratio: "85%",
    },
    handoff_impact: [{ label: "Derived cohort rows", value: 34, emphasis: "result" }],
    module_setup: { cohort_label: "Diabetes cohort", outcome_name: "Heart failure", exposure_window: "180 days" },
    family_spotlight: [{ label: "Lead therapy signal", value: "Metformin", detail: "Most concentrated exposure signal" }],
    family_segments: [{ label: "New starts", count: 12, share: 0.36 }],
    family_result_summary: { focus: "Comparative effectiveness" },
    result_table: [{ contrast: "Target vs outcome", estimate: "0.62" }],
    subgroup_summary: [{ label: "Cohort lane", value: "Diabetes cohort" }],
    temporal_windows: [{ label: "2026-03", count: 124, detail: "Observed event volume" }],
    module_gallery: [{ name: "comparative_effectiveness", family: "preview", status: "selected" }],
    forest_plot: [{ label: "Condition occurrence", effect: 0.4, lower: 0.3, upper: 0.5 }],
    heatmap: [{ label: "Age 45-64", value: 0.5 }],
    top_signals: [{ label: "Diabetes mellitus", count: 125 }],
    utilization_trend: [{ label: "2026-03", count: 75 }],
    execution_timeline: [{ stage: "Trend scan", status: "ready", duration_ms: 12 }],
  })),
  previewFinnGenHadesExtras: vi.fn(async () => ({
    status: "ok",
    runtime: {
      service: "hades_extras",
      mode: "external_command",
      mode_label: "External Command Adapter",
      adapter_configured: true,
      fallback_active: false,
      status: "adapter_executed",
      notes: ["Workbench results were produced by the configured external HADES adapter."],
    },
    source: {},
    package_setup: {
      package_name: "package",
      config_profile: "analysis_bundle",
      artifact_mode: "full_bundle",
      package_skeleton: "finngen_extension",
      cohort_table: "results.cohort",
    },
    render_summary: {},
    sql_preview: { template: "SELECT 1", rendered: "SELECT 1;" },
    artifact_pipeline: [{ name: "Render SQL", status: "ready" }],
    artifacts: [{ name: "package/inst/sql/postgresql/analysis.sql" }],
    package_manifest: [
      { path: "package/DESCRIPTION", kind: "package", summary: "Package metadata" },
      { path: "package/inst/sql/postgresql/analysis.sql", kind: "sql", summary: "Rendered SQL entrypoint" },
      { path: "package/R/finngen_hooks.R", kind: "r", summary: "FINNGEN extension hooks" },
    ],
    package_bundle: {
      name: "package.zip",
      format: "zip",
      entrypoints: ["package/inst/sql/postgresql/analysis.sql", "package/R/finngen_hooks.R"],
      download_name: "package-bundle.json",
    },
    explain_plan: [{ "QUERY PLAN": "Result  (cost=0.00..0.01 rows=1 width=4)" }],
  })),
  previewFinnGenRomopapi: vi.fn(async () => ({
    status: "ok",
    runtime: {
      service: "romopapi",
      mode: "external_service",
      mode_label: "External Service Adapter",
      adapter_configured: true,
      fallback_active: false,
      status: "adapter_executed",
      notes: ["Workbench results were produced by the configured external ROMOPAPI adapter."],
    },
    source: {},
    query_controls: {
      schema_scope: "cdm",
      concept_domain: "Drug",
      stratify_by: "sex",
      result_limit: 10,
      lineage_depth: 4,
    },
    metadata_summary: {},
    schema_nodes: [{ name: "person", group: "table", connections: 8 }],
    lineage_trace: [{ step: 1, label: "person", detail: "Lead table" }],
    query_plan: { template: "person -> observation_period" },
    report_content: {
      markdown: "# ROMOPAPI Report\n\n- Source: acumenus",
      html: "<html><body><h1>ROMOPAPI Report</h1></body></html>",
      manifest: [{ name: "acumenus-cdm-report.html", kind: "html", summary: "Rendered report" }],
    },
    report_artifacts: [{ name: "acumenus-cdm-report.html", type: "html", summary: "Rendered report" }],
    result_profile: [{ label: "Schema", value: "cdm" }],
  })),
  fetchFinnGenRuns: vi.fn(async () => [
    {
      id: 101,
      service_name: "finngen_romopapi",
      status: "ok",
      source: { source_key: "acumenus" },
      submitted_at: "2026-03-15T10:00:00Z",
      artifacts: [{ name: "romopapi-report.html" }],
      summary: { schema_scope: "cdm" },
    },
    {
      id: 88,
      service_name: "finngen_romopapi",
      status: "ok",
      source: { source_key: "acumenus" },
      submitted_at: "2026-03-14T10:00:00Z",
      artifacts: [{ name: "romopapi-report-prior.html" }],
      summary: { schema_scope: "results" },
    },
  ]),
  fetchFinnGenRun: vi.fn(async (runId: number) =>
    runId === 88
      ? {
          id: 88,
          service_name: "finngen_romopapi",
          status: "ok",
          source: { source_key: "acumenus", source_name: "Acumenus OHDSI CDM" },
          submitted_at: "2026-03-14T10:00:00Z",
          runtime: {
            mode_label: "External Service Adapter",
            upstream_ready: true,
          },
          artifacts: [{ name: "romopapi-report-prior.html" }],
          summary: { schema_scope: "results" },
          request_payload: { query_template: "condition_occurrence -> person" },
          result_payload: {
            query_controls: { schema_scope: "results", concept_domain: "Condition", stratify_by: "age_band", result_limit: 25, lineage_depth: 3 },
            metadata_summary: { schema_scope: "results" },
            code_counts: [{ concept: "Type 2 diabetes mellitus", count: 20, domain: "Condition" }],
            stratified_counts: [{ label: "Female", count: 14, percent: 70 }],
            report_content: {
              markdown: "# Prior ROMOPAPI Report",
              html: "<html><body><h1>Prior ROMOPAPI Report</h1></body></html>",
              manifest: [{ name: "prior-report.html", kind: "html", summary: "Prior interactive report" }],
            },
            report_artifacts: [{ name: "prior-report.html", type: "html", summary: "Prior interactive report" }],
          },
        }
      : {
          id: 101,
          service_name: "finngen_romopapi",
          status: "ok",
          source: { source_key: "acumenus", source_name: "Acumenus OHDSI CDM" },
          submitted_at: "2026-03-15T10:00:00Z",
          runtime: {
            mode_label: "External Service Adapter",
            upstream_ready: true,
          },
          artifacts: [{ name: "romopapi-report.html" }],
          summary: { schema_scope: "cdm" },
          request_payload: { query_template: "person -> observation_period" },
          result_payload: {
            query_controls: { schema_scope: "cdm", concept_domain: "Drug", stratify_by: "sex", result_limit: 10, lineage_depth: 4 },
            metadata_summary: { schema_scope: "cdm" },
            code_counts: [{ concept: "Type 2 diabetes mellitus", count: 42, domain: "Condition" }],
            stratified_counts: [{ label: "Female", count: 25, percent: 59.5 }],
            report_content: {
              markdown: "# ROMOPAPI Report",
              html: "<html><body><h1>ROMOPAPI Report</h1></body></html>",
              manifest: [{ name: "report.html", kind: "html", summary: "Interactive report" }],
            },
            report_artifacts: [{ name: "report.html", type: "html", summary: "Interactive report" }],
          },
        },
  ),
  replayFinnGenRun: vi.fn(async () => ({
    id: 202,
    service_name: "finngen_romopapi",
    status: "ok",
    source: { source_key: "acumenus", source_name: "Acumenus OHDSI CDM" },
    submitted_at: "2026-03-15T11:00:00Z",
    runtime: {
      mode_label: "External Service Adapter",
      upstream_ready: true,
    },
    artifacts: [{ name: "romopapi-report-replay.html" }],
    summary: { schema_scope: "cdm" },
    request_payload: { query_template: "person -> observation_period" },
    result_payload: {
      metadata_summary: { schema_scope: "cdm" },
      code_counts: [{ concept: "Type 2 diabetes mellitus", count: 44, domain: "Condition" }],
      report_content: {
        markdown: "# Replay ROMOPAPI Report",
        html: "<html><body><h1>Replay ROMOPAPI Report</h1></body></html>",
        manifest: [{ name: "replay-report.html", kind: "html", summary: "Replay report" }],
      },
    },
  })),
  exportFinnGenRun: vi.fn(async () => ({
    run: { id: 101 },
    bundle_version: 1,
  })),
}));

vi.mock("@/features/data-sources/api/sourcesApi", () => ({
  fetchSources: vi.fn(async () => [
    {
      id: 1,
      source_name: "Acumenus OHDSI CDM",
      source_key: "acumenus",
      source_dialect: "postgresql",
      is_default: true,
      daimons: [
        { daimon_type: "CDM", table_qualifier: "cdm" },
        { daimon_type: "Results", table_qualifier: "results" },
        { daimon_type: "Vocabulary", table_qualifier: "vocab" },
      ],
    },
  ]),
}));

vi.mock("../../hooks/useFinnGenServices", () => ({
  useFinnGenServices: vi.fn(() => ({
    data: {
      services: [
        {
          name: "finngen_cohort_operations",
          endpoint: "/study-agent/finngen/cohort-operations",
          implemented: true,
          ui_hints: { title: "Cohort Operations", repository: "https://example.com/cohort" },
        },
        {
          name: "finngen_co2_analysis",
          endpoint: "/study-agent/finngen/co2-analysis",
          implemented: true,
          ui_hints: { title: "CO2 Analysis Modules", repository: "https://example.com/co2" },
        },
        {
          name: "finngen_hades_extras",
          endpoint: "/study-agent/finngen/hades-extras",
          implemented: true,
          ui_hints: { title: "HADES Extras", repository: "https://example.com/hades" },
        },
        {
          name: "finngen_romopapi",
          endpoint: "/study-agent/finngen/romopapi",
          implemented: true,
          ui_hints: { title: "ROMOPAPI", repository: "https://example.com/romopapi" },
        },
        {
          name: "community_variant_browser",
          endpoint: "/flows/community/community-variant-browser",
          implemented: true,
          ui_hints: { title: "Community Variant Browser" },
          description: "Optional sample tool generated from the Community Workbench SDK.",
        },
      ],
      warnings: [],
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  })),
}));

vi.mock("@/features/cohort-definitions/hooks/useCohortDefinitions", () => ({
  useCohortDefinitions: vi.fn(() => ({
    data: {
      items: [
        {
          id: 11,
          name: "Diabetes Enrollment Cohort",
          description: "Existing Parthenon cohort for diabetes patients",
        },
        {
          id: 18,
          name: "Heart Failure Comparator Cohort",
          description: "Comparator cohort for cardiac outcomes",
        },
      ],
    },
  })),
  useCohortDefinition: vi.fn((id: number | null) => ({
    data:
      id === 11
        ? {
            id: 11,
            name: "Diabetes Enrollment Cohort",
            description: "Existing Parthenon cohort for diabetes patients",
            expression_json: {
              conceptSets: [],
              PrimaryCriteria: {
                CriteriaList: [
                  {
                    ConditionOccurrence: {
                      CodesetId: 1,
                      ConditionTypeExclude: false,
                    },
                  },
                ],
                ObservationWindow: { PriorDays: 0, PostDays: 0 },
              },
            },
          }
        : null,
    isLoading: false,
  })),
}));

vi.mock("../../api", () => ({
  exportFinnGenRun: apiMocks.exportFinnGenRun,
  fetchFinnGenRun: apiMocks.fetchFinnGenRun,
  fetchFinnGenRuns: apiMocks.fetchFinnGenRuns,
  previewFinnGenCohortOperations: apiMocks.previewFinnGenCohortOperations,
  previewFinnGenCo2Analysis: apiMocks.previewFinnGenCo2Analysis,
  previewFinnGenHadesExtras: apiMocks.previewFinnGenHadesExtras,
  previewFinnGenRomopapi: apiMocks.previewFinnGenRomopapi,
  replayFinnGenRun: apiMocks.replayFinnGenRun,
}));

describe("FinnGenToolsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all workbench tabs and runs each tab flow", async () => {
    renderWithProviders(<FinnGenToolsPage />, { initialRoute: "/workbench" });

    expect(await screen.findByRole("heading", { name: "Workbench" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Community Workbench SDK/i })).toHaveAttribute("href", "/docs/community-workbench-sdk");
    expect(screen.getByText(/Community Tool Spotlight/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Community Variant Browser/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Demo/i })).toHaveAttribute("href", "/workbench/community-sdk-demo");
    expect((await screen.findAllByText(/Acumenus OHDSI CDM/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Cohort Ops/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /CO2 Modules/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /HADES Extras/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /ROMOPAPI/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /ROMOPAPI/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Run Query Plan Preview/i }));
    expect((await screen.findAllByText(/person -> observation_period/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/External Service Adapter/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Report manifest/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download Markdown Report/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download HTML Report/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download Manifest/i })).toBeInTheDocument();
    expect(await screen.findByText(/Stored Request/i)).toBeInTheDocument();
    expect(await screen.findByText(/Persisted Code Counts/i)).toBeInTheDocument();
    expect(await screen.findByText(/Report Artifacts/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export Bundle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Replay Run/i })).toBeInTheDocument();
    expect(apiMocks.previewFinnGenRomopapi).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchFinnGenRun).toHaveBeenCalledWith(101);
    fireEvent.click(screen.getByRole("button", { name: /Export Bundle/i }));
    await waitFor(() => {
      expect(apiMocks.exportFinnGenRun).toHaveBeenCalledWith(101);
    });
    fireEvent.click(screen.getByRole("button", { name: /Replay Run/i }));
    await waitFor(() => {
      expect(apiMocks.replayFinnGenRun).toHaveBeenCalledWith(101);
    });
    fireEvent.click(screen.getAllByRole("button", { name: /HADES Extras/i })[0]);
    fireEvent.change(screen.getByLabelText(/Config profile/i), { target: { value: "analysis_bundle" } });
    fireEvent.change(screen.getByLabelText(/Artifact mode/i), { target: { value: "full_bundle" } });
    fireEvent.change(screen.getByLabelText(/Package skeleton/i), { target: { value: "finngen_extension" } });
    fireEvent.click(screen.getByRole("button", { name: /Render Preview/i }));
    expect((await screen.findAllByText(/External Command Adapter/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Package Setup/i)).toBeInTheDocument();
    expect(screen.getByText(/Explain Plan/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Package Manifest/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Download Bundle Metadata/i })).toBeInTheDocument();
    expect(apiMocks.previewFinnGenHadesExtras).toHaveBeenCalledTimes(1);
    expect(apiMocks.previewFinnGenHadesExtras).toHaveBeenCalledWith(
      expect.objectContaining({
        config_profile: "analysis_bundle",
        artifact_mode: "full_bundle",
        package_skeleton: "finngen_extension",
      }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Cohort Ops/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Open Operation Builder/i }));
    fireEvent.click(screen.getByLabelText(/Diabetes Enrollment Cohort/i));
    fireEvent.change(screen.getByLabelText(/Match ratio/i), { target: { value: "2.0" } });
    fireEvent.change(screen.getByLabelText(/Caliper/i), { target: { value: "0.15" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply Builder/i }));
    fireEvent.click(screen.getByRole("button", { name: /Run Cohort Preview/i }));
    expect(await screen.findByText(/Compiled criteria/i)).toBeInTheDocument();
    expect(screen.getByText(/Matched samples/i)).toBeInTheDocument();
    expect(screen.getByText(/Excluded samples/i)).toBeInTheDocument();
    expect(screen.getByText(/Operation Comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/Cohort Table Summary/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Selected Cohorts/i).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/External Command Adapter/i)).length).toBeGreaterThan(0);
    expect(apiMocks.previewFinnGenCohortOperations).toHaveBeenCalledTimes(1);
    expect(apiMocks.previewFinnGenCohortOperations).toHaveBeenCalledWith(
      expect.objectContaining({
        import_mode: "parthenon",
        selected_cohort_ids: [11],
        selected_cohort_labels: ["Diabetes Enrollment Cohort"],
        matching_ratio: 2,
        matching_caliper: 0.15,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Hand Off To CO2 Modules/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /CO2 Modules/i })[0]);
    fireEvent.change(screen.getByLabelText(/Module key/i), { target: { value: "drug_utilization" } });
    fireEvent.change(screen.getByLabelText(/Exposure window/i), { target: { value: "180 days" } });
    fireEvent.click(screen.getByRole("button", { name: /Run Module Preview/i }));
    expect((await screen.findAllByText(/Diabetes mellitus/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Derived Cohort Context/i)).toBeInTheDocument();
    expect(screen.getByText(/Handoff Impact/i)).toBeInTheDocument();
    expect(screen.getByText(/Module Setup/i)).toBeInTheDocument();
    expect(screen.getByText(/Family Result Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Family Result Table/i)).toBeInTheDocument();
    expect(screen.getByText(/Family Spotlight/i)).toBeInTheDocument();
    expect(screen.getByText(/Family Segments/i)).toBeInTheDocument();
    expect(screen.getByText(/Temporal Windows/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/External Service Adapter/i)).length).toBeGreaterThan(0);
    expect(apiMocks.previewFinnGenCo2Analysis).toHaveBeenCalledTimes(1);
    expect(apiMocks.previewFinnGenCo2Analysis).toHaveBeenCalledWith(
      expect.objectContaining({
        module_key: "drug_utilization",
        exposure_window: "180 days",
        cohort_context: expect.objectContaining({
          operation_type: "union",
          result_rows: 34,
        }),
        source: expect.objectContaining({
          source_key: "acumenus",
        }),
      }),
    );
    await waitFor(() => {
      expect(screen.getByText(/Runtime Path/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /ROMOPAPI/i })[0]);
    fireEvent.change(screen.getByLabelText(/Concept domain/i), { target: { value: "Drug" } });
    fireEvent.change(screen.getByLabelText(/^Stratify by$/i), { target: { value: "sex" } });
    fireEvent.change(screen.getByLabelText(/Result limit/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/Lineage depth/i), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /Run Query Plan Preview/i }));
    expect(await screen.findByText(/Query Controls/i)).toBeInTheDocument();
    expect(apiMocks.previewFinnGenRomopapi).toHaveBeenCalledWith(
      expect.objectContaining({
        concept_domain: "Drug",
        stratify_by: "sex",
        result_limit: 10,
        lineage_depth: 4,
      }),
    );
  });
});

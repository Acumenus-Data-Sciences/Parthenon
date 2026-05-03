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
      nodes: [{ id: "n1", kind: "sql_node", inputs: [], outputs: ["t1"] }],
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
    expectTypeOf(log.level).toEqualTypeOf<
      "debug" | "info" | "warn" | "error"
    >();
    expectTypeOf(art.size_bytes).toBeNumber();
  });
});

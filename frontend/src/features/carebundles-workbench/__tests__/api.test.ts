import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import apiClient from "@/lib/api-client";
import { fetchBundleRuns } from "../api";

let mock: MockAdapter;

describe("carebundles-workbench api", () => {
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });

  afterEach(() => {
    mock.restore();
  });

  it("scopes bundle runs by source id when provided", async () => {
    mock.onGet("/care-bundles/3/runs", { params: { source_id: 47 } }).reply(200, {
      data: [
        {
          id: 184,
          condition_bundle_id: 3,
          source_id: 47,
          status: "completed",
          started_at: null,
          completed_at: null,
          triggered_by: null,
          trigger_kind: "manual",
          qualified_person_count: 75555,
          measure_count: 7,
          bundle_version: null,
          cdm_fingerprint: null,
          fail_message: null,
          created_at: "2026-04-25T00:00:00Z",
        },
      ],
    });

    const runs = await fetchBundleRuns(3, 47);

    expect(runs).toHaveLength(1);
    expect(mock.history.get[0].params).toEqual({ source_id: 47 });
  });
});

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

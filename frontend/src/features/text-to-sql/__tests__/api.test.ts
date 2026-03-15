import { describe, expect, it } from "vitest";
import { normalizeSchemaResponse } from "../api";

describe("normalizeSchemaResponse", () => {
  it("maps FastAPI schema payloads into the frontend shape", () => {
    const result = normalizeSchemaResponse({
      clinical_tables: [
        {
          name: "person",
          description: "Patient table",
          key_columns: [
            {
              name: "person_id",
              type: "bigint",
              note: "Primary key",
            },
          ],
        },
      ],
      vocabulary_tables: [
        {
          name: "concept",
          description: "Vocabulary table",
          key_columns: [
            {
              name: "concept_id",
              type: "int",
              note: "Primary key",
            },
          ],
        },
      ],
      common_join_patterns: [
        {
          name: "Concept lookup",
          sql: "JOIN omop.concept c ON c.concept_id = co.condition_concept_id",
        },
      ],
    });

    expect(result.clinical_tables[0].columns).toEqual([
      {
        name: "person_id",
        type: "bigint",
        description: "Primary key",
      },
    ]);
    expect(result.vocabulary_tables[0].columns[0].name).toBe("concept_id");
    expect(result.common_joins).toEqual([
      "JOIN omop.concept c ON c.concept_id = co.condition_concept_id",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import type { StudyDesignVersion } from "../../types/study";
import { buildIntentReviewAssistance } from "../studyDesignIntentAssistance";

describe("buildIntentReviewAssistance", () => {
  it("flags missing and weak intent fields before downstream assets are trusted", () => {
    const assistance = buildIntentReviewAssistance(
      version({
        normalized_spec_json: {
          study: {
            research_question: "Among adults with diabetes, what is the risk of kidney failure?",
            primary_objective: "Estimate the risk of kidney failure.",
          },
          pico: {
            population: { summary: "Adults with type 2 diabetes and at least 365 days of prior observation." },
            comparator: { summary: "usual care" },
            outcome: { summary: "Kidney failure" },
            time: { summary: "30 days" },
          },
        },
      }),
    );

    expect(assistance.status).toBe("needs_attention");
    expect(assistance.missingFields.map((field) => field.fieldLabel)).toContain("Exposure");
    expect(assistance.weakFields.map((field) => field.fieldLabel)).toEqual(
      expect.arrayContaining(["Comparator", "Time at risk"]),
    );
    expect(assistance.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "comparator",
          draftValue: expect.stringContaining("No comparator cohort specified"),
        }),
      ]),
    );
  });

  it("uses live form edits ahead of the persisted extraction", () => {
    const assistance = buildIntentReviewAssistance(
      version({
        normalized_spec_json: {
          study: {
            research_question: "",
            primary_objective: "",
          },
          pico: {},
        },
      }),
      {
        researchQuestion: "Among adults with hypertension, does ACE inhibitor initiation reduce stroke risk?",
        primaryObjective: "Estimate stroke risk after ACE inhibitor initiation.",
        population: "Adults with hypertension and continuous observation before index.",
        exposure: "New ACE inhibitor initiation as the index event.",
        comparator: "New thiazide diuretic initiation in otherwise eligible patients.",
        outcome: "Incident ischemic stroke hospitalization.",
        time: "Index date through 365 days of follow-up, end of observation, death, or study end.",
      },
    );

    expect(assistance.status).toBe("ready");
    expect(assistance.missingFields).toHaveLength(0);
    expect(assistance.weakFields).toHaveLength(0);
  });

  it("surfaces protocol provenance, open questions, and risk notes", () => {
    const assistance = buildIntentReviewAssistance(
      version({
        intent_json: {
          research_question: "What is the risk of stroke?",
          primary_objective: "Estimate stroke risk.",
          pico: {
            population: "Adults with hypertension",
            intervention: "ACE inhibitor initiation",
            comparator: "thiazide initiation",
            outcome: "stroke hospitalization",
            time_at_risk: "Index date through 1 year of follow-up",
          },
          open_questions: ["Confirm whether prior stroke is an exclusion criterion."],
          risk_notes: ["Comparator definition needs clinician review."],
          evidence_spans: [
            {
              field: "population",
              quote: "Adults with hypertension",
              section: "Eligibility",
              confidence: 0.91,
            },
          ],
          confidence: {
            overall: 0.86,
            population: 0.91,
            time_at_risk: 0.72,
          },
          uncertainty: [
            {
              field: "comparator",
              message: "Comparator needs operational confirmation.",
            },
          ],
          design_assumptions: [
            {
              field: "time_at_risk",
              message: "Assume 1 year means 365 days after index.",
            },
          ],
        },
        provenance_json: {
          source: "protocol_upload_abby",
          protocol_file: {
            filename: "hypertension-protocol.md",
            text_length: 12400,
            truncated_for_ai: true,
          },
        },
      }),
    );

    expect(assistance.protocolSource).toEqual(
      expect.objectContaining({
        filename: "hypertension-protocol.md",
        textLength: 12400,
        truncated: true,
      }),
    );
    expect(assistance.openQuestions).toContain("Confirm whether prior stroke is an exclusion criterion.");
    expect(assistance.riskNotes).toContain("Comparator definition needs clinician review.");
    expect(assistance.evidenceSpans[0]).toEqual(
      expect.objectContaining({
        fieldKey: "population",
        fieldLabel: "Population",
        quote: "Adults with hypertension",
        confidence: 0.91,
      }),
    );
    expect(assistance.confidence.overall).toBe(0.86);
    expect(assistance.confidence.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldKey: "population", confidence: 0.91 }),
        expect.objectContaining({ fieldKey: "time", confidence: 0.72 }),
      ]),
    );
    expect(assistance.uncertaintyNotes).toContain("Comparator: Comparator needs operational confirmation.");
    expect(assistance.designAssumptions).toContain("Time at risk: Assume 1 year means 365 days after index.");
  });
});

function version(overrides: Partial<StudyDesignVersion> = {}): StudyDesignVersion {
  return {
    id: 1,
    session_id: 1,
    version_number: 1,
    status: "review_ready",
    intent_json: null,
    normalized_spec_json: null,
    provenance_json: null,
    accepted_by: null,
    accepted_at: null,
    locked_at: null,
    created_at: "2026-04-27T00:00:00Z",
    updated_at: "2026-04-27T00:00:00Z",
    ...overrides,
  };
}

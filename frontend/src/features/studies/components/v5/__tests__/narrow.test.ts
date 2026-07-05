import { describe, expect, it } from "vitest";
import { fmt, fmtPct, isFixture, num, str, toBalanceEntry, toForestEstimate } from "../narrow";

describe("narrow helpers", () => {
  it("num rejects non-finite and non-number values", () => {
    expect(num(1.5)).toBe(1.5);
    expect(num(NaN)).toBeNull();
    expect(num(Infinity)).toBeNull();
    expect(num("3")).toBeNull();
    expect(num(null)).toBeNull();
  });

  it("str returns strings only", () => {
    expect(str("MACE")).toBe("MACE");
    expect(str(42)).toBe("");
    expect(str(null)).toBe("");
  });

  it("fmt and fmtPct render em-dash for missing values", () => {
    expect(fmt(0.741, 2)).toBe("0.74");
    expect(fmt(undefined)).toBe("—");
    expect(fmtPct(-0.038)).toBe("-3.8%");
    expect(fmtPct(null)).toBe("—");
  });

  it("isFixture only trips on the explicit flag", () => {
    expect(isFixture({ _fixture: true })).toBe(true);
    expect(isFixture({ _fixture: "true" })).toBe(false);
    expect(isFixture({})).toBe(false);
  });
});

describe("toForestEstimate", () => {
  it("derives log HR and SE from the confidence interval", () => {
    const e = toForestEstimate({ outcome_name: "CKD", hazard_ratio: 0.74, ci_95_lower: 0.66, ci_95_upper: 0.83 }, 0);
    expect(e.outcome_name).toBe("CKD");
    expect(e.hazard_ratio).toBe(0.74);
    expect(e.ci_95_lower).toBe(0.66);
    expect(e.ci_95_upper).toBe(0.83);
    expect(e.log_hr).toBeCloseTo(Math.log(0.74), 6);
    expect(e.se_log_hr).toBeCloseTo((Math.log(0.83) - Math.log(0.66)) / (2 * 1.96), 6);
    // required EstimateEntry fields are always populated
    expect(e.outcome_id).toBe(0);
    expect(e.target_outcomes).toBe(0);
    expect(e.comparator_outcomes).toBe(0);
  });

  it("falls back to the `estimate` field (IV LATE payload)", () => {
    const e = toForestEstimate({ outcome_name: "MACE", estimate: 0.83, ci_95_lower: 0.68, ci_95_upper: 1.01 }, 1);
    expect(e.hazard_ratio).toBe(0.83);
  });

  it("stays finite when HR or CI is degenerate", () => {
    const e = toForestEstimate({ outcome_name: "X", hazard_ratio: 0 }, 2);
    expect(Number.isFinite(e.log_hr)).toBe(true);
    expect(Number.isFinite(e.se_log_hr)).toBe(true);
  });
});

describe("toBalanceEntry", () => {
  it("maps the compact balance shape and zero-fills unused means", () => {
    const b = toBalanceEntry({ covariate: "Age", smd_before: 0.31, smd_after: 0.04 });
    expect(b.covariate_name).toBe("Age");
    expect(b.smd_before).toBe(0.31);
    expect(b.smd_after).toBe(0.04);
    expect(b.mean_target_before).toBe(0);
    expect(b.mean_comp_after).toBe(0);
  });

  it("defaults gracefully on missing fields", () => {
    const b = toBalanceEntry({});
    expect(b.covariate_name).toBe("—");
    expect(b.smd_before).toBe(0);
  });
});

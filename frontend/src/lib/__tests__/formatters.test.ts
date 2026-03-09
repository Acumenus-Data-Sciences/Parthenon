import { describe, it, expect } from "vitest";
import {
  computeNNT,
  computeRateDifference,
  heterogeneityLabel,
  fmtP,
} from "../formatters";

describe("computeNNT", () => {
  it("returns positive NNT when target survival is higher (benefit)", () => {
    // ARR = 0.90 - 0.80 = 0.10, NNT = 10
    expect(computeNNT(0.9, 0.8)).toBeCloseTo(10);
  });

  it("returns negative NNT when target survival is lower (harm)", () => {
    // ARR = 0.70 - 0.80 = -0.10, NNT = -10
    expect(computeNNT(0.7, 0.8)).toBeCloseTo(-10);
  });

  it("returns Infinity when no difference", () => {
    expect(computeNNT(0.85, 0.85)).toBe(Infinity);
  });

  it("returns Infinity for near-zero ARR (floating-point precision)", () => {
    // 0.1 + 0.2 - 0.3 !== 0 in IEEE 754, but is ~5.5e-17
    expect(computeNNT(0.1 + 0.2, 0.3)).toBe(Infinity);
  });

  it("returns Infinity for NaN inputs", () => {
    expect(computeNNT(NaN, 0.8)).toBe(Infinity);
    expect(computeNNT(0.8, NaN)).toBe(Infinity);
  });
});

describe("computeRateDifference", () => {
  it("computes IRD and 95% CI with separate person-years", () => {
    const result = computeRateDifference(0.05, 0.03, 1000, 1200);
    expect(result.ird).toBeCloseTo(0.02);
    expect(result.ciLower).toBeLessThan(result.ird);
    expect(result.ciUpper).toBeGreaterThan(result.ird);
  });

  it("returns zero IRD when rates are equal", () => {
    const result = computeRateDifference(0.04, 0.04, 500, 500);
    expect(result.ird).toBe(0);
    // CI should be symmetric around 0
    expect(result.ciLower).toBeCloseTo(-result.ciUpper);
  });

  it("returns zero-width CI when person-years is zero", () => {
    const result = computeRateDifference(0.05, 0.03, 0, 1000);
    expect(result.ird).toBe(0);
    expect(result.ciLower).toBe(0);
    expect(result.ciUpper).toBe(0);
  });
});

describe("heterogeneityLabel", () => {
  it("returns Low for I² < 25", () => {
    expect(heterogeneityLabel(0)).toBe("Low");
    expect(heterogeneityLabel(24.9)).toBe("Low");
  });

  it("returns Moderate for I² 25–75", () => {
    expect(heterogeneityLabel(25)).toBe("Moderate");
    expect(heterogeneityLabel(50)).toBe("Moderate");
    expect(heterogeneityLabel(75)).toBe("Moderate");
  });

  it("returns High for I² > 75", () => {
    expect(heterogeneityLabel(75.1)).toBe("High");
    expect(heterogeneityLabel(100)).toBe("High");
  });
});

describe("fmtP", () => {
  it("returns <0.001 for very small p-values", () => {
    expect(fmtP(0.0001)).toBe("<0.001");
    expect(fmtP(0.0009)).toBe("<0.001");
  });

  it("returns 3 decimals for p < 0.01", () => {
    expect(fmtP(0.005)).toBe("0.005");
    expect(fmtP(0.001)).toBe("0.001");
  });

  it("returns 2 decimals for p >= 0.01", () => {
    expect(fmtP(0.05)).toBe("0.05");
    expect(fmtP(0.5)).toBe("0.50");
    expect(fmtP(1)).toBe("1.00");
  });

  it("returns N/A for NaN, negative, and non-finite p-values", () => {
    expect(fmtP(NaN)).toBe("N/A");
    expect(fmtP(-0.5)).toBe("N/A");
    expect(fmtP(Infinity)).toBe("N/A");
    expect(fmtP(-Infinity)).toBe("N/A");
  });
});

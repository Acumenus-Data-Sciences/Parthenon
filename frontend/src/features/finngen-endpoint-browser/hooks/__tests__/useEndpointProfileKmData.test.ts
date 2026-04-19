// Phase 18 (Plan 18-06) — adapter-hook test (D-13).
// Asserts that nCensored is derived per-row from (subject_count, at_risk,
// events) since the backend table has no censored column.
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEndpointProfileKmData } from "../useEndpointProfileKmData";

describe("useEndpointProfileKmData", () => {
  it("derives nCensored per-row from subject_count + at_risk + events (3-point curve)", () => {
    // subject_count=100; 3 km points
    // Row 0: prev=100, at_risk=95, events=3  → drop=5, nCensored=5-3=2
    // Row 1: prev=95,  at_risk=90, events=2  → drop=5, nCensored=5-2=3
    // Row 2: prev=90,  at_risk=85, events=5  → drop=5, nCensored=5-5=0
    const points = [
      { time_days: 30, survival_prob: 0.97, at_risk: 95, events: 3 },
      { time_days: 60, survival_prob: 0.95, at_risk: 90, events: 2 },
      { time_days: 90, survival_prob: 0.9, at_risk: 85, events: 5 },
    ];
    const { result } = renderHook(() =>
      useEndpointProfileKmData(points, 100, "E4_DM2"),
    );
    expect(result.current.targetCurve.map((p) => p.nCensored)).toEqual([
      2, 3, 0,
    ]);
    expect(result.current.targetCurve[0].nAtRisk).toBe(95);
    expect(result.current.targetCurve[0].nEvents).toBe(3);
  });

  it("clamps nCensored to 0 when events > drop (data-quality guard)", () => {
    // Pathological: events > drop. Should clamp to 0, never negative.
    const points = [
      { time_days: 30, survival_prob: 0.9, at_risk: 90, events: 20 },
    ];
    const { result } = renderHook(() =>
      useEndpointProfileKmData(points, 100, "E4_DM2"),
    );
    expect(result.current.targetCurve[0].nCensored).toBe(0);
  });

  it("switches timeUnit to years when maxTime >= 730 days", () => {
    const points = [
      { time_days: 730, survival_prob: 0.8, at_risk: 50, events: 10 },
    ];
    const { result } = renderHook(() =>
      useEndpointProfileKmData(points, 100, "E4_DM2"),
    );
    expect(result.current.timeUnit).toBe("years");
    expect(result.current.targetCurve[0].time).toBeCloseTo(730 / 365.25, 2);
  });

  it("keeps timeUnit days when maxTime < 730", () => {
    const points = [
      { time_days: 30, survival_prob: 0.97, at_risk: 95, events: 3 },
    ];
    const { result } = renderHook(() =>
      useEndpointProfileKmData(points, 100, "E4_DM2"),
    );
    expect(result.current.timeUnit).toBe("days");
    expect(result.current.targetCurve[0].time).toBe(30);
  });

  it("returns empty comparator curve and undefined comparatorLabel (D-13 adapter contract)", () => {
    const { result } = renderHook(() =>
      useEndpointProfileKmData([], 0, "E4_DM2"),
    );
    expect(result.current.comparatorCurve).toEqual([]);
    expect(result.current.comparatorLabel).toBeUndefined();
    expect(result.current.targetLabel).toBe("E4_DM2");
    expect(result.current.showCI).toBe(false);
    expect(result.current.interactive).toBe(false);
  });
});

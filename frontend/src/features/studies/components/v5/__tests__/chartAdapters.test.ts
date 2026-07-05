import { describe, expect, it } from "vitest";
import { toRidgeSeries, toTrellisRows } from "../charts/chartAdapters";

describe("toRidgeSeries", () => {
  it("parses valid KDE series and preserves points", () => {
    const series = toRidgeSeries([
      { group: "Timely", timepoint: "t1", points: [[100, 0.1], [150, 0.9]] },
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].group).toBe("Timely");
    expect(series[0].timepoint).toBe("t1");
    expect(series[0].points).toEqual([[100, 0.1], [150, 0.9]]);
  });

  it("drops malformed points and empty series", () => {
    const series = toRidgeSeries([
      { group: "A", timepoint: "t1", points: [[100, 0.1], [150], "nope", [null, 0.2]] },
      { group: "B", timepoint: "t1", points: [] },
      { group: "C", timepoint: "t1", points: "bad" },
    ]);
    // A keeps only its one well-formed point; B and C are dropped entirely
    expect(series).toHaveLength(1);
    expect(series[0].group).toBe("A");
    expect(series[0].points).toEqual([[100, 0.1]]);
  });

  it("returns an empty array for non-array input", () => {
    expect(toRidgeSeries(undefined)).toEqual([]);
    expect(toRidgeSeries({})).toEqual([]);
  });
});

describe("toTrellisRows", () => {
  it("maps the three timepoints", () => {
    const rows = toTrellisRows([{ group: "Delayed", t1: 151, t2: 147, t_dx: 142 }]);
    expect(rows).toEqual([{ group: "Delayed", t1: 151, t2: 147, t_dx: 142 }]);
  });

  it("filters rows without a group and defaults missing timepoints to 0", () => {
    const rows = toTrellisRows([
      { t1: 1, t2: 2, t_dx: 3 },
      { group: "OK" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ group: "OK", t1: 0, t2: 0, t_dx: 0 });
  });
});

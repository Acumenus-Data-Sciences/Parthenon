// SP3 close-out — assert the real display.json shapes the four bespoke R workers
// produce on PANCROS are consumed correctly. We split into two groups:
//   1. Render smoke through ResultViewerSwitch (Demographics / CodeWAS / timeCodeWAS).
//   2. Shape validation for Overlaps — UpSet's jsdom rendering is brittle so we
//      assert the display.json payload matches OverlapsDisplay without rendering.
// Fixtures captured from succeeded smoke runs on 2026-04-16.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ResultViewerSwitch } from "../components/results/ResultViewerSwitch";
import type { CO2ModuleKey, OverlapsDisplay } from "../types";

import demographics from "./fixtures/demographics.display.json";
import overlaps from "./fixtures/overlaps.display.json";
import codewas from "./fixtures/codewas.display.json";
import timeCodewas from "./fixtures/time_codewas.display.json";

type RenderCase = { module: CO2ModuleKey; display: unknown; label: string };

const renderCases: RenderCase[] = [
  { module: "co2.demographics",  display: demographics, label: "Demographics (PANCREAS 221/222/223)" },
  { module: "co2.codewas",       display: codewas,      label: "CodeWAS (PANCREAS 222 vs 223)" },
  { module: "co2.time_codewas",  display: timeCodewas,  label: "timeCodeWAS (PANCREAS 222 vs 223, 3 windows)" },
];

describe("SP3 real-display fixtures", () => {
  for (const { module, display, label } of renderCases) {
    it(`renders ${module} from real worker output — ${label}`, () => {
      const { container } = render(
        <ResultViewerSwitch moduleKey={module} display={display as never} />,
      );
      expect(container.firstChild).not.toBeNull();
    });
  }

  it("Overlaps fixture matches OverlapsDisplay shape (PANCREAS 221/222/223)", () => {
    const d = overlaps as OverlapsDisplay;
    expect(Array.isArray(d.sets)).toBe(true);
    expect(d.sets.length).toBeGreaterThanOrEqual(2);
    for (const s of d.sets) {
      expect(typeof s.cohort_id).toBe("number");
      expect(typeof s.cohort_name).toBe("string");
      expect(typeof s.size).toBe("number");
    }
    expect(Array.isArray(d.intersections)).toBe(true);
    for (const ix of d.intersections) {
      expect(Array.isArray(ix.members)).toBe(true); // never a scalar — the I(members) fix
      expect(typeof ix.size).toBe("number");
      expect(ix.degree).toBe(ix.members.length);
    }
    expect(Array.isArray(d.matrix)).toBe(true);
    expect(d.matrix.length).toBe(d.sets.length);
    expect(typeof d.summary.max_overlap_pct).toBe("number");
  });
});

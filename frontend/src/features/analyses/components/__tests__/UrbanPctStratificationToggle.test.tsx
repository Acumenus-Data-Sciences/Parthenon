import { describe, expect, it } from 'vitest';

// Phase 19 Wave 0 RED — Plan 04 will add the urban_pct stratification dropdown
// to IncidenceRateDesigner. This test asserts the file exports
// STRATIFY_BY_LOCATION_OPTIONS (a const list used in the new
// design_json.stratifyByLocation field). Per Phase 18-01 STATE.md
// precedent: dynamic import() triggers Vite import-analysis at transform
// time, which catches the missing export before runtime.

describe('Phase 19 — IncidenceRateDesigner urban_pct toggle (GIS-03)', () => {
  it('IncidenceRateDesigner module exports STRATIFY_BY_LOCATION_OPTIONS including urban_pct', async () => {
    const mod = await import('../IncidenceRateDesigner');
    expect(mod).toHaveProperty('STRATIFY_BY_LOCATION_OPTIONS');
    const options = (mod as { STRATIFY_BY_LOCATION_OPTIONS: readonly string[] })
      .STRATIFY_BY_LOCATION_OPTIONS;
    expect(options).toContain('urban_pct');
    expect(options).toContain('none');
  });

  it('STRATIFY_BY_LOCATION_OPTIONS contains every enum value validated by IncidenceRateController (GIS-03)', async () => {
    const mod = await import('../IncidenceRateDesigner');
    const options = (mod as { STRATIFY_BY_LOCATION_OPTIONS: readonly string[] })
      .STRATIFY_BY_LOCATION_OPTIONS;
    // Plan 04 FormRequest validates: Rule::in(['none','urban_pct','rucc'])
    expect(options).toEqual(expect.arrayContaining(['none', 'urban_pct', 'rucc']));
    expect(options.length).toBeGreaterThanOrEqual(3);
  });
});

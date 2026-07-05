import { num, str } from "../narrow";

export interface RidgeSeries {
  group: string;
  timepoint: string;
  points: Array<[number, number]>;
}

export interface TrellisRow {
  group: string;
  t1: number;
  t2: number;
  t_dx: number;
}

/** Adapt the compact N `kde` payload into ridgeline series. */
export function toRidgeSeries(kde: unknown): RidgeSeries[] {
  if (!Array.isArray(kde)) return [];
  return kde
    .map((entry) => {
      const rec = entry as Record<string, unknown>;
      const rawPoints = Array.isArray(rec.points) ? rec.points : [];
      const points = rawPoints
        .map((p): [number, number] | null => {
          if (!Array.isArray(p) || p.length < 2) return null;
          const x = num(p[0]);
          const y = num(p[1]);
          return x === null || y === null ? null : [x, y];
        })
        .filter((p): p is [number, number] => p !== null);
      return { group: str(rec.group), timepoint: str(rec.timepoint), points };
    })
    .filter((s) => s.points.length > 0);
}

/** Adapt the compact N `trellis` payload into trellis rows. */
export function toTrellisRows(trellis: unknown): TrellisRow[] {
  if (!Array.isArray(trellis)) return [];
  return trellis
    .map((entry) => {
      const rec = entry as Record<string, unknown>;
      return {
        group: str(rec.group),
        t1: num(rec.t1) ?? 0,
        t2: num(rec.t2) ?? 0,
        t_dx: num(rec.t_dx) ?? 0,
      };
    })
    .filter((r) => r.group !== "");
}

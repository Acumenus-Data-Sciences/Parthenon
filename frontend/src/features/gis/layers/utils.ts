import type { LayerChoroplethItem } from "./types";

/**
 * Normalizes raw choropleth rows from the API:
 * - Parses geometry from JSON string to object
 * - Maps a layer-specific value field to the standard `value` key
 */
export function normalizeChoropleth(
  rows: Record<string, unknown>[],
  valueField: string
): LayerChoroplethItem[] {
  return rows.map((row) => ({
    ...row,
    value: Number(row[valueField]) || 0,
    geometry:
      typeof row.geometry === "string"
        ? JSON.parse(row.geometry)
        : (row.geometry as GeoJSON.Geometry | null) ?? null,
  })) as LayerChoroplethItem[];
}

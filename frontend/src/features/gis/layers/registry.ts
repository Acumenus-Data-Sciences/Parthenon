import type { GisLayer } from "./types";
import { localizeGisLayer } from "../lib/i18n";

/**
 * Central registry of all available GIS layers.
 * Layers self-register via registerLayer() when their modules are imported.
 *
 * IMPORTANT: Do NOT add side-effect imports here — it creates a circular
 * dependency (registry → layer → registry). Instead, import the init
 * module from the consuming page/component.
 */
const layers: GisLayer[] = [];

export function registerLayer(layer: GisLayer): void {
  if (!layers.find((l) => l.id === layer.id)) {
    layers.push(layer);
  }
}

export function getLayers(): readonly GisLayer[] {
  return layers.map((layer) => localizeGisLayer(layer));
}

export function getLayer(id: string): GisLayer | undefined {
  const layer = layers.find((l) => l.id === id);
  return layer ? localizeGisLayer(layer) : undefined;
}

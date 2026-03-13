import type { GisLayer } from "./types";

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
  return layers;
}

export function getLayer(id: string): GisLayer | undefined {
  return layers.find((l) => l.id === id);
}

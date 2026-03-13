/**
 * Side-effect imports that register all GIS layers.
 * Import this module once from GisPage to trigger registration.
 *
 * Separated from registry.ts to avoid circular dependencies:
 * registry.ts exports registerLayer → layer modules import it →
 * if registry.ts also imported layer modules, it would be circular.
 */
import "./svi";
import "./rucc";
import "./comorbidity";
import "./air-quality";
import "./hospital-access";

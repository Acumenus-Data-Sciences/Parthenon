import type { Study } from "../../types/study";
import { StudyDesignerWizard } from "./StudyDesignerWizard";

// Phase 3 — CompilerWorkbench is now a thin wrapper that mounts the
// inline Study Designer Wizard. The legacy rail/strip/peripheral chrome
// (PipelineRail, IdentityStrip, VersionTimeline, narrow-banner,
// wb-compat-bridge) has been deleted; navigation, validation, and step
// content all live inside <StudyDesignerWizard>.
//
// Kept as a wrapper for now so the `v2Enabled` flag in StudyDetailPage
// keeps a stable mount point. Can be inlined later in a cosmetic cleanup.
//
// Dead CSS removal (studies-v2-rail/strip/periph/spine/station-arc/
// lock-rivet, etc.) is intentionally deferred to a follow-up housekeeping
// commit so this change stays diff-focused.

interface CompilerWorkbenchProps {
  study: Study;
}

export function CompilerWorkbench({ study }: CompilerWorkbenchProps) {
  return <StudyDesignerWizard study={study} />;
}

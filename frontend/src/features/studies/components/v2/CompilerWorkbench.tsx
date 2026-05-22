import type { Study } from "../../types/study";
import { StudyDesignerWizard } from "./StudyDesignerWizard";

// CompilerWorkbench is a thin wrapper that mounts the inline Study Designer
// Wizard. The legacy rail/strip/peripheral chrome (PipelineRail, IdentityStrip,
// VersionTimeline) and its entire bespoke skin (studies-v2.css) have been
// deleted; navigation, validation, and step content all live inside
// <StudyDesignerWizard>, and the 8 stage bodies now use gold-standard Tailwind
// tokens (matching the cohort-definitions wizard) instead of the old
// `.studies-v2-root`-scoped compiler aesthetic.
//
// Kept as a wrapper so the `v2Enabled` flag in StudyDetailPage keeps a stable
// mount point. Can be inlined later in a cosmetic cleanup.

interface CompilerWorkbenchProps {
  study: Study;
}

export function CompilerWorkbench({ study }: CompilerWorkbenchProps) {
  return <StudyDesignerWizard study={study} />;
}

export type ToolsetStatus = "available" | "coming_soon" | "sdk_required";

export interface ToolsetDescriptor {
  /** URL slug — used in /workbench/:slug route */
  slug: string;
  /** Display name */
  name: string;
  /** One-line tagline shown on the card */
  tagline: string;
  /** 2-3 sentence description for the expanded card */
  description: string;
  /** Lucide icon name (rendered by the card) */
  icon: string;
  /** Accent color hex for the card border/glow */
  accent: string;
  /** Current availability */
  status: ToolsetStatus;
  /** Route path — null if coming_soon or sdk_required */
  route: string | null;
  /** Optional badge text (e.g. "MIMIC-IV", "StudyAgent") */
  badge?: string;
  /** Whether this toolset requires VITE_STUDY_AGENT_ENABLED */
  requiresStudyAgent?: boolean;
}

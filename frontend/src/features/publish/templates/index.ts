import type { SectionType, DiagramType } from "../types/publish";
import { GENERIC_OHDSI_TEMPLATE } from "./generic-ohdsi";
import { COMPARATIVE_EFFECTIVENESS_TEMPLATE } from "./comparative-effectiveness";
import { INCIDENCE_REPORT_TEMPLATE } from "./incidence-report";
import { STUDY_PROTOCOL_TEMPLATE } from "./study-protocol";
import { JAMIA_STYLE_TEMPLATE } from "./jamia-style";
import { NEJM_STYLE_TEMPLATE } from "./nejm-style";

// ── Template types ──────────────────────────────────────────────────────────

export interface TemplateSectionDef {
  id: string;
  title: string;
  type: SectionType;
  analysisType?: string;
  diagramType?: DiagramType;
  narrativeIncluded?: boolean;
  tableIncluded?: boolean;
}

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  sections: TemplateSectionDef[];
  usesResults: boolean;
  preferredAnalysisTypes?: string[];
}

// ── Registry ────────────────────────────────────────────────────────────────

export const TEMPLATES: Record<string, TemplateConfig> = {
  [GENERIC_OHDSI_TEMPLATE.id]: GENERIC_OHDSI_TEMPLATE,
  [COMPARATIVE_EFFECTIVENESS_TEMPLATE.id]: COMPARATIVE_EFFECTIVENESS_TEMPLATE,
  [INCIDENCE_REPORT_TEMPLATE.id]: INCIDENCE_REPORT_TEMPLATE,
  [STUDY_PROTOCOL_TEMPLATE.id]: STUDY_PROTOCOL_TEMPLATE,
  [JAMIA_STYLE_TEMPLATE.id]: JAMIA_STYLE_TEMPLATE,
  [NEJM_STYLE_TEMPLATE.id]: NEJM_STYLE_TEMPLATE,
};

/** Ordered list for the template dropdown */
export const TEMPLATE_LIST: TemplateConfig[] = [
  GENERIC_OHDSI_TEMPLATE,
  NEJM_STYLE_TEMPLATE,
  JAMIA_STYLE_TEMPLATE,
  COMPARATIVE_EFFECTIVENESS_TEMPLATE,
  INCIDENCE_REPORT_TEMPLATE,
  STUDY_PROTOCOL_TEMPLATE,
];

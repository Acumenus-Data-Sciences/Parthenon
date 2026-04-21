import type { AnalysisTypeDescriptor } from "./types";

export const CLINICAL_ANALYSIS_REGISTRY: AnalysisTypeDescriptor[] = [
  {
    type: "characterization",
    group: "characterize",
    icon: "Users",
    apiPrefix: "characterizations",
  },
  {
    type: "incidence_rate",
    group: "characterize",
    icon: "TrendingUp",
    apiPrefix: "incidence-rates",
  },
  {
    type: "pathway",
    group: "characterize",
    icon: "GitBranch",
    apiPrefix: "pathways",
  },
  {
    type: "estimation",
    group: "compare",
    icon: "Scale",
    apiPrefix: "estimations",
  },
  {
    type: "sccs",
    group: "compare",
    icon: "Repeat",
    apiPrefix: "sccs",
  },
  {
    type: "evidence_synthesis",
    group: "compare",
    icon: "Layers",
    apiPrefix: "evidence-synthesis",
  },
  {
    type: "prediction",
    group: "predict",
    icon: "Brain",
    apiPrefix: "predictions",
  },
];

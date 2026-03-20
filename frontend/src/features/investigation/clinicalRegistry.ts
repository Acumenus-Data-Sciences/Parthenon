import type { AnalysisTypeDescriptor } from "./types";

export const CLINICAL_ANALYSIS_REGISTRY: AnalysisTypeDescriptor[] = [
  // Characterize group
  {
    type: "characterization",
    group: "characterize",
    name: "Cohort Characterization",
    description:
      "Baseline demographics, comorbidities, drug utilization, and temporal patterns for target and comparator cohorts.",
    icon: "Users",
    prerequisites: ["At least one cohort defined"],
    estimatedTime: "2-5 min",
    apiPrefix: "characterizations",
  },
  {
    type: "incidence_rate",
    group: "characterize",
    name: "Incidence Rate Analysis",
    description:
      "Calculate incidence rates with exact Poisson confidence intervals, stratified by age, sex, or calendar year.",
    icon: "TrendingUp",
    prerequisites: ["Target cohort", "Outcome cohort"],
    estimatedTime: "1-3 min",
    apiPrefix: "incidence-rates",
  },
  {
    type: "pathway",
    group: "characterize",
    name: "Treatment Pathway",
    description:
      "Visualize sequential treatment patterns and drug utilization trajectories within a cohort.",
    icon: "GitBranch",
    prerequisites: ["Target cohort"],
    estimatedTime: "2-5 min",
    apiPrefix: "pathways",
  },
  // Compare group
  {
    type: "estimation",
    group: "compare",
    name: "Comparative Effectiveness",
    description:
      "Population-level effect estimation using CohortMethod — propensity score matching/stratification with Cox models.",
    icon: "Scale",
    prerequisites: ["Target cohort", "Comparator cohort", "Outcome cohort"],
    estimatedTime: "10-45 min",
    apiPrefix: "estimations",
  },
  {
    type: "sccs",
    group: "compare",
    name: "Self-Controlled Case Series",
    description:
      "Within-person comparison of event rates during exposed vs. unexposed time windows.",
    icon: "Repeat",
    prerequisites: ["Exposure cohort", "Outcome cohort"],
    estimatedTime: "5-15 min",
    apiPrefix: "sccs",
  },
  {
    type: "evidence_synthesis",
    group: "compare",
    name: "Evidence Synthesis",
    description:
      "Fixed-effect or Bayesian random-effects meta-analysis pooling estimates from multiple analyses.",
    icon: "Layers",
    prerequisites: ["2+ completed estimations"],
    estimatedTime: "< 1 min",
    apiPrefix: "evidence-synthesis",
  },
  // Predict group
  {
    type: "prediction",
    group: "predict",
    name: "Patient-Level Prediction",
    description:
      "Train ML models (LASSO, gradient boosting, random forest, deep learning) to predict outcomes.",
    icon: "Brain",
    prerequisites: ["Target cohort", "Outcome cohort"],
    estimatedTime: "15-60 min",
    apiPrefix: "predictions",
  },
];

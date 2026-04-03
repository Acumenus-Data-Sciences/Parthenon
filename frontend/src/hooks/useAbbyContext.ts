import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAbbyStore } from "@/stores/abbyStore";

const ROUTE_CONTEXT_MAP: [RegExp, string, string][] = [
  [/^\/cohort-definitions\/\d+/, "cohort_builder", "Cohort Builder"],
  [/^\/cohort-definitions/, "cohort_list", "Cohort Definitions"],
  [/^\/concept-sets\/\d+/, "concept_set_editor", "Concept Set Editor"],
  [/^\/concept-sets/, "concept_set_list", "Concept Sets"],
  [/^\/data-sources\/\d+/, "data_explorer", "Data Explorer"],
  [/^\/data-explorer/, "data_explorer", "Data Explorer"],
  [/^\/data-sources/, "data_sources", "Data Sources"],
  [/^\/analyses/, "analyses", "Analyses"],
  [/^\/genomics/, "genomics", "Genomics"],
  [/^\/imaging/, "imaging", "Imaging"],
  [/^\/heor/, "heor", "Health Economics"],
  [/^\/data-quality/, "data_quality", "Data Quality"],
  [/^\/admin/, "administration", "Administration"],
  [/^\/studies/, "studies", "Studies"],
  [/^\/study-designer/, "studies", "Study Designer"],
  [/^\/study-packages/, "study_packages", "Study Packages"],
  [/^\/vocabulary/, "vocabulary", "Vocabulary"],
  [/^\/mapping-assistant/, "mapping_assistant", "Mapping Assistant"],
  [/^\/incidence-rates/, "incidence_rates", "Incidence Rates"],
  [/^\/estimation/, "estimation", "Estimation"],
  [/^\/prediction/, "prediction", "Prediction"],
  [/^\/profiles/, "patient_profiles", "Patient Profiles"],
  [/^\/patient-similarity/, "patient_similarity", "Patient Similarity"],
  [/^\/risk-scores/, "risk_scores", "Risk Scores"],
  [/^\/standard-pros/, "standard_pros", "Standard PROs+"],
  [/^\/morpheus/, "morpheus", "Morpheus"],
  [/^\/ingestion/, "data_ingestion", "Data Ingestion"],
  [/^\/care-gaps/, "care_gaps", "Care Gaps"],
  [/^\/care-bundles/, "care_gaps", "Care Gaps"],
  [/^\/jobs/, "jobs", "Jobs"],
  [/^\/gis/, "gis", "GIS Explorer"],
  [/^\/query-assistant/, "query_assistant", "Query Assistant"],
  [/^\/commons/, "commons", "Commons"],
  [/^\/phenotype-library/, "phenotype_library", "Phenotype Library"],
  [/^\/workbench/, "workbench", "Workbench"],
  [/^\/publish/, "publish", "Publish"],
  [/^\/settings/, "settings", "Settings"],
  [/^\/jupyter/, "jupyter", "Jupyter"],
  [/^\/source-profiler/, "etl_tools", "Source Profiler"],
  [/^\/fhir-ingestion/, "etl_tools", "FHIR Ingestion"],
  [/^\/etl-tools/, "etl_tools", "ETL Tools"],
  [/^\/$/, "dashboard", "Dashboard"],
];

export function useAbbyContext(): { pageContext: string; pageName: string } {
  const location = useLocation();
  const setPageContext = useAbbyStore((s) => s.setPageContext);
  const pageContext = useAbbyStore((s) => s.pageContext);

  useEffect(() => {
    const path = location.pathname;
    for (const [pattern, ctx] of ROUTE_CONTEXT_MAP) {
      if (pattern.test(path)) {
        setPageContext(ctx);
        return;
      }
    }
    setPageContext("general");
  }, [location.pathname, setPageContext]);

  const match = ROUTE_CONTEXT_MAP.find(([pattern]) =>
    pattern.test(location.pathname),
  );

  return {
    pageContext,
    pageName: match?.[2] ?? "General",
  };
}

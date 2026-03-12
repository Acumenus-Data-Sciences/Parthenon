import apiClient from "@/lib/api-client";
import type {
  PhenotypeSearchResult,
  PhenotypeRecommendation,
  IntentSplitResult,
  LintWarning,
  CombinedLintResult,
  ConceptSetFinding,
  StudyAgentHealth,
} from "./types";

export type {
  PhenotypeSearchResult,
  PhenotypeRecommendation,
  IntentSplitResult,
  LintWarning,
  CombinedLintResult,
  ConceptSetFinding,
  StudyAgentHealth,
};

export async function fetchStudyAgentHealth(): Promise<StudyAgentHealth> {
  const { data } = await apiClient.get("/study-agent/health");
  return data.data;
}

export async function searchPhenotypes(
  query: string,
  topK = 10
): Promise<PhenotypeSearchResult[]> {
  const { data } = await apiClient.post("/study-agent/phenotype/search", {
    query,
    top_k: topK,
  });
  return data.data?.results ?? data.data ?? [];
}

export async function recommendPhenotypes(
  studyIntent: string,
  searchResults: PhenotypeSearchResult[] = []
): Promise<PhenotypeRecommendation[]> {
  const { data } = await apiClient.post("/study-agent/phenotype/recommend", {
    study_intent: studyIntent,
    search_results: searchResults,
  });
  return data.data?.recommendations ?? data.data ?? [];
}

export async function splitIntent(
  intent: string
): Promise<IntentSplitResult> {
  const { data } = await apiClient.post("/study-agent/intent/split", {
    intent,
  });
  return data.data;
}

export async function lintCohort(
  cohortDefinition: Record<string, unknown>
): Promise<LintWarning[]> {
  const { data } = await apiClient.post("/study-agent/cohort/lint", {
    cohort_definition: cohortDefinition,
  });
  return data.data?.warnings ?? data.data ?? [];
}

export async function reviewConceptSet(
  conceptSet: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data } = await apiClient.post("/study-agent/concept-set/review", {
    concept_set: conceptSet,
  });
  return data.data;
}

export async function improvePhenotype(
  cohortDefinition: Record<string, unknown>,
  studyIntent = ""
): Promise<Record<string, unknown>> {
  const { data } = await apiClient.post("/study-agent/phenotype/improve", {
    cohort_definition: cohortDefinition,
    study_intent: studyIntent,
  });
  return data.data;
}

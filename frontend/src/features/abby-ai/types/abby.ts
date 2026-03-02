export interface AbbyBuildRequest {
  prompt: string;
  source_id?: number;
}

export interface AbbyBuildResponse {
  expression: Record<string, unknown>;
  explanation: string;
  concept_sets: ConceptSetSuggestion[];
  warnings: string[];
}

export interface ConceptSetSuggestion {
  name: string;
  concepts: {
    concept_id: number;
    concept_name: string;
    domain: string;
    standard_concept: string;
  }[];
}

export interface AbbySuggestRequest {
  domain: string;
  description: string;
}

export interface AbbySuggestResponse {
  suggestions: {
    concept_id: number;
    concept_name: string;
    domain: string;
    vocabulary_id: string;
    score: number;
  }[];
}

export interface AbbyExplainResponse {
  explanation: string;
}

export interface AbbyRefineRequest {
  expression: Record<string, unknown>;
  prompt: string;
}

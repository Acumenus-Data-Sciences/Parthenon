import { useMutation } from "@tanstack/react-query";
import {
  buildCohort,
  suggestCriteria,
  explainExpression,
  refineCohort,
} from "../api/abbyApi";
import type {
  AbbyBuildRequest,
  AbbySuggestRequest,
  AbbyRefineRequest,
} from "../types/abby";

export function useBuildCohort() {
  return useMutation({
    mutationFn: (data: AbbyBuildRequest) => buildCohort(data),
  });
}

export function useSuggestCriteria() {
  return useMutation({
    mutationFn: (data: AbbySuggestRequest) => suggestCriteria(data),
  });
}

export function useExplainExpression() {
  return useMutation({
    mutationFn: (expression: Record<string, unknown>) =>
      explainExpression(expression),
  });
}

export function useRefineCohort() {
  return useMutation({
    mutationFn: (data: AbbyRefineRequest) => refineCohort(data),
  });
}

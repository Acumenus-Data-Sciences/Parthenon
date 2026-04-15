import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { makeIdempotencyKey } from "@/features/_finngen-foundation";
import type { FinnGenRun } from "@/features/_finngen-foundation";

import { codeExplorerApi } from "../api";

type CreateReportInput = { sourceKey: string; conceptId: number };

export function useCreateReport() {
  const qc = useQueryClient();
  const [idempotencyKey, setIdempotencyKey] = useState(() => makeIdempotencyKey());

  const resetIdempotencyKey = useCallback(() => {
    setIdempotencyKey(makeIdempotencyKey());
  }, []);

  const mutation = useMutation<FinnGenRun, Error, CreateReportInput>({
    mutationFn: ({ sourceKey, conceptId }) =>
      codeExplorerApi.createReport(sourceKey, conceptId, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finngen", "code-explorer", "my-reports"] });
    },
  });

  return { ...mutation, idempotencyKey, resetIdempotencyKey };
}

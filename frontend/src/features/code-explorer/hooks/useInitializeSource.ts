import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { makeIdempotencyKey } from "@/features/_finngen-foundation";
import type { FinnGenRun } from "@/features/_finngen-foundation";

import { codeExplorerApi } from "../api";

export function useInitializeSource() {
  const qc = useQueryClient();
  const [idempotencyKey, setIdempotencyKey] = useState(() => makeIdempotencyKey());

  const resetIdempotencyKey = useCallback(() => {
    setIdempotencyKey(makeIdempotencyKey());
  }, []);

  const mutation = useMutation<FinnGenRun, Error, { sourceKey: string }>({
    mutationFn: ({ sourceKey }) =>
      codeExplorerApi.initializeSource(sourceKey, idempotencyKey),
    onSuccess: (_data, { sourceKey }) => {
      qc.invalidateQueries({ queryKey: ["finngen", "code-explorer", "source-readiness", sourceKey] });
    },
  });

  return { ...mutation, idempotencyKey, resetIdempotencyKey };
}

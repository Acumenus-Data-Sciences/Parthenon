import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { finngenApi } from "../api";
import type { CreateFinnGenRunBody, FinnGenRun } from "../types";
import { makeIdempotencyKey } from "../utils/idempotencyKey";

/**
 * Creates a FinnGen run with a stable Idempotency-Key for the lifetime of
 * the component instance. Re-renders and TanStack retries reuse the same
 * key; a fresh key is minted each time the consumer explicitly calls
 * `resetIdempotencyKey()`.
 */
export function useCreateFinnGenRun() {
  const qc = useQueryClient();
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => makeIdempotencyKey());

  const mutation = useMutation<FinnGenRun, Error, CreateFinnGenRunBody>({
    mutationFn: (body) => finngenApi.createRun(body, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finngen", "run"] });
    },
  });

  const resetIdempotencyKey = useCallback(() => {
    setIdempotencyKey(makeIdempotencyKey());
  }, []);

  return { ...mutation, resetIdempotencyKey, idempotencyKey };
}

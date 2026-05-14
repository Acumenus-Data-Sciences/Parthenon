import { useCallback, useState } from "react";
import { usePromoteItem } from "../api/lifecycleApi";
import type { LibraryEntity, RequiresPromotionPayload } from "../types";

export interface UseAutoPromoteOn409<TArgs> {
  attempt: (args: TArgs) => Promise<void>;
  pendingPayload: RequiresPromotionPayload | null;
  confirm: () => Promise<void>;
  cancel: () => void;
  isPromoting: boolean;
}

/**
 * Wraps an attach mutation. If the attach 409s with `requires_promotion`,
 * captures the payload and exposes a `confirm()` that promotes the draft
 * then re-runs the attach. From the caller's view this is atomic.
 */
export function useAutoPromoteOn409<TArgs>(
  entity: LibraryEntity,
  attachFn: (args: TArgs) => Promise<unknown>,
): UseAutoPromoteOn409<TArgs> {
  const [pendingPayload, setPendingPayload] =
    useState<RequiresPromotionPayload | null>(null);
  const [pendingArgs, setPendingArgs] = useState<TArgs | null>(null);
  const promote = usePromoteItem(entity);

  const attempt = useCallback(
    async (args: TArgs) => {
      try {
        await attachFn(args);
      } catch (err) {
        const e = err as {
          response?: { status?: number; data?: RequiresPromotionPayload };
        };
        if (
          e.response?.status === 409 &&
          e.response.data?.requires_promotion
        ) {
          setPendingPayload(e.response.data);
          setPendingArgs(args);
          return;
        }
        throw err;
      }
    },
    [attachFn],
  );

  const confirm = useCallback(async () => {
    if (!pendingPayload || pendingArgs === null) return;
    await promote.mutateAsync(pendingPayload.item_id);
    await attachFn(pendingArgs);
    setPendingPayload(null);
    setPendingArgs(null);
  }, [attachFn, pendingArgs, pendingPayload, promote]);

  const cancel = useCallback(() => {
    setPendingPayload(null);
    setPendingArgs(null);
  }, []);

  return {
    attempt,
    pendingPayload,
    confirm,
    cancel,
    isPromoting: promote.isPending,
  };
}

import { useState } from "react";
import { useLifecycleMutations } from "../hooks/useLifecycleActions";
import { LifecycleStatusBadge } from "./LifecycleStatusBadge";
import { LifecycleActionMenu, type LifecycleAction } from "./LifecycleActionMenu";
import { LifecycleConfirmModal } from "./LifecycleConfirmModal";
import type { LibraryEntity, LibraryStatus } from "../types";

interface Props {
  entity: LibraryEntity;
  id: number;
  status: LibraryStatus;
  name?: string | null;
  /** When false, only the badge renders. */
  canEdit?: boolean;
  /** Called after a successful mutation so the parent can refetch detail. */
  onChanged?: (newStatus: LibraryStatus) => void;
  className?: string;
}

export function LifecycleHeaderControl({
  entity,
  id,
  status,
  name,
  canEdit = true,
  onChanged,
  className,
}: Props) {
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(
    null,
  );
  const { promote, archive, restore } = useLifecycleMutations(entity);

  const activeMutation =
    pendingAction === "promote"
      ? promote
      : pendingAction === "archive"
        ? archive
        : pendingAction === "restore"
          ? restore
          : null;

  function handleConfirm() {
    if (!pendingAction) return;
    const mut =
      pendingAction === "promote"
        ? promote
        : pendingAction === "archive"
          ? archive
          : restore;
    mut.mutate(id, {
      onSuccess: (res) => {
        setPendingAction(null);
        onChanged?.(res.status);
      },
    });
  }

  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1.5">
        <LifecycleStatusBadge status={status} />
        {canEdit && (
          <LifecycleActionMenu
            status={status}
            onAction={(a) => setPendingAction(a)}
          />
        )}
      </div>

      <LifecycleConfirmModal
        open={pendingAction !== null}
        action={pendingAction ?? "archive"}
        itemName={name}
        isPending={activeMutation?.isPending ?? false}
        onConfirm={handleConfirm}
        onClose={() => {
          if (!activeMutation?.isPending) setPendingAction(null);
        }}
      />
    </div>
  );
}

import { useDeleteMessage } from "../../api";
import { Modal } from "@/components/ui/Modal";

interface DeleteConfirmationProps {
  messageId: number;
  onCancel: () => void;
  onDeleted: () => void;
}

export function DeleteConfirmation({
  messageId,
  onCancel,
  onDeleted,
}: DeleteConfirmationProps) {
  const deleteMessage = useDeleteMessage();

  function handleDelete() {
    deleteMessage.mutate(messageId, {
      onSuccess: () => onDeleted(),
    });
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title="Delete Message"
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={deleteMessage.isPending}
          >
            {deleteMessage.isPending ? "Deleting…" : "Delete"}
          </button>
        </>
      }
    >
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
        This message will be removed from the conversation. This action cannot be undone.
      </p>
    </Modal>
  );
}

import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("commons");
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
      title={t("chat.deleteConfirm.title")}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>
            {t("chat.deleteConfirm.cancel")}
          </button>
          <button
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={deleteMessage.isPending}
          >
            {deleteMessage.isPending
              ? t("chat.deleteConfirm.deleting")
              : t("chat.deleteConfirm.delete")}
          </button>
        </>
      }
    >
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
        {t("chat.deleteConfirm.body")}
      </p>
    </Modal>
  );
}

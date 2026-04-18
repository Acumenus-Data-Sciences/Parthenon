import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateMessage } from "../../api";

interface EditMessageInlineProps {
  messageId: number;
  originalBody: string;
  slug: string;
  onCancel: () => void;
  onSaved: () => void;
}

export function EditMessageInline({
  messageId,
  originalBody,
  slug,
  onCancel,
  onSaved,
}: EditMessageInlineProps) {
  const { t } = useTranslation("commons");
  const [body, setBody] = useState(originalBody);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateMessage = useUpdateMessage();

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  function handleSave() {
    const trimmed = body.trim();
    if (!trimmed || trimmed === originalBody) {
      onCancel();
      return;
    }
    updateMessage.mutate(
      { id: messageId, body: trimmed, slug },
      { onSuccess: () => onSaved() },
    );
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <div className="mt-1">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        className="w-full resize-none rounded-md border border-border bg-muted p-2 text-sm text-foreground focus:border-primary focus:outline-none"
      />
      <div className="mt-1 flex gap-2">
        <button
          onClick={onCancel}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("chat.edit.cancel")}
        </button>
        <button
          onClick={handleSave}
          disabled={updateMessage.isPending}
          className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t("chat.edit.save")}
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t("chat.edit.helper")}
      </p>
    </div>
  );
}

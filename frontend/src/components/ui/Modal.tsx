import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  footer,
  children,
  className,
}: ModalProps) {
  const { t } = useTranslation("common");
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handleEsc);

    // Focus the shell once on open without stealing focus on subsequent rerenders.
    modalRef.current?.focus();

    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-container">
        <div
          ref={modalRef}
          className={cn(
            "modal",
            size === "sm" && "modal-sm",
            size === "lg" && "modal-lg",
            size === "xl" && "modal-xl",
            size === "full" && "modal-full",
            className,
          )}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
        >
          {title && (
            <div className="modal-header">
              <h2 className="modal-title">{title}</h2>
              <button
                className="modal-close"
                onClick={onClose}
                aria-label={t("ui.aria.close")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    </>,
    document.body,
  );
}

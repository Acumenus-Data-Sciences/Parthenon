import { useEffect, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "warning" | "error" | "info";

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
}

const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  error: <AlertCircle size={16} />,
  info: <Info size={16} />,
};

// Simple toast store
let listeners: Array<(toasts: ToastMessage[]) => void> = [];
let toasts: ToastMessage[] = [];

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export const toast = {
  show(variant: ToastVariant, message: string, duration = 5000) {
    const id = crypto.randomUUID();
    toasts = [...toasts, { id, variant, message, duration }];
    notify();
    if (duration > 0) {
      setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        notify();
      }, duration);
    }
  },
  success(message: string) { this.show("success", message); },
  warning(message: string) { this.show("warning", message); },
  error(message: string) { this.show("error", message); },
  info(message: string) { this.show("info", message); },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
};

export function ToastContainer() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);

  const dismiss = useCallback((id: string) => toast.dismiss(id), []);

  if (items.length === 0) return null;

  return createPortal(
    <div className="toast-container">
      {items.map((t) => (
        <div key={t.id} className={cn("toast", `toast-${t.variant}`)}>
          <span className="toast-icon">{icons[t.variant]}</span>
          <span className="toast-message">{t.message}</span>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

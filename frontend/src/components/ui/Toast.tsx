import { useEffect, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "warning" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
  action?: ToastAction;
}

const MAX_TOASTS = 3;

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
  show(variant: ToastVariant, message: string, duration = 5000, action?: ToastAction) {
    const id = crypto.randomUUID();
    // Drop the oldest toast when at capacity
    const capped = toasts.length >= MAX_TOASTS ? toasts.slice(toasts.length - MAX_TOASTS + 1) : toasts;
    toasts = [...capped, { id, variant, message, duration, action }];
    notify();
    if (duration > 0) {
      setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        notify();
      }, duration);
    }
  },
  success(message: string, action?: ToastAction) { this.show("success", message, 5000, action); },
  warning(message: string, action?: ToastAction) { this.show("warning", message, 5000, action); },
  error(message: string, action?: ToastAction) { this.show("error", message, 5000, action); },
  info(message: string, action?: ToastAction) { this.show("info", message, 5000, action); },
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
          {t.action && (
            <button
              className="toast-action"
              onClick={() => { t.action!.onClick(); dismiss(t.id); }}
            >
              {t.action.label}
            </button>
          )}
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

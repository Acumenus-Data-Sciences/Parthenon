import { useEffect } from "react";

type ShortcutHandler = (event: KeyboardEvent) => void;

export interface ReviewerShortcuts {
  onNext?: ShortcutHandler;
  onPrev?: ShortcutHandler;
  onApprove?: ShortcutHandler;
  onReject?: ShortcutHandler;
  onEscalate?: ShortcutHandler;
  onSearch?: ShortcutHandler;
  onHelpToggle?: ShortcutHandler;
  onEscape?: ShortcutHandler;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return TYPING_TAGS.has(target.tagName);
}

export function useReviewerKeyboardShortcuts(handlers: ReviewerShortcuts): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Always-on Esc — clears modals etc., even from inside inputs.
      if (e.key === "Escape" && handlers.onEscape) {
        handlers.onEscape(e);
        return;
      }

      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "j":
        case "J":
          handlers.onNext?.(e);
          break;
        case "k":
        case "K":
          handlers.onPrev?.(e);
          break;
        case "a":
        case "A":
          handlers.onApprove?.(e);
          break;
        case "r":
        case "R":
          handlers.onReject?.(e);
          break;
        case "e":
        case "E":
          handlers.onEscalate?.(e);
          break;
        case "/":
          handlers.onSearch?.(e);
          break;
        case "?":
          handlers.onHelpToggle?.(e);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlers]);
}

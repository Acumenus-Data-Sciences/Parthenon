import { useEffect } from "react";

const SHORTCUTS = [
  { key: "J", desc: "Next row / candidate" },
  { key: "K", desc: "Previous row / candidate" },
  { key: "A", desc: "Approve focused candidate (or top-1 on queue)" },
  { key: "R", desc: "Reject (open modal)" },
  { key: "E", desc: "Escalate (open modal)" },
  { key: "/", desc: "Focus search" },
  { key: "?", desc: "Toggle this help overlay" },
  { key: "Esc", desc: "Close modal / back to queue" },
];

interface KeyboardHelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardHelpOverlay({ open, onClose }: KeyboardHelpOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-[#0E0E11] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="keyboard-help-title"
          className="mb-4 text-lg font-semibold text-zinc-100"
        >
          Keyboard shortcuts
        </h2>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li
              key={s.key}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="text-zinc-300">{s.desc}</span>
              <kbd className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-[#C9A227]">
                {s.key}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
          Press{" "}
          <kbd className="rounded border border-zinc-700 px-1 py-0.5 font-mono">
            ?
          </kbd>{" "}
          or{" "}
          <kbd className="rounded border border-zinc-700 px-1 py-0.5 font-mono">
            Esc
          </kbd>{" "}
          to close.
        </p>
      </div>
    </div>
  );
}

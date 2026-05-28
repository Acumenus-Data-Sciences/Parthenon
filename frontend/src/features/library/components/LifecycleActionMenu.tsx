import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  Archive,
  CheckCircle2,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LibraryStatus } from "../types";

type Action = "promote" | "archive" | "restore";

interface Props {
  status: LibraryStatus;
  onAction: (action: Action) => void;
  disabled?: boolean;
  className?: string;
  /** Optional ownership/permission gate. When false, the menu trigger is hidden. */
  canEdit?: boolean;
}

interface ActionMeta {
  key: Action;
  label: string;
  description: string;
  Icon: typeof Archive;
  destructive?: boolean;
}

const META: Record<Action, ActionMeta> = {
  promote: {
    key: "promote",
    label: "Promote to Active",
    description: "Make this item broadly visible and reusable.",
    Icon: CheckCircle2,
  },
  archive: {
    key: "archive",
    label: "Archive",
    description: "Retire this item. It stays accessible to admins.",
    Icon: Archive,
    destructive: true,
  },
  restore: {
    key: "restore",
    label: "Restore to Active",
    description: "Unarchive and return to the active library.",
    Icon: RotateCcw,
  },
};

function actionsFor(status: LibraryStatus): ActionMeta[] {
  switch (status) {
    case "draft":
      return [META.promote, META.archive];
    case "active":
      return [META.archive];
    case "archived":
      return [META.restore];
  }
}

export function LifecycleActionMenu({
  status,
  onAction,
  disabled,
  className,
  canEdit = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const actions = actionsFor(status);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: globalThis.MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!canEdit || actions.length === 0) return null;

  function handleClick(e: MouseEvent, action: Action) {
    e.stopPropagation();
    setOpen(false);
    onAction(action);
  }

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center w-7 h-7 rounded-md",
          "text-text-muted hover:text-text-primary hover:bg-surface-elevated",
          "transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Lifecycle actions"
      >
        <MoreHorizontal size={14} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-20 mt-1 w-60 rounded-md border border-border-default",
            "bg-surface-raised shadow-xl ring-1 ring-black/20",
            "py-1",
          )}
        >
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              onClick={(e) => handleClick(e, a.key)}
              className={cn(
                "w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors",
                "hover:bg-surface-overlay focus:bg-surface-overlay focus:outline-none",
                a.destructive && "text-amber-500 hover:text-amber-400",
                !a.destructive && "text-text-primary",
              )}
            >
              <a.Icon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{a.label}</div>
                <div className="text-[11px] text-text-muted leading-tight mt-0.5">
                  {a.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type { Action as LifecycleAction };

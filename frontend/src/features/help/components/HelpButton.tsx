import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { HelpSlideOver } from "./HelpSlideOver";

interface HelpButtonProps {
  helpKey: string;
  className?: string;
}

export function HelpButton({ helpKey, className }: HelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open help"
        title="Help"
        className={
          className ??
          "flex h-7 w-7 items-center justify-center rounded-md text-text-ghost hover:text-text-muted hover:bg-surface-overlay transition-colors"
        }
      >
        <HelpCircle size={16} />
      </button>

      <HelpSlideOver
        helpKey={open ? helpKey : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpSlideOver } from "./HelpSlideOver";

interface HelpButtonProps {
  helpKey: string;
  className?: string;
}

export function HelpButton({ helpKey, className }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("help");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
        title={t("title")}
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

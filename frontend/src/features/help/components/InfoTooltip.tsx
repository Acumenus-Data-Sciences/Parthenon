import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";

interface InfoTooltipProps {
  text: string;
  size?: number;
  className?: string;
}

export function InfoTooltip({ text, size = 13, className }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6 + window.scrollY,
      left: rect.left + rect.width / 2,
    });
  }, [visible]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={
          className ??
          "inline-flex text-text-ghost hover:text-text-muted transition-colors"
        }
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label={text}
        tabIndex={0}
      >
        <HelpCircle size={size} />
      </button>

      {visible &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              transform: "translateX(-50%)",
              zIndex: 9999,
            }}
            className="max-w-xs rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-xs text-text-secondary shadow-xl"
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

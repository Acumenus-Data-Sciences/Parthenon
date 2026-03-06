import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "@/stores/uiStore";
import { useAbbyStore } from "@/stores/abbyStore";

export function useGlobalKeyboard() {
  const navigate = useNavigate();
  const { setCommandPaletteOpen, toggleSidebar } = useUiStore();
  const togglePanel = useAbbyStore((s) => s.togglePanel);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      // Ctrl/Cmd + K — Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Ctrl/Cmd + Shift + A — AI drawer
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "A") {
        e.preventDefault();
        togglePanel();
        return;
      }

      // Ctrl/Cmd + B — Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // / — Focus search (when not in an input)
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // g then d — Go to dashboard (vim-style navigation)
      if (e.key === "g" && !isInput) {
        const secondKey = (e2: KeyboardEvent) => {
          document.removeEventListener("keydown", secondKey);
          if (e2.key === "d") navigate("/");
          else if (e2.key === "j") navigate("/jobs");
          else if (e2.key === "s") navigate("/data-sources");
          else if (e2.key === "c") navigate("/cohort-definitions");
          else if (e2.key === "v") navigate("/vocabulary");
          else if (e2.key === "a") navigate("/analyses");
          else if (e2.key === "e") navigate("/data-explorer");
        };
        document.addEventListener("keydown", secondKey, { once: true });
        setTimeout(() => document.removeEventListener("keydown", secondKey), 1000);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate, setCommandPaletteOpen, togglePanel, toggleSidebar]);
}

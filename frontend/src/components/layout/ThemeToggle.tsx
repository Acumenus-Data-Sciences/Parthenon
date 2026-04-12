import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isLight = theme === "light";

  return (
    <button
      className="btn btn-ghost btn-icon btn-sm"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      {isLight ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}

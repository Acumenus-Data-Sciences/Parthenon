import { Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/stores/themeStore";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const { t } = useTranslation("layout");
  const isLight = theme === "light";
  const label = isLight ? t("theme.switchToDark") : t("theme.switchToLight");

  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon btn-sm"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {isLight ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}

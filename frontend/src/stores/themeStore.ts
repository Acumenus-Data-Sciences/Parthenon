import { create } from "zustand";

type Theme = "dark" | "light";

const STORAGE_KEY = "parthenon-theme";

function applyThemeClass(theme: Theme): void {
  if (theme === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light") return "light";
  } catch {
    // localStorage unavailable (SSR, private browsing quota)
  }
  return "dark";
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: getStoredTheme(),
  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // quota exceeded — toggle still works for the session
      }
      applyThemeClass(next);
      return { theme: next };
    }),
}));

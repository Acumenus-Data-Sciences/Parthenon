import { create } from "zustand";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";

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

function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // quota exceeded — toggle still works for the session
  }
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  /**
   * Hydrate theme from the authenticated user's server-side preference.
   * Called on login / app boot when the user record is loaded.
   * Overrides localStorage so a user's preference follows them across devices.
   */
  hydrateFromUser: (preference: Theme | null | undefined) => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: getStoredTheme(),

  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark";
      writeStoredTheme(next);
      applyThemeClass(next);
      // Fire-and-forget persist to server; localStorage already covers failure.
      void apiClient
        .put("/user/theme", { theme_preference: next })
        .catch(() => {
          // User may be unauthenticated or offline — silent fail, theme still applied.
        });
      return { theme: next };
    }),

  hydrateFromUser: (preference) => {
    if (preference !== "dark" && preference !== "light") return;
    if (get().theme === preference) return;
    writeStoredTheme(preference);
    applyThemeClass(preference);
    set({ theme: preference });
  },
}));

// Hydrate from the authenticated user's server-side preference on boot and
// whenever the user record changes (login, /auth/user refresh, impersonation).
// Runs once at module load with the persisted auth state, then subscribes.
const hydrateFromAuth = (user: { theme_preference?: Theme | null } | null) => {
  if (user?.theme_preference) {
    useThemeStore.getState().hydrateFromUser(user.theme_preference);
  }
};
hydrateFromAuth(useAuthStore.getState().user);
useAuthStore.subscribe((state, prev) => {
  if (state.user !== prev.user) hydrateFromAuth(state.user);
});

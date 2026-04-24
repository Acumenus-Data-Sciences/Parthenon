import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import type { User } from "@/types/models";

export const AUTH_STORAGE_KEY = "parthenon-auth";
export const AUTH_REMEMBER_ME_STORAGE_KEY = "parthenon-auth-remember-me";

function readRememberMePreference(): boolean {
  if (typeof window === "undefined") return true;

  try {
    const stored = window.localStorage.getItem(AUTH_REMEMBER_ME_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

function writeRememberMePreference(rememberMe: boolean): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      AUTH_REMEMBER_ME_STORAGE_KEY,
      rememberMe ? "true" : "false",
    );
  } catch {
    // The auth store still works in-memory if browser storage is unavailable.
  }
}

const authStateStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;

    try {
      return (
        window.localStorage.getItem(name) ?? window.sessionStorage.getItem(name)
      );
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;

    try {
      const parsed = JSON.parse(value) as {
        state?: { rememberMe?: boolean };
      };
      const rememberMe = parsed.state?.rememberMe ?? readRememberMePreference();
      const primaryStorage = rememberMe
        ? window.localStorage
        : window.sessionStorage;
      const secondaryStorage = rememberMe
        ? window.sessionStorage
        : window.localStorage;

      primaryStorage.setItem(name, value);
      secondaryStorage.removeItem(name);
      writeRememberMePreference(rememberMe);
    } catch {
      // Ignore storage failures; auth still works for the current runtime.
    }
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(name);
      window.sessionStorage.removeItem(name);
    } catch {
      // Ignore storage failures during logout/cleanup.
    }
  },
};

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
  setAuth: (token: string, user: User, rememberMe?: boolean) => void;
  setRememberMe: (rememberMe: boolean) => void;
  updateUser: (user: User) => void;
  logout: () => void;
  hasRole: (role: string | string[]) => boolean;
  hasPermission: (permission: string) => boolean;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      rememberMe: readRememberMePreference(),

      setAuth: (token, user, rememberMe = get().rememberMe) => {
        writeRememberMePreference(rememberMe);
        set({ token, user, isAuthenticated: true, rememberMe });
      },
      setRememberMe: (rememberMe) => {
        writeRememberMePreference(rememberMe);
        set({ rememberMe });
      },
      updateUser: (user) => set({ user }),
      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
        authStateStorage.removeItem(AUTH_STORAGE_KEY);
      },

      hasRole: (role) => {
        const roles = get().user?.roles ?? [];
        if (Array.isArray(role)) return role.some((r) => roles.includes(r));
        return roles.includes(role);
      },

      hasPermission: (permission) => {
        const permissions = get().user?.permissions ?? [];
        return permissions.includes(permission);
      },

      isSuperAdmin: () => (get().user?.roles ?? []).includes("super-admin"),
      isAdmin: () =>
        ["super-admin", "admin"].some((r) =>
          (get().user?.roles ?? []).includes(r),
        ),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => authStateStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        rememberMe: state.rememberMe,
      }),
    },
  ),
);

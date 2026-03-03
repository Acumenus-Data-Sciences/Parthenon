import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types/models";

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
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

      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      updateUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),

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
    { name: "parthenon-auth" },
  ),
);

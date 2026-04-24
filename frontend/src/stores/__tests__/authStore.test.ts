import { describe, it, expect, beforeEach } from "vitest";
import {
  AUTH_REMEMBER_ME_STORAGE_KEY,
  AUTH_STORAGE_KEY,
  useAuthStore,
} from "../authStore";
import type { User } from "@/types/models";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: "Test User",
    email: "test@example.com",
    avatar: null,
    phone_number: null,
    job_title: null,
    department: null,
    organization: null,
    bio: null,
    must_change_password: false,
    onboarding_completed: true,
    default_source_id: null,
    theme_preference: "dark",
    locale: "en-US",
    last_login_at: null,
    last_active_at: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    roles: ["viewer"],
    permissions: ["vocabulary.view"],
    ...overrides,
  };
}

beforeEach(() => {
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    rememberMe: true,
  });
  localStorage.clear();
  sessionStorage.clear();
});

describe("authStore", () => {
  it("setAuth stores token and user, sets isAuthenticated to true", () => {
    const user = makeUser();
    useAuthStore.getState().setAuth("my-token", user);

    const state = useAuthStore.getState();
    expect(state.token).toBe("my-token");
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it("logout clears token, user, and sets isAuthenticated to false", () => {
    useAuthStore.getState().setAuth("my-token", makeUser());
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("updateUser replaces user without changing token", () => {
    const user = makeUser();
    useAuthStore.getState().setAuth("my-token", user);

    const updatedUser = makeUser({ name: "Updated Name" });
    useAuthStore.getState().updateUser(updatedUser);

    const state = useAuthStore.getState();
    expect(state.user?.name).toBe("Updated Name");
    expect(state.token).toBe("my-token");
  });

  it("hasRole returns true when user has the role", () => {
    useAuthStore
      .getState()
      .setAuth("t", makeUser({ roles: ["admin", "viewer"] }));

    expect(useAuthStore.getState().hasRole("admin")).toBe(true);
    expect(useAuthStore.getState().hasRole("viewer")).toBe(true);
    expect(useAuthStore.getState().hasRole("researcher")).toBe(false);
  });

  it("hasRole accepts an array and returns true if any match", () => {
    useAuthStore.getState().setAuth("t", makeUser({ roles: ["viewer"] }));

    expect(useAuthStore.getState().hasRole(["admin", "viewer"])).toBe(true);
    expect(useAuthStore.getState().hasRole(["admin", "researcher"])).toBe(
      false,
    );
  });

  it("hasPermission returns true for matching permission", () => {
    useAuthStore
      .getState()
      .setAuth(
        "t",
        makeUser({ permissions: ["vocabulary.view", "cohorts.create"] }),
      );

    expect(useAuthStore.getState().hasPermission("vocabulary.view")).toBe(true);
    expect(useAuthStore.getState().hasPermission("cohorts.create")).toBe(true);
    expect(useAuthStore.getState().hasPermission("admin.delete")).toBe(false);
  });

  it("isSuperAdmin returns true only for super-admin role", () => {
    useAuthStore.getState().setAuth("t", makeUser({ roles: ["admin"] }));
    expect(useAuthStore.getState().isSuperAdmin()).toBe(false);

    useAuthStore.getState().setAuth("t", makeUser({ roles: ["super-admin"] }));
    expect(useAuthStore.getState().isSuperAdmin()).toBe(true);
  });

  it("isAdmin returns true for admin or super-admin roles", () => {
    useAuthStore.getState().setAuth("t", makeUser({ roles: ["viewer"] }));
    expect(useAuthStore.getState().isAdmin()).toBe(false);

    useAuthStore.getState().setAuth("t", makeUser({ roles: ["admin"] }));
    expect(useAuthStore.getState().isAdmin()).toBe(true);

    useAuthStore.getState().setAuth("t", makeUser({ roles: ["super-admin"] }));
    expect(useAuthStore.getState().isAdmin()).toBe(true);
  });

  it("persists auth state to localStorage when rememberMe is enabled", () => {
    useAuthStore.getState().setAuth("persisted-token", makeUser());

    const stored = JSON.parse(
      localStorage.getItem(AUTH_STORAGE_KEY) ?? "{}",
    );
    expect(stored.state?.token).toBe("persisted-token");
    expect(stored.state?.isAuthenticated).toBe(true);
    expect(stored.state?.rememberMe).toBe(true);
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_REMEMBER_ME_STORAGE_KEY)).toBe("true");
  });

  it("persists auth state to sessionStorage when rememberMe is disabled", () => {
    useAuthStore.getState().setRememberMe(false);
    useAuthStore.getState().setAuth("session-token", makeUser(), false);

    const stored = JSON.parse(
      sessionStorage.getItem(AUTH_STORAGE_KEY) ?? "{}",
    );
    expect(stored.state?.token).toBe("session-token");
    expect(stored.state?.isAuthenticated).toBe(true);
    expect(stored.state?.rememberMe).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_REMEMBER_ME_STORAGE_KEY)).toBe("false");
  });

  it("logout clears persisted auth state from both storages", () => {
    useAuthStore.getState().setAuth("persisted-token", makeUser());
    useAuthStore.getState().logout();

    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});

import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/types/models";
import { createTestQueryClient } from "@/test/test-utils";
import { setActiveLocale } from "@/i18n/i18n";
import { useAuthStore } from "@/stores/authStore";
import { useUpdateLocale } from "../useProfile";
import { updateLocale } from "../../api/profileApi";

vi.mock("../../api/profileApi", () => ({
  deleteAvatar: vi.fn(),
  updateLocale: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}));

const testUser: User = {
  id: 1,
  name: "Admin",
  email: "admin@acumenus.net",
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
  created_at: "2026-04-17T00:00:00Z",
  updated_at: "2026-04-17T00:00:00Z",
  roles: ["super-admin"],
  permissions: [],
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe("useUpdateLocale", () => {
  beforeEach(async () => {
    vi.mocked(updateLocale).mockReset();
    useAuthStore.setState({
      token: "test-token",
      user: testUser,
      isAuthenticated: true,
    });
    await setActiveLocale("en-US");
  });

  afterEach(async () => {
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
    });
    await setActiveLocale("en-US");
  });

  it("rolls back optimistic locale state when saving fails", async () => {
    vi.mocked(updateLocale).mockRejectedValue(new Error("network unavailable"));
    const { result } = renderHook(() => useUpdateLocale(), { wrapper });

    await expect(result.current.mutateAsync({ locale: "ko-KR" })).rejects.toThrow(
      "network unavailable",
    );

    await waitFor(() => {
      expect(useAuthStore.getState().user?.locale).toBe("en-US");
      expect(document.documentElement.lang).toBe("en-US");
    });
  });
});

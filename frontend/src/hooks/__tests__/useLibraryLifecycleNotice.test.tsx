import { renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/ui";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/models";

import { useLibraryLifecycleNotice } from "../useLibraryLifecycleNotice";

let mock: MockAdapter;

const baseUser: User = {
  id: 1,
  name: "Researcher",
  email: "r@example.test",
  avatar: null,
  phone_number: null,
  job_title: null,
  department: null,
  organization: null,
  bio: null,
  must_change_password: false,
  onboarding_completed: true,
  seen_library_lifecycle_notice: false,
  default_source_id: null,
  theme_preference: "dark",
  locale: "en-US",
  last_login_at: null,
  last_active_at: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function setUser(overrides: Partial<User>) {
  useAuthStore.setState({
    user: { ...baseUser, ...overrides },
    isAuthenticated: true,
  });
}

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

afterEach(() => {
  mock.restore();
  vi.restoreAllMocks();
});

describe("useLibraryLifecycleNotice", () => {
  it("fires once and persists when the user has not seen it", async () => {
    const infoSpy = vi.spyOn(toast, "info").mockImplementation(() => {});
    mock
      .onPut("/api/v1/user/library-notice")
      .reply(200, { seen_library_lifecycle_notice: true });
    setUser({ seen_library_lifecycle_notice: false });

    renderHook(() => useLibraryLifecycleNotice());

    await waitFor(() => {
      expect(
        useAuthStore.getState().user?.seen_library_lifecycle_notice,
      ).toBe(true);
    });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(mock.history.put).toHaveLength(1);
  });

  it("does nothing when the notice was already seen", () => {
    const infoSpy = vi.spyOn(toast, "info").mockImplementation(() => {});
    setUser({ seen_library_lifecycle_notice: true });

    renderHook(() => useLibraryLifecycleNotice());

    expect(infoSpy).not.toHaveBeenCalled();
    expect(mock.history.put).toHaveLength(0);
  });

  it("stays silent during the blocking password-change flow", () => {
    const infoSpy = vi.spyOn(toast, "info").mockImplementation(() => {});
    setUser({ must_change_password: true, seen_library_lifecycle_notice: false });

    renderHook(() => useLibraryLifecycleNotice());

    expect(infoSpy).not.toHaveBeenCalled();
    expect(mock.history.put).toHaveLength(0);
  });
});

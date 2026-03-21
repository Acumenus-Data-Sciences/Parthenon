import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginPage } from "../LoginPage";

// Mock api-client
vi.mock("@/lib/api-client", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock query-client
vi.mock("@/lib/query-client", () => ({
  queryClient: {
    prefetchQuery: vi.fn(),
  },
}));

// Mock dashboard API
vi.mock("@/features/dashboard/api/dashboardApi", () => ({
  fetchDashboardStats: vi.fn(),
}));

// Mock axios (used for CSRF cookie prefetch)
vi.mock("axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({}),
  },
}));

// Mock ConstellationBackground — canvas-heavy component not relevant to tests
vi.mock("../../components/ConstellationBackground", () => ({
  ConstellationBackground: () => <div data-testid="constellation-bg" />,
}));

// Mock ForgotPasswordModal
vi.mock("../../components/ForgotPasswordModal", () => ({
  ForgotPasswordModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
    defaultEmail?: string;
  }) =>
    isOpen ? (
      <div data-testid="forgot-password-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Import the mocked module so we can control return values
import apiClient from "@/lib/api-client";
const mockedApiClient = vi.mocked(apiClient);

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password input fields", () => {
    renderLoginPage();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders Sign in button", () => {
    renderLoginPage();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('shows "Request access" link pointing to /register', () => {
    renderLoginPage();
    const link = screen.getByText(/request access/i);
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/register");
  });

  it('shows "Forgot password?" button', () => {
    renderLoginPage();
    expect(
      screen.getByRole("button", { name: /forgot password/i }),
    ).toBeInTheDocument();
  });

  it("opens forgot password modal when button is clicked", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    expect(screen.queryByTestId("forgot-password-modal")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /forgot password/i }));

    expect(screen.getByTestId("forgot-password-modal")).toBeInTheDocument();
  });

  it("submits form and calls login API with credentials", async () => {
    const user = userEvent.setup();
    mockedApiClient.post.mockResolvedValueOnce({
      data: {
        token: "test-token-123",
        user: {
          id: 1,
          name: "Test User",
          email: "test@example.com",
          must_change_password: false,
          onboarding_completed: true,
          roles: ["viewer"],
          permissions: [],
        },
      },
    });

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "mypassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockedApiClient.post).toHaveBeenCalledWith("/auth/login", {
        email: "test@example.com",
        password: "mypassword",
      });
    });
  });

  it("navigates to home after successful login", async () => {
    const user = userEvent.setup();
    mockedApiClient.post.mockResolvedValueOnce({
      data: {
        token: "test-token",
        user: {
          id: 1,
          name: "Test User",
          email: "test@example.com",
          must_change_password: false,
          onboarding_completed: true,
          roles: ["viewer"],
          permissions: [],
        },
      },
    });

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("shows error message on invalid credentials", async () => {
    const user = userEvent.setup();
    mockedApiClient.post.mockRejectedValueOnce(new Error("Unauthorized"));

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "wrong@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invalid credentials/i),
      ).toBeInTheDocument();
    });
  });
});

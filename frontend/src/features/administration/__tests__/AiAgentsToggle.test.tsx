// ---------------------------------------------------------------------------
// AI Agents toggle — AiProvidersPage integration test
//
// Covers:
//   - AgentsToggleCard renders with the toggle
//   - Flipping the toggle calls setAgentSettings(true/false)
//   - On success, both ["ai-agents"] and ["system","feature-flags"] are invalidated
// ---------------------------------------------------------------------------

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import apiClient from "@/lib/api-client";
import AiProvidersPage from "../pages/AiProvidersPage";

let mock: MockAdapter;

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function Wrapper({ client, children }: PropsWithChildren<{ client: QueryClient }>) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  // Provider list — empty so ProviderCard noise doesn't interfere
  mock.onGet("/api/v1/admin/ai-providers").reply(200, []);
});

afterEach(() => {
  mock.restore();
  vi.restoreAllMocks();
});

describe("AI Agents toggle card", () => {
  it("renders the toggle in disabled state when enabled=false", async () => {
    mock.onGet("/api/v1/admin/ai-agents").reply(200, {
      enabled: false,
      anthropic_ready: false,
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AiProvidersPage />
      </Wrapper>,
    );

    // Card title uses the fallback string since no i18n resources are loaded
    await waitFor(() =>
      expect(screen.getByText("AI Agents")).toBeInTheDocument(),
    );

    // Wait for the query to resolve so the checkbox reflects the server value
    const toggle = await waitFor(() =>
      screen.getByRole("checkbox", {
        name: /Toggle AI Agents/i,
      }) as HTMLInputElement,
    );
    expect(toggle.checked).toBe(false);
  });

  it("renders the toggle in enabled state when enabled=true", async () => {
    mock.onGet("/api/v1/admin/ai-agents").reply(200, {
      enabled: true,
      anthropic_ready: true,
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AiProvidersPage />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText("AI Agents")).toBeInTheDocument(),
    );

    // Wait until the checkbox reflects the resolved value (enabled=true)
    await waitFor(() => {
      const toggle = screen.getByRole("checkbox", {
        name: /Toggle AI Agents/i,
      }) as HTMLInputElement;
      expect(toggle.checked).toBe(true);
    });
  });

  it("shows the Anthropic-not-ready hint when enabled but anthropic_ready=false", async () => {
    mock.onGet("/api/v1/admin/ai-agents").reply(200, {
      enabled: true,
      anthropic_ready: false,
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AiProvidersPage />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Anthropic provider not configured/i),
      ).toBeInTheDocument(),
    );
  });

  it("does not show the Anthropic hint when anthropic_ready=true", async () => {
    mock.onGet("/api/v1/admin/ai-agents").reply(200, {
      enabled: true,
      anthropic_ready: true,
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AiProvidersPage />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText("AI Agents")).toBeInTheDocument(),
    );

    expect(
      screen.queryByText(/Anthropic provider not configured/i),
    ).not.toBeInTheDocument();
  });

  it("calls PUT /ai-agents with enabled=true when toggle is flipped on", async () => {
    mock.onGet("/api/v1/admin/ai-agents").reply(200, {
      enabled: false,
      anthropic_ready: false,
    });
    mock.onPut("/api/v1/admin/ai-agents").reply(200, {
      enabled: true,
      anthropic_ready: false,
    });

    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    render(
      <Wrapper client={client}>
        <AiProvidersPage />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText("AI Agents")).toBeInTheDocument(),
    );

    const toggle = screen.getByRole("checkbox", { name: /Toggle AI Agents/i });
    fireEvent.click(toggle);

    // Wait for the PUT to complete and verify its payload
    await waitFor(() => {
      const putHistory = mock.history["put"] ?? [];
      expect(putHistory.length).toBeGreaterThan(0);
    });

    const putHistory = mock.history["put"] ?? [];
    const body = JSON.parse(putHistory[0]?.data as string) as { enabled: boolean };
    expect(body.enabled).toBe(true);

    // Both caches must be invalidated so useFlag("ai.agents") refreshes
    await waitFor(() => {
      const calls = invalidateSpy.mock.calls.map((c) =>
        (c[0] as { queryKey?: unknown }).queryKey,
      );
      expect(calls).toContainEqual(["ai-agents"]);
      expect(calls).toContainEqual(["system", "feature-flags"]);
    });
  });

  it("calls PUT /ai-agents with enabled=false when toggle is flipped off", async () => {
    mock.onGet("/api/v1/admin/ai-agents").reply(200, {
      enabled: true,
      anthropic_ready: true,
    });
    mock.onPut("/api/v1/admin/ai-agents").reply(200, {
      enabled: false,
      anthropic_ready: true,
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AiProvidersPage />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText("AI Agents")).toBeInTheDocument(),
    );

    // Wait for the checkbox to reflect the resolved enabled=true value before clicking
    await waitFor(() => {
      const toggle = screen.getByRole("checkbox", { name: /Toggle AI Agents/i }) as HTMLInputElement;
      expect(toggle.checked).toBe(true);
    });

    const toggle = screen.getByRole("checkbox", { name: /Toggle AI Agents/i });
    fireEvent.click(toggle);

    // Wait for the PUT and verify payload is enabled=false
    await waitFor(() => {
      const putHistory = mock.history["put"] ?? [];
      expect(putHistory.length).toBeGreaterThan(0);
    });

    const putHistory = mock.history["put"] ?? [];
    const body = JSON.parse(putHistory[0]?.data as string) as { enabled: boolean };
    expect(body.enabled).toBe(false);
  });

  it("renders the copilot provider-mode selector and PUTs provider_mode on click", async () => {
    mock.onGet("/api/v1/admin/ai-agents").reply(200, {
      enabled: true,
      anthropic_ready: true,
      provider_mode: "cloud",
      local_ready: false,
    });
    mock.onPut("/api/v1/admin/ai-agents").reply(200, {
      enabled: true,
      anthropic_ready: true,
      provider_mode: "local",
      local_ready: false,
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AiProvidersPage />
      </Wrapper>,
    );

    // Selector only renders when agents are enabled.
    const localBtn = await waitFor(() => screen.getByTestId("copilot-mode-local"));
    fireEvent.click(localBtn);

    await waitFor(() => {
      const putHistory = mock.history["put"] ?? [];
      expect(putHistory.length).toBeGreaterThan(0);
    });

    const putHistory = mock.history["put"] ?? [];
    const body = JSON.parse(putHistory[0]?.data as string) as { provider_mode: string };
    expect(body.provider_mode).toBe("local");
  });

  it("warns when local/auto mode is selected but no local provider is ready", async () => {
    mock.onGet("/api/v1/admin/ai-agents").reply(200, {
      enabled: true,
      anthropic_ready: true,
      provider_mode: "local",
      local_ready: false,
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AiProvidersPage />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText(/No local provider is active/i)).toBeInTheDocument(),
    );
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import apiClient from "@/lib/api-client";
import { ReportButton } from "../components/ReportButton";

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("ReportButton", () => {
  it("disabled when no source or concept", () => {
    render(<ReportButton sourceKey="" conceptId={0} onRunIdChange={() => {}} />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: /generate report/i })).toBeDisabled();
  });

  it("dispatches and reports run_id on click", async () => {
    mock.onPost("/finngen/code-explorer/report").reply(201, {
      id: "run_abc",
      status: "queued",
    });
    mock.onGet(/\/finngen\/runs\/run_abc/).reply(200, {
      id: "run_abc",
      status: "running",
      progress: null,
    });

    const onRunIdChange = vi.fn();
    render(
      <ReportButton sourceKey="EUNOMIA" conceptId={201826} onRunIdChange={onRunIdChange} />,
      { wrapper: Wrapper },
    );

    await userEvent.click(screen.getByRole("button", { name: /generate report/i }));
    await waitFor(() => expect(onRunIdChange).toHaveBeenCalledWith("run_abc"));
  });
});

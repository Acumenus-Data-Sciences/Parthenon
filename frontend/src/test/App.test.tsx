import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { renderWithProviders } from "./test-utils";

describe("DashboardPage", () => {
  it("renders the dashboard heading", () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    renderWithProviders(<DashboardPage />);
    expect(
      screen.getByText("Unified Outcomes Research Platform"),
    ).toBeInTheDocument();
  });
});

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import type { Study } from "@/features/studies/types/study";
import { useImportProtocolAsNewStudy } from "@/features/studies/hooks/useStudies";
import StudyDesignerPage from "../StudyDesignerPage";

vi.mock("@/features/help", () => ({
  HelpButton: () => <button type="button">Help</button>,
}));

vi.mock("@/features/studies/hooks/useStudies", () => ({
  useImportProtocolAsNewStudy: vi.fn(),
}));

vi.mock("@/features/studies/components/StudyDesignWorkbench", async () => {
  const React = await import("react");

  return {
    StudyDesignWorkbench: ({ study }: { study: Study }) =>
      React.createElement(
        "section",
        { "data-testid": "study-design-workbench" },
        study.title,
      ),
  };
});

const importedStudy = {
  id: 42,
  slug: "hypertension-study-v3-2",
  title: "Hypertension Study v3.2",
  description: "Imported from protocol upload.",
  primary_objective: "Estimate hypertension outcomes.",
  status: "draft",
  study_type: "characterization",
} as Study;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("StudyDesignerPage", () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({
      study: importedStudy,
      session: { id: 7 },
      version: { id: 11 },
    });
    vi.mocked(useImportProtocolAsNewStudy).mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    } as ReturnType<typeof useImportProtocolAsNewStudy>);
  });

  it("renders protocol import output in place instead of navigating to the study detail route", async () => {
    const { container } = renderWithProviders(
      <>
        <StudyDesignerPage />
        <LocationProbe />
      </>,
      { initialRoute: "/study-designer" },
    );
    const file = new File(["# Protocol"], "hypertension-protocol.md", {
      type: "text/markdown",
    });
    const input = container.querySelector('input[type="file"]');

    expect(input).toBeInstanceOf(HTMLInputElement);
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId("study-design-workbench")).toHaveTextContent(
        "Hypertension Study v3.2",
      );
    });

    expect(mutateAsync).toHaveBeenCalledWith({ file });
    expect(screen.getByTestId("location")).toHaveTextContent("/study-designer");
  });
});

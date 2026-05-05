import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunArtifactsView } from "../components/aqueduct/templates/RunArtifactsView";
import type { TemplateRunArtifact } from "../types/templates";

describe("RunArtifactsView", () => {
  it("renders one download link per artifact with size and content type", () => {
    const arts: TemplateRunArtifact[] = [
      {
        name: "person.csv",
        size_bytes: 4096,
        signed_url: "/storage/templates/1/person.csv?sig=abc",
        content_type: "text/csv",
      },
      {
        name: "validation_report.json",
        size_bytes: 2048,
        signed_url: "/storage/templates/1/validation.json?sig=xyz",
        content_type: "application/json",
      },
    ];
    render(<RunArtifactsView artifacts={arts} />);
    const personLink = screen.getByRole("link", { name: /person\.csv/ });
    expect(personLink).toHaveAttribute(
      "href",
      "/storage/templates/1/person.csv?sig=abc",
    );
    expect(personLink).toHaveAttribute("download");
    expect(screen.getByText(/4 KB/)).toBeInTheDocument();
    expect(screen.getByText(/text\/csv/)).toBeInTheDocument();
  });

  it("renders the empty state when there are no artifacts", () => {
    render(<RunArtifactsView artifacts={[]} />);
    expect(screen.getByText(/No artifacts/i)).toBeInTheDocument();
  });
});

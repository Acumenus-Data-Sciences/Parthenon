// Phase 16 Plan 16-06 (GENOMICS-13) — FinnGenSeededPill Vitest coverage.
//
// Validates the 4 type-guard branches + render shape + URL encoding.
// Mirrors SC-4 / GENOMICS-13 rows in 16-VALIDATION.md.
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import { FinnGenSeededPill } from "../FinnGenSeededPill";

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("FinnGenSeededPill", () => {
  it("renders pill when seeded_from.kind === 'finngen-endpoint' and endpoint_name is set", () => {
    renderWithRouter(
      <FinnGenSeededPill
        seededFrom={{ kind: "finngen-endpoint", endpoint_name: "E4_DM2" }}
      />,
    );
    const pill = screen.getByTestId("finngen-seeded-pill");
    expect(pill).toHaveTextContent("From FinnGen E4_DM2");
    expect(pill.getAttribute("href")).toContain("/workbench/finngen-endpoints");
    expect(pill.getAttribute("href")).toContain("E4_DM2");
    // Q5 — confirm drawer-deep-link param is ?endpoint= (matches
    // FinnGenEndpointBrowserPage.tsx reader).
    expect(pill.getAttribute("href")).toContain("endpoint=");
    expect(pill).toHaveAttribute(
      "aria-label",
      expect.stringContaining("E4_DM2"),
    );
  });

  it("omits pill when seeded_from is null", () => {
    renderWithRouter(<FinnGenSeededPill seededFrom={null} />);
    expect(screen.queryByTestId("finngen-seeded-pill")).toBeNull();
  });

  it("omits pill when seeded_from is undefined", () => {
    renderWithRouter(<FinnGenSeededPill seededFrom={undefined} />);
    expect(screen.queryByTestId("finngen-seeded-pill")).toBeNull();
  });

  it("omits pill when kind is not finngen-endpoint", () => {
    renderWithRouter(
      <FinnGenSeededPill
        seededFrom={{ kind: "other-source", endpoint_name: "X" }}
      />,
    );
    expect(screen.queryByTestId("finngen-seeded-pill")).toBeNull();
  });

  it("omits pill when endpoint_name is missing", () => {
    renderWithRouter(
      <FinnGenSeededPill seededFrom={{ kind: "finngen-endpoint" }} />,
    );
    expect(screen.queryByTestId("finngen-seeded-pill")).toBeNull();
  });

  it("omits pill when endpoint_name is an empty string", () => {
    renderWithRouter(
      <FinnGenSeededPill
        seededFrom={{ kind: "finngen-endpoint", endpoint_name: "" }}
      />,
    );
    expect(screen.queryByTestId("finngen-seeded-pill")).toBeNull();
  });

  it("URL-encodes endpoint names with special characters", () => {
    const raw = "TEST/NAME with spaces";
    renderWithRouter(
      <FinnGenSeededPill
        seededFrom={{ kind: "finngen-endpoint", endpoint_name: raw }}
      />,
    );
    const href = screen
      .getByTestId("finngen-seeded-pill")
      .getAttribute("href");
    expect(href).toContain(encodeURIComponent(raw));
    // The raw unencoded form must NOT leak into the URL.
    expect(href).not.toContain(" ");
  });
});

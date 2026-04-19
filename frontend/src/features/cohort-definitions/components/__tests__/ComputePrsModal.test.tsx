import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type Mock,
} from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { ComputePrsModal } from "../ComputePrsModal";
import {
  usePgsCatalogScores,
  useComputePrsMutation,
} from "../../hooks/usePrsScores";

vi.mock("../../hooks/usePrsScores", () => ({
  usePgsCatalogScores: vi.fn(),
  useComputePrsMutation: vi.fn(),
}));

const mockUsePgsCatalog = usePgsCatalogScores as unknown as Mock;
const mockUseCompute = useComputePrsMutation as unknown as Mock;

function wrap(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("ComputePrsModal", () => {
  beforeEach(() => {
    mockUsePgsCatalog.mockReset();
    mockUseCompute.mockReset();
    mockUsePgsCatalog.mockReturnValue({
      data: {
        scores: [
          {
            score_id: "PGS000001",
            pgs_name: "GPS_CAD_2018",
            trait_reported: "Coronary artery disease",
            variants_number: 77,
          },
          {
            score_id: "PGS000002",
            pgs_name: "GPS_T2D",
            trait_reported: "Type 2 diabetes",
            variants_number: 125,
          },
          {
            score_id: "PGS000003",
            pgs_name: null,
            trait_reported: null,
            variants_number: null,
          },
        ],
      },
      isLoading: false,
    });
    mockUseCompute.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { run: { id: "r1" } } }),
      isPending: false,
    });
  });

  it("renders Compute PRS heading and picker with 3 options (plus placeholder)", () => {
    wrap(
      <ComputePrsModal
        open={true}
        onClose={vi.fn()}
        cohortId={1}
        endpointName="E4_DM2"
        sourceKey="PANCREAS"
      />,
    );
    expect(
      screen.getByRole("heading", { name: /Compute PRS/i }),
    ).toBeInTheDocument();
    const select = screen.getByRole("combobox", {
      name: /PGS Catalog score/i,
    }) as HTMLSelectElement;
    // 3 data options + the placeholder "— select —" = 4 total
    expect(select.querySelectorAll("option").length).toBe(4);
  });

  it("disables submit when endpointName is null and shows the v1 limitation alert", () => {
    wrap(
      <ComputePrsModal
        open={true}
        onClose={vi.fn()}
        cohortId={1}
        endpointName={null}
        sourceKey="PANCREAS"
      />,
    );
    const submit = screen.getByRole("button", { name: /Compute PRS/i });
    expect(submit).toBeDisabled();
    expect(
      screen.getByText(/available only for FinnGen endpoint cohorts/i),
    ).toBeInTheDocument();
  });

  it("invokes mutation with {source_key, score_id, cohort_definition_id} on submit", async () => {
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ data: { run: { id: "r1" } } });
    mockUseCompute.mockReturnValue({ mutateAsync, isPending: false });

    wrap(
      <ComputePrsModal
        open={true}
        onClose={vi.fn()}
        cohortId={42}
        endpointName="E4_DM2"
        sourceKey="PANCREAS"
      />,
    );
    // Select a score
    const select = screen.getByRole("combobox", {
      name: /PGS Catalog score/i,
    });
    fireEvent.change(select, { target: { value: "PGS000001" } });
    // Submit
    const submit = screen.getByRole("button", { name: /Compute PRS/i });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        source_key: "PANCREAS",
        score_id: "PGS000001",
        cohort_definition_id: 42,
      }),
    );
  });

  it("calls onClose after a successful mutation", async () => {
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ data: { run: { id: "r1" } } });
    mockUseCompute.mockReturnValue({ mutateAsync, isPending: false });
    const onClose = vi.fn();

    wrap(
      <ComputePrsModal
        open={true}
        onClose={onClose}
        cohortId={42}
        endpointName="E4_DM2"
        sourceKey="PANCREAS"
      />,
    );
    const select = screen.getByRole("combobox", {
      name: /PGS Catalog score/i,
    });
    fireEvent.change(select, { target: { value: "PGS000001" } });
    fireEvent.click(screen.getByRole("button", { name: /Compute PRS/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

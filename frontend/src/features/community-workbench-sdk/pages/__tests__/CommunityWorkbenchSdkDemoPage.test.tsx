import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import CommunityWorkbenchSdkDemoPage from "../CommunityWorkbenchSdkDemoPage";
import { useCommunityWorkbenchSdkDemo } from "../../hooks/useCommunityWorkbenchSdkDemo";

vi.mock("../../hooks/useCommunityWorkbenchSdkDemo", () => ({
  useCommunityWorkbenchSdkDemo: vi.fn(),
}));

describe("CommunityWorkbenchSdkDemoPage", () => {
  it("renders the SDK demo content and key links", () => {
    vi.mocked(useCommunityWorkbenchSdkDemo).mockReturnValue({
      data: {
        service_descriptor: {
          service_name: "community_variant_browser",
          display_name: "Community Variant Browser",
          description: "Explore cohort-scoped genomic variants through a Parthenon workbench generated from the Community Workbench SDK.",
          mode: "external-adapter",
          enabled: true,
          healthy: true,
          ui_hints: {
            title: "Community Variant Browser",
            summary: "Explore cohort-scoped genomic variants through a Parthenon workbench generated from the Community Workbench SDK.",
            accent: "slate",
            workspace: "genomics-workbench",
            repository: null,
          },
          capabilities: {
            source_scoped: true,
            replay_supported: true,
            export_supported: true,
            write_operations: false,
          },
        },
        result_envelope: {
          status: "ok",
          runtime: {},
          source: { source_key: "acumenus" },
          summary: { tool_id: "community_variant_browser" },
          panels: [],
          artifacts: { artifacts: [] },
          warnings: [],
          next_actions: [],
        },
        generated_sample: {
          tool_id: "community_variant_browser",
          display_name: "Community Variant Browser",
          path: "community-workbench-sdk/generated-samples/community_variant_browser",
          files: ["README.md", "templates/CommunityVariantBrowserService.php"],
          readme_excerpt: "# Community Variant Browser",
        },
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCommunityWorkbenchSdkDemo>);

    renderWithProviders(<CommunityWorkbenchSdkDemoPage />, { initialRoute: "/workbench/community-sdk-demo" });

    expect(screen.getByRole("heading", { name: /Community Workbench SDK Demo/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back To Workbench/i })).toHaveAttribute("href", "/workbench");
    expect(screen.getByRole("link", { name: /Open SDK Docs/i })).toHaveAttribute("href", "/docs/community-workbench-sdk");
    expect(screen.getByText(/Sample Service Descriptor/i)).toBeInTheDocument();
    expect(screen.getByText(/Sample Result Envelope/i)).toBeInTheDocument();
    expect(screen.getByText(/Integration Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Generated Artifact Inventory/i)).toBeInTheDocument();
    expect(screen.getByText(/community-workbench-sdk\/generated-samples\/community_variant_browser/i)).toBeInTheDocument();
  });
});

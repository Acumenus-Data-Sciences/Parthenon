import apiClient from "@/lib/api-client";

export type CommunityWorkbenchSdkDemoResponse = {
  service_descriptor: {
    service_name: string;
    display_name: string;
    description: string;
    version?: string;
    mode: string;
    enabled: boolean;
    healthy: boolean;
    unavailability_reason?: string | null;
    ui_hints: {
      title: string;
      summary: string;
      accent: string;
      workspace: string;
      repository?: string | null;
    };
    capabilities: {
      source_scoped: boolean;
      replay_supported: boolean;
      export_supported: boolean;
      write_operations: boolean;
    };
  };
  result_envelope: {
    status: string;
    runtime: Record<string, unknown>;
    source?: Record<string, unknown> | null;
    summary: Record<string, unknown>;
    panels: Array<Record<string, unknown>>;
    artifacts: {
      artifacts: Array<Record<string, unknown>>;
    };
    warnings: string[];
    next_actions: string[];
  };
  generated_sample: {
    tool_id: string;
    display_name: string;
    path: string;
    files: string[];
    readme_excerpt: string;
  };
};

export async function fetchCommunityWorkbenchSdkDemo(): Promise<CommunityWorkbenchSdkDemoResponse> {
  const { data } = await apiClient.get("/study-agent/community-workbench-sdk/demo");
  return data.data ?? data;
}

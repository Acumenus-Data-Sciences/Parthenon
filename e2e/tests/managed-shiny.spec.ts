import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { BASE, authHeaders } from "./helpers";

test.skip(
  process.env.PLAYWRIGHT_ENABLE_SHINY_SMOKE !== "1",
  "Set PLAYWRIGHT_ENABLE_SHINY_SMOKE=1 to run ShinyProxy-backed managed OHDSI Shiny smoke tests.",
);

test.describe("managed OHDSI Shiny runtime", () => {
  test.setTimeout(180_000);

  test("launches a vetted OHDSI report viewer from a study artifact", async ({ page, request }) => {
    let studySlug: string | null = null;

    try {
      const study = await createSmokeStudy(request);
      studySlug = study.slug;
      const artifact = await createOhdsiReportArtifact(request, study.slug);
      const launch = await createManagedLaunch(request, study.slug, artifact.id);

      expect(launch.status).toBe("ready");
      expect(launch.launch_url).toBeTruthy();
      expect(launch.workspace?.id).toBeTruthy();

      await page.goto(resolveUrl(launch.launch_url), {
        waitUntil: "load",
        timeout: 120_000,
      });

      const iframeText = await waitForFrameText(
        page,
        (text) => {
          const normalized = text.toLowerCase();

          return normalized.includes("managed ohdsi shiny") &&
            text.includes(launch.workspace.id) &&
            text.includes("OHDSI Report Generator Smoke Bundle") &&
            text.includes("OhdsiShinyModules") &&
            text.includes("OhdsiShinyAppBuilder");
        },
      );

      expect(iframeText).toContain("available");
    } finally {
      if (studySlug) {
        await deleteStudy(request, studySlug);
      }
    }
  });

  test("blocks direct Shiny app access without a Parthenon launch token", async ({ page }) => {
    await page.goto(resolveUrl("/shiny/app/plp-results"), {
      waitUntil: "load",
      timeout: 120_000,
    });

    const denialText = await waitForFrameText(page, (text) => {
      const normalized = text.toLowerCase();

      return normalized.includes("launch blocked") &&
        normalized.includes("missing parthenon launch token");
    });

    expect(denialText.toLowerCase()).toContain("missing parthenon launch token");
  });
});

interface ApiEnvelope<T> {
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

interface StudyRecord {
  id: number;
  slug: string;
  title: string;
}

interface StudyArtifactRecord {
  id: number;
  title: string;
  artifact_type: string;
}

interface ManagedShinyLaunch {
  status: "ready" | "runtime_unconfigured";
  launch_url: string | null;
  workspace: {
    id: string;
    container_path: string;
    context_path: string;
  };
}

async function createSmokeStudy(request: APIRequestContext): Promise<StudyRecord> {
  const runId = Date.now().toString(36);
  const envelope = await postJson<StudyRecord>(request, "/api/v1/studies", {
    title: `Managed Shiny Smoke ${runId}`,
    short_title: `Shiny ${runId}`,
    description: "Temporary E2E study for the managed OHDSI Shiny launch smoke suite.",
    study_type: "runtime_validation",
    study_design: "observational",
    phase: "design",
    priority: "low",
    primary_objective: "Verify managed OHDSI Shiny launch and context resolution.",
    metadata: {
      e2e: true,
      managed_shiny_smoke: true,
      run_id: runId,
    },
  }, 201);

  return unwrap(envelope, "create study");
}

async function createOhdsiReportArtifact(
  request: APIRequestContext,
  studySlug: string,
): Promise<StudyArtifactRecord> {
  const envelope = await postJson<StudyArtifactRecord>(
    request,
    `/api/v1/studies/${studySlug}/artifacts`,
    {
      artifact_type: "results_report",
      title: "OHDSI Report Generator Smoke Bundle",
      description: "Temporary E2E artifact for managed OHDSI Shiny launch verification.",
      version: "1.0",
      metadata: {
        result_type: "OhdsiReportGenerator",
        managed_shiny_app: "ohdsi-report",
      },
      is_current: true,
    },
    201,
  );

  return unwrap(envelope, "create study artifact");
}

async function createManagedLaunch(
  request: APIRequestContext,
  studySlug: string,
  artifactId: number,
): Promise<ManagedShinyLaunch> {
  const envelope = await postJson<ManagedShinyLaunch>(
    request,
    `/api/v1/studies/${studySlug}/artifacts/${artifactId}/shiny-launch`,
    {
      app_key: "ohdsi-report",
      mode: "embedded",
    },
  );

  return unwrap(envelope, "create managed Shiny launch");
}

async function deleteStudy(request: APIRequestContext, studySlug: string): Promise<void> {
  await request.delete(`${BASE}/api/v1/studies/${studySlug}`, {
    headers: authHeaders(),
  });
}

async function postJson<T>(
  request: APIRequestContext,
  endpoint: string,
  payload: Record<string, unknown>,
  expectedStatus = 200,
): Promise<ApiEnvelope<T>> {
  const response = await request.post(`${BASE}${endpoint}`, {
    headers: {
      ...authHeaders(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    data: payload,
  });
  const body = await response.json().catch(() => ({}));

  if (response.status() !== expectedStatus) {
    throw new Error(
      `Unexpected ${response.status()} from ${endpoint}: ${JSON.stringify(body)}`,
    );
  }

  return body;
}

function unwrap<T>(envelope: ApiEnvelope<T>, action: string): T {
  if (!envelope.data) {
    throw new Error(`API did not return data for ${action}: ${JSON.stringify(envelope)}`);
  }

  return envelope.data;
}

async function waitForFrameText(
  page: Page,
  predicate: (text: string) => boolean,
  timeoutMs = 150_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const snapshots: Array<{ url: string; text: string }> = [];

  while (Date.now() < deadline) {
    snapshots.length = 0;

    for (const frame of page.frames()) {
      try {
        const text = await frame.locator("body").innerText({ timeout: 750 });
        snapshots.push({ url: frame.url(), text: text.slice(0, 1000) });

        if (predicate(text)) {
          return text;
        }
      } catch {
        // ShinyProxy swaps iframe content while the app container starts.
      }
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(
    `Timed out waiting for managed Shiny frame text. Last frames: ${JSON.stringify(snapshots, null, 2)}`,
  );
}

function resolveUrl(pathOrUrl: string | null): string {
  if (!pathOrUrl) {
    throw new Error("Expected managed Shiny launch URL");
  }

  return new URL(pathOrUrl, BASE).toString();
}

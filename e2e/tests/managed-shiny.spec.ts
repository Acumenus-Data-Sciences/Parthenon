import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
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

  test("launches a golden SQLite result database into the official module handoff", async ({ page, request }) => {
    test.skip(
      !process.env.PLAYWRIGHT_SHINY_GOLDEN_FILE_PATH,
      "Set PLAYWRIGHT_SHINY_GOLDEN_FILE_PATH to a backend storage-disk relative SQLite result database path.",
    );

    let studySlug: string | null = null;

    try {
      const study = await createSmokeStudy(request);
      studySlug = study.slug;
      const artifact = await createGoldenPlpArtifact(request, study.slug, process.env.PLAYWRIGHT_SHINY_GOLDEN_FILE_PATH!);
      const launch = await createManagedLaunch(request, study.slug, artifact.id, "plp-results");

      expect(launch.status).toBe("ready");
      expect(launch.launch_url).toBeTruthy();

      await page.goto(resolveUrl(launch.launch_url), {
        waitUntil: "load",
        timeout: 120_000,
      });

      const iframeText = await waitForFrameText(page, (text) => {
        const normalized = text.toLowerCase();

        return normalized.includes("official ohdsi module") &&
          normalized.includes("schema variant") &&
          normalized.includes("patientlevelprediction result database");
      });

      expect(iframeText).toContain("Official OHDSI Module");
    } finally {
      if (studySlug) {
        await deleteStudy(request, studySlug);
      }
    }
  });

  test("discovers and launches managed viewer actions on native result pages", async ({ page, request }) => {
    test.skip(
      process.env.PLAYWRIGHT_ENABLE_RESULT_VIEWER_DISCOVERY !== "1",
      "Set PLAYWRIGHT_ENABLE_RESULT_VIEWER_DISCOVERY=1 when the target environment has launchable study results.",
    );

    const seeded = process.env.PLAYWRIGHT_SEED_GOLDEN_RESULT === "1"
      ? seedGoldenResult()
      : null;
    const studySlug = seeded?.study_slug ?? process.env.PLAYWRIGHT_SHINY_RESULT_STUDY_SLUG;

    if (!studySlug) {
      throw new Error("Set PLAYWRIGHT_SHINY_RESULT_STUDY_SLUG or PLAYWRIGHT_SEED_GOLDEN_RESULT=1 for result viewer discovery.");
    }

    try {
      await suppressWhatsNewModal(page, request);
      await page.goto(resolveUrl(`/studies/${studySlug}?tab=results`), {
        waitUntil: "load",
        timeout: 120_000,
      });
      await closeWhatsNewDialog(page);

      const launchButton = page.getByRole("button", { name: /PatientLevelPrediction Results|Cohort Diagnostics Explorer|OHDSI Report Viewer/ }).first();
      await expect(launchButton).toBeVisible({ timeout: 120_000 });
      await launchButton.click();

      const iframeText = await waitForFrameText(page, (text) => {
        const normalized = text.toLowerCase();

        return normalized.includes("official ohdsi module") &&
          normalized.includes("schema variant") &&
          normalized.includes("patientlevelprediction result database");
      });

      expect(iframeText).toContain("Official OHDSI Module");
    } finally {
      if (seeded && process.env.PLAYWRIGHT_KEEP_MANAGED_SHINY_SEED !== "1") {
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

interface SeededGoldenResult {
  study_slug: string;
  study_id: number;
  result_id: number;
  execution_id: number;
  storage_path: string;
  app_key: string;
  hades_result_type: string;
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

interface ChangelogPayload {
  entries?: Array<{ version?: string }>;
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

async function createGoldenPlpArtifact(
  request: APIRequestContext,
  studySlug: string,
  filePath: string,
): Promise<StudyArtifactRecord> {
  const envelope = await postJson<StudyArtifactRecord>(
    request,
    `/api/v1/studies/${studySlug}/artifacts`,
    {
      artifact_type: "results_report",
      title: "Golden PLP SQLite Results",
      description: "Temporary E2E artifact backed by a golden PatientLevelPrediction SQLite result database.",
      version: "1.0",
      file_path: filePath,
      mime_type: "application/vnd.sqlite3",
      metadata: {
        result_type: "PatientLevelPrediction",
        managed_shiny_app: "plp-results",
      },
      is_current: true,
    },
    201,
  );

  return unwrap(envelope, "create golden PLP study artifact");
}

async function createManagedLaunch(
  request: APIRequestContext,
  studySlug: string,
  artifactId: number,
  appKey = "ohdsi-report",
): Promise<ManagedShinyLaunch> {
  const envelope = await postJson<ManagedShinyLaunch>(
    request,
    `/api/v1/studies/${studySlug}/artifacts/${artifactId}/shiny-launch`,
    {
      app_key: appKey,
      mode: "embedded",
    },
  );

  return unwrap(envelope, "create managed Shiny launch");
}

function seedGoldenResult(): SeededGoldenResult {
  const repoRoot = fs.existsSync(path.join(process.cwd(), "docker-compose.yml"))
    ? process.cwd()
    : path.resolve(process.cwd(), "..");
  const goldenSource = path.join(repoRoot, "docker/shiny-ohdsi/tests/golden/plp-results.sqlite");
  const goldenTarget = path.join(repoRoot, "backend/storage/app/private/testing/golden/plp-results.sqlite");

  fs.mkdirSync(path.dirname(goldenTarget), { recursive: true });
  fs.copyFileSync(goldenSource, goldenTarget);

  const output = execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "php",
      "php",
      "artisan",
      "shiny:seed-golden-result",
      "--cleanup",
      "--json",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const jsonLine = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => line.startsWith("{") && line.endsWith("}"));

  if (!jsonLine) {
    throw new Error(`Seed command did not return JSON: ${output}`);
  }

  return JSON.parse(jsonLine) as SeededGoldenResult;
}

async function deleteStudy(request: APIRequestContext, studySlug: string): Promise<void> {
  await request.delete(`${BASE}/api/v1/studies/${studySlug}`, {
    headers: authHeaders(),
  });
}

async function suppressWhatsNewModal(page: Page, request: APIRequestContext): Promise<void> {
  const response = await request.get(`${BASE}/api/v1/changelog`, {
    headers: authHeaders(),
  });
  const body = await response.json().catch(() => ({})) as ChangelogPayload;
  const latestVersion = body.entries?.[0]?.version ?? "Unreleased";

  await page.addInitScript((version) => {
    window.localStorage.setItem("parthenon_seen_version", version);
  }, latestVersion);
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

async function closeWhatsNewDialog(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: /What's New in Parthenon/i });
  const closeButton = dialog.getByRole("button", { name: /^Close$/i });

  if (await closeButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await closeButton.click();
  }
}

function resolveUrl(pathOrUrl: string | null): string {
  if (!pathOrUrl) {
    throw new Error("Expected managed Shiny launch URL");
  }

  return new URL(pathOrUrl, BASE).toString();
}

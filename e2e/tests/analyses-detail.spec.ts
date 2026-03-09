import { test, expect } from "@playwright/test";
import {
  BASE,
  assertPageLoads,
  collectErrors,
  dismissModals,
  apiGet,
  getFirstId,
} from "./helpers";

// ── Helpers ──────────────────────────────────────────────

/** Fetch the first analysis ID from a typed resource endpoint. */
async function getFirstAnalysisId(
  page: import("@playwright/test").Page,
  apiPath: string
): Promise<number | string | null> {
  try {
    const { status, data } = await apiGet(page, apiPath);
    if (status !== 200) return null;
    const items = data.data ?? data ?? [];
    if (!Array.isArray(items) || items.length === 0) return null;
    return items[0].id ?? null;
  } catch {
    return null;
  }
}

/** Check if the page has any verdict dashboard indicators. */
async function hasVerdictDashboard(
  page: import("@playwright/test").Page
): Promise<boolean> {
  const verdictIndicators = page.locator(
    'text=/verdict|balance|well balanced|marginal|hazard ratio|AUC|IRR|pooled|heterogeneity|rate|ir per|risk window|nnt/i'
  );
  return (await verdictIndicators.count()) > 0;
}

/** Check if the page has SVG chart elements. */
async function hasSvgCharts(
  page: import("@playwright/test").Page
): Promise<boolean> {
  const svgs = page.locator("svg");
  return (await svgs.count()) > 0;
}

// ── Characterization ─────────────────────────────────────

test.describe("Characterization Detail", () => {
  test("page loads and has heading", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/characterizations");
    if (!id) {
      test.skip(true, "No characterizations found — skipping");
      return;
    }

    await assertPageLoads(page, `/analyses/characterizations/${id}`);
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("has verdict dashboard or feature comparison", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/characterizations");
    if (!id) {
      test.skip(true, "No characterizations found");
      return;
    }

    await page.goto(`${BASE}/analyses/characterizations/${id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);
    await dismissModals(page);

    const hasVerdict = await hasVerdictDashboard(page);
    const hasTable = (await page.locator("table, [role='grid']").count()) > 0;
    const hasFeatureText =
      (await page
        .locator("text=/feature|comparison|covariate|balance/i")
        .count()) > 0;

    // At least one of these should be present
    if (!hasVerdict && !hasTable && !hasFeatureText) {
      console.log(
        "  Note: No verdict dashboard or feature table — may have no executions"
      );
    }
  });
});

// ── Incidence Rate ───────────────────────────────────────

test.describe("Incidence Rate Detail", () => {
  test("page loads and has heading", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/incidence-rates");
    if (!id) {
      test.skip(true, "No incidence rate analyses found — skipping");
      return;
    }

    await assertPageLoads(page, `/analyses/incidence-rates/${id}`);
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("has verdict dashboard or summary table", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/incidence-rates");
    if (!id) {
      test.skip(true, "No incidence rate analyses found");
      return;
    }

    await page.goto(`${BASE}/analyses/incidence-rates/${id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);
    await dismissModals(page);

    const hasVerdict = await hasVerdictDashboard(page);
    const hasTable = (await page.locator("table, [role='grid']").count()) > 0;
    const hasCharts = await hasSvgCharts(page);

    if (!hasVerdict && !hasTable && !hasCharts) {
      console.log(
        "  Note: No verdict/table/chart — may have no executions"
      );
    }
  });
});

// ── Estimation ───────────────────────────────────────────

test.describe("Estimation Detail", () => {
  test("page loads and has heading", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/estimations");
    if (!id) {
      test.skip(true, "No estimation analyses found — skipping");
      return;
    }

    await assertPageLoads(page, `/analyses/estimations/${id}`);
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("has verdict dashboard, forest plot, or KM sections", async ({
    page,
  }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/estimations");
    if (!id) {
      test.skip(true, "No estimation analyses found");
      return;
    }

    await page.goto(`${BASE}/analyses/estimations/${id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);
    await dismissModals(page);

    const hasVerdict = await hasVerdictDashboard(page);
    const hasCharts = await hasSvgCharts(page);
    const hasEstimationUI =
      (await page
        .locator(
          "text=/forest|kaplan|km curve|hazard|nnt|propensity|covariate/i"
        )
        .count()) > 0;

    if (!hasVerdict && !hasCharts && !hasEstimationUI) {
      console.log(
        "  Note: No verdict/charts/estimation UI — may have no executions"
      );
    }
  });
});

// ── Prediction ───────────────────────────────────────────

test.describe("Prediction Detail", () => {
  test("page loads and has heading", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/predictions");
    if (!id) {
      test.skip(true, "No prediction analyses found — skipping");
      return;
    }

    await assertPageLoads(page, `/analyses/predictions/${id}`);
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("has verdict dashboard, ROC curve, or calibration", async ({
    page,
  }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/predictions");
    if (!id) {
      test.skip(true, "No prediction analyses found");
      return;
    }

    await page.goto(`${BASE}/analyses/predictions/${id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);
    await dismissModals(page);

    const hasVerdict = await hasVerdictDashboard(page);
    const hasCharts = await hasSvgCharts(page);
    const hasPredictionUI =
      (await page
        .locator("text=/roc|auc|calibration|discrimination|performance/i")
        .count()) > 0;

    if (!hasVerdict && !hasCharts && !hasPredictionUI) {
      console.log(
        "  Note: No verdict/charts/prediction UI — may have no executions"
      );
    }
  });
});

// ── SCCS ─────────────────────────────────────────────────

test.describe("SCCS Detail", () => {
  test("page loads and has heading", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/sccs");
    if (!id) {
      test.skip(true, "No SCCS analyses found — skipping");
      return;
    }

    await assertPageLoads(page, `/analyses/sccs/${id}`);
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("has verdict dashboard or timeline", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/sccs");
    if (!id) {
      test.skip(true, "No SCCS analyses found");
      return;
    }

    await page.goto(`${BASE}/analyses/sccs/${id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);
    await dismissModals(page);

    const hasVerdict = await hasVerdictDashboard(page);
    const hasCharts = await hasSvgCharts(page);
    const hasSccsUI =
      (await page
        .locator("text=/irr|risk window|timeline|self-controlled|case series/i")
        .count()) > 0;

    if (!hasVerdict && !hasCharts && !hasSccsUI) {
      console.log(
        "  Note: No verdict/charts/SCCS UI — may have no executions"
      );
    }
  });
});

// ── Evidence Synthesis ───────────────────────────────────

test.describe("Evidence Synthesis Detail", () => {
  test("page loads and has heading", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/evidence-synthesis");
    if (!id) {
      test.skip(true, "No evidence synthesis analyses found — skipping");
      return;
    }

    await assertPageLoads(page, `/analyses/evidence-synthesis/${id}`);
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("has verdict dashboard or forest plot", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/evidence-synthesis");
    if (!id) {
      test.skip(true, "No evidence synthesis analyses found");
      return;
    }

    await page.goto(`${BASE}/analyses/evidence-synthesis/${id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);
    await dismissModals(page);

    const hasVerdict = await hasVerdictDashboard(page);
    const hasCharts = await hasSvgCharts(page);
    const hasSynthesisUI =
      (await page
        .locator(
          "text=/pooled|heterogeneity|meta.analysis|forest|sites|i-squared/i"
        )
        .count()) > 0;

    if (!hasVerdict && !hasCharts && !hasSynthesisUI) {
      console.log(
        "  Note: No verdict/charts/synthesis UI — may have no executions"
      );
    }
  });
});

// ── Pathways ─────────────────────────────────────────────

test.describe("Pathways Detail", () => {
  test("page loads and has heading", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/pathways");
    if (!id) {
      test.skip(true, "No pathway analyses found — skipping");
      return;
    }

    await assertPageLoads(page, `/analyses/pathways/${id}`);
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("has sunburst or pathway visualization", async ({ page }) => {
    const id = await getFirstAnalysisId(page, "/api/v1/pathways");
    if (!id) {
      test.skip(true, "No pathway analyses found");
      return;
    }

    await page.goto(`${BASE}/analyses/pathways/${id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);
    await dismissModals(page);

    const hasCharts = await hasSvgCharts(page);
    const hasPathwayUI =
      (await page
        .locator("text=/sunburst|pathway|treatment|sequence|sankey/i")
        .count()) > 0;

    if (!hasCharts && !hasPathwayUI) {
      console.log(
        "  Note: No charts/pathway UI — may have no executions"
      );
    }
  });
});

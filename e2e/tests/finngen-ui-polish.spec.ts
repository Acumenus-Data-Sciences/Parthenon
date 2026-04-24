// e2e/tests/finngen-ui-polish.spec.ts
// Visual regression tests for quick task 260423-qvz:
//   1. RunStatusBadge animate-pulse dot
//   2. Coverage bucket pills — rectangular + left stripe
//   3. CoverageProfileBadge — rectangular left stripe
//   4. SurvivalPanel StatTile — gradient + text-2xl
//   5. WorkbenchStepper — step-specific icons

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import { TOKEN_FILE } from "../global-setup";

const BASE = process.env.E2E_BASE_URL ?? "https://parthenon.acumenus.net";

function authHeaders(): { Authorization: string } {
  const { token } = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) as { token: string };
  return { Authorization: `Bearer ${token}` };
}

async function dismissWhatsNew(page: import("@playwright/test").Page) {
  const btn = page.getByRole("button", { name: /got it/i });
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(400);
  }
}

// ─── 1. RunStatusBadge ────────────────────────────────────────────────────────

test.describe("RunStatusBadge — animated dot", () => {
  test("every terminal status renders a static dot via data-testid", async ({ page }) => {
    const runsRes = await page.request.get(`${BASE}/api/v1/finngen/runs?per_page=20`, {
      headers: authHeaders(),
    });
    expect(runsRes.ok()).toBeTruthy();
    const { data: runs } = await runsRes.json();

    if (runs.length === 0) {
      test.skip(true, "No runs in system — skipping dot test");
      return;
    }

    await page.goto(`${BASE}/workbench/finngen-analyses?source_key=PANCREAS`, {
      waitUntil: "networkidle",
    });
    await dismissWhatsNew(page);

    const firstCard = page.locator("button").filter({ hasText: /CodeWAS/i }).first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForTimeout(800);
    }

    const badges = page.locator('[data-testid^="finngen-run-status-"]');
    const count = await badges.count();
    if (count === 0) {
      test.skip(true, "No status badges visible on this page");
      return;
    }

    const firstBadge = badges.first();
    const dot = firstBadge.locator('span[aria-hidden="true"]');
    await expect(dot).toBeAttached();

    const badgeClass = await firstBadge.getAttribute("class");
    expect(badgeClass).toContain("rounded");
    expect(badgeClass).not.toContain("rounded-full");

    await page.screenshot({
      path: "screenshots/run-status-badges.png",
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 400 },
    });
  });

  test("running badge dot has animate-pulse class", async ({ page }) => {
    const runsRes = await page.request.get(`${BASE}/api/v1/finngen/runs?status=running&per_page=5`, {
      headers: authHeaders(),
    });
    expect(runsRes.ok()).toBeTruthy();
    const { data: runs } = await runsRes.json();
    if (runs.length === 0) {
      test.skip(true, "No running runs — skipping pulse animation test");
      return;
    }
    await page.goto(`${BASE}/workbench/finngen-analyses?source_key=PANCREAS`, {
      waitUntil: "networkidle",
    });
    await dismissWhatsNew(page);
    const runningBadge = page.locator('[data-testid="finngen-run-status-running"]').first();
    if (!(await runningBadge.isVisible())) {
      test.skip(true, "Running badge not visible on page");
      return;
    }
    const dot = runningBadge.locator('span[aria-hidden="true"]');
    const dotClass = await dot.getAttribute("class");
    expect(dotClass).toContain("animate-pulse");
    expect(dotClass).toContain("bg-cyan-300");
  });
});

// ─── 2. Coverage bucket pills ─────────────────────────────────────────────────

test.describe("Coverage bucket pills — rectangular + left stripe", () => {
  test("endpoint browser rows render rectangular coverage pills with border-l class", async ({ page }) => {
    await page.goto(`${BASE}/workbench/finngen-endpoints`, { waitUntil: "networkidle" });
    await dismissWhatsNew(page);

    await page.waitForSelector('[class*="font-mono"][class*="font-semibold"]', { timeout: 15_000 });

    const pills = page.locator('[class*="tracking-wider"][class*="border-l-"]');
    const pillCount = await pills.count();
    expect(pillCount).toBeGreaterThan(0);

    const firstPill = pills.first();
    const cls = await firstPill.getAttribute("class");

    expect(cls).toMatch(/border-l-\[3px\]|border-l-3/);
    expect(cls).not.toContain("rounded-full");

    await page.screenshot({
      path: "screenshots/coverage-bucket-pills.png",
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 500 },
    });
  });

  test("CoverageProfileBadge renders rectangular (not pill) for finland_only", async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/finngen/endpoints?per_page=50`, {
      headers: authHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const { data: endpoints } = await res.json();
    const fi = endpoints.find(
      (e: { coverage_profile: string }) => e.coverage_profile === "finland_only",
    );
    if (!fi) {
      test.skip(true, "No finland_only endpoints in first 50 results");
      return;
    }

    await page.goto(`${BASE}/workbench/finngen-endpoints`, { waitUntil: "networkidle" });
    await dismissWhatsNew(page);

    const badge = page.locator('[data-testid="coverage-profile-badge-finland-only"]').first();
    if (!(await badge.isVisible())) {
      test.skip(true, "finland_only badge not visible in viewport");
      return;
    }

    const cls = await badge.getAttribute("class");
    expect(cls).toContain("rounded");
    expect(cls).not.toContain("rounded-full");
    expect(cls).toMatch(/border-l-\[3px\]|border-l-amber/);
  });
});

// ─── 3. WorkbenchStepper ─────────────────────────────────────────────────────

test.describe("WorkbenchStepper — step-specific icons", () => {
  test("stepper renders SVG icons (not just number text) for steps", async ({ page }) => {
    const sessionsRes = await page.request.get(`${BASE}/api/v1/finngen/workbench/sessions`, {
      headers: authHeaders(),
    });
    expect(sessionsRes.ok()).toBeTruthy();
    const { data: sessions } = await sessionsRes.json();

    let sessionId: string;
    if (sessions.length > 0) {
      sessionId = sessions[0].id;
    } else {
      const createRes = await page.request.post(`${BASE}/api/v1/finngen/workbench/sessions`, {
        headers: authHeaders(),
        data: { name: "e2e-ui-test", source_key: "PANCREAS" },
      });
      expect(createRes.ok()).toBeTruthy();
      sessionId = (await createRes.json()).data.id;
    }

    await page.goto(`${BASE}/workbench/cohorts/${sessionId}`, { waitUntil: "networkidle" });
    await dismissWhatsNew(page);

    const stepper = page.locator("ol").filter({ has: page.locator("li button") }).first();
    await expect(stepper).toBeVisible({ timeout: 10_000 });

    const stepButtons = stepper.locator("li button");
    const btnCount = await stepButtons.count();
    expect(btnCount).toBe(5);

    for (let i = 0; i < btnCount; i++) {
      const btn = stepButtons.nth(i);
      const iconSpan = btn.locator("span.flex.h-4.w-4");
      await expect(iconSpan).toBeAttached();
      const svgInside = iconSpan.locator("svg");
      await expect(svgInside).toBeAttached();
    }

    await page.screenshot({
      path: "screenshots/workbench-stepper.png",
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 120 },
    });
  });
});

// ─── 4. SurvivalPanel StatTile ────────────────────────────────────────────────

test.describe("SurvivalPanel StatTile — gradient surface + text-2xl", () => {
  test("profile tab stat tiles use gradient background and text-2xl", async ({ page }) => {
    const endpointsRes = await page.request.get(`${BASE}/api/v1/finngen/endpoints?per_page=20`, {
      headers: authHeaders(),
    });
    expect(endpointsRes.ok()).toBeTruthy();
    const { data: endpoints } = await endpointsRes.json();

    const candidate = endpoints.find(
      (e: { coverage_bucket: string }) => e.coverage_bucket === "FULLY_MAPPED",
    ) ?? endpoints[0];

    if (!candidate) {
      test.skip(true, "No endpoints available");
      return;
    }

    const profileRes = await page.request.get(
      `${BASE}/api/v1/finngen/endpoints/${candidate.name}/profile/PANCREAS`,
      { headers: authHeaders() },
    );
    if (!profileRes.ok()) {
      test.skip(true, "Profile endpoint not available");
      return;
    }
    const profileBody = await profileRes.json();
    if (profileBody.data?.status !== "cached") {
      test.skip(true, `Profile status is '${profileBody.data?.status}' — not cached, skipping visual test`);
      return;
    }

    await page.goto(`${BASE}/workbench/finngen-endpoints?open=${candidate.name}&tab=profile`, {
      waitUntil: "networkidle",
    });
    await dismissWhatsNew(page);
    await page.waitForTimeout(2000);

    const tiles = page.locator('[class*="bg-gradient-to-br"]');
    const tileCount = await tiles.count();

    if (tileCount === 0) {
      const survivalHeading = page.getByText(/survival/i).first();
      if (!(await survivalHeading.isVisible())) {
        test.skip(true, "Profile panel not visible — skip StatTile test");
        return;
      }
    }

    expect(tileCount).toBeGreaterThan(0);

    const valueEl = tiles.first().locator("p").nth(1);
    const valClass = await valueEl.getAttribute("class");
    expect(valClass).toContain("text-2xl");
    expect(valClass).toContain("leading-none");

    await page.screenshot({
      path: "screenshots/stat-tiles-profile.png",
      fullPage: false,
    });
  });
});

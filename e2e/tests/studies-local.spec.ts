import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import { TOKEN_FILE } from "../global-setup";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://parthenon.acumenus.net";

function getToken(): string {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")).token ?? "";
  } catch {
    return "";
  }
}

function collectErrors(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) =>
    consoleErrors.push(`[pageerror] ${err.message}`)
  );
  page.on("response", (resp) => {
    if (resp.status() >= 500) {
      failedRequests.push(`${resp.status()} ${resp.url()}`);
    }
  });
  return { consoleErrors, failedRequests };
}

// storageState is inherited from playwright config (global setup auth)
test.describe("Studies Pages", () => {
  test("listing page loads without crash", async ({ page }) => {
    const { consoleErrors } = collectErrors(page);

    await page.goto(`${BASE}/studies`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    expect(page.url()).not.toContain("/login");
    const body = await page.evaluate(() => document.body.innerText);
    expect(body.length).toBeGreaterThan(50);
    console.log(`  Page text (first 100): "${body.slice(0, 100).replace(/\n/g, " ")}"`);

    const errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    expect(errorBoundary).toBe(0);

    const pageErrors = consoleErrors.filter((e) => e.includes("[pageerror]"));
    if (pageErrors.length) console.log("  Page errors:", pageErrors);
    expect(pageErrors.length, `Page errors: ${pageErrors.join("; ")}`).toBe(0);
  });

  test("study detail page + all tabs load without crash", async ({ page }) => {
    const { consoleErrors } = collectErrors(page);

    // Use Bearer token to fetch a study slug
    const resp = await page.request.get(`${BASE}/api/v1/studies?per_page=1`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/json",
      },
    });
    if (resp.status() !== 200) {
      test.skip(true, `Studies API returned ${resp.status()}`);
      return;
    }
    const data = await resp.json();
    const studies = data.data ?? [];
    if (studies.length === 0) {
      test.skip(true, "No studies in database");
      return;
    }
    const slug = studies[0].slug;
    console.log(`  Navigating to study: ${slug}`);

    await page.goto(`${BASE}/studies/${slug}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Dismiss any modal (e.g. changelog "What's New") that may block clicks
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const modalClose = page
      .locator('[class*="modal"] button, [role="dialog"] button')
      .filter({ hasText: /close|dismiss|got it|ok/i })
      .first();
    if ((await modalClose.count()) > 0) {
      await modalClose.click({ force: true });
      await page.waitForTimeout(500);
    }

    console.log(`  At URL: ${page.url()}`);

    // Verify overview loads
    const body = await page.evaluate(() => document.body.innerText);
    expect(body.length).toBeGreaterThan(50);
    console.log(`  Study page text (first 100): "${body.slice(0, 100).replace(/\n/g, " ")}"`);

    let errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    expect(errorBoundary, "Overview tab crashed").toBe(0);
    console.log("  Overview tab — OK");

    // Click each tab and verify no crash
    const tabLabels = [
      "Design",
      "Analyses",
      "Results",
      "Sites",
      "Team",
      "Cohorts",
      "Milestones",
      "Artifacts",
      "Activity",
    ];

    for (const label of tabLabels) {
      const tab = page.locator(`button:has-text("${label}")`).first();
      if ((await tab.count()) > 0) {
        await tab.click();
        await page.waitForTimeout(1500);

        errorBoundary = await page
          .locator("text=/Something went wrong|Unexpected error/i")
          .count();
        if (errorBoundary > 0) {
          const errs = consoleErrors.filter((e) => e.includes("[pageerror]"));
          console.log(`  Tab "${label}" CRASHED:`, errs);
        }
        expect(errorBoundary, `Tab "${label}" triggered error boundary`).toBe(0);
        console.log(`  Tab "${label}" — OK`);
      }
    }

    const pageErrors = consoleErrors.filter((e) => e.includes("[pageerror]"));
    if (pageErrors.length) console.log("  Page errors:", pageErrors);
    expect(pageErrors.length, `Page errors: ${pageErrors.join("; ")}`).toBe(0);
  });
});

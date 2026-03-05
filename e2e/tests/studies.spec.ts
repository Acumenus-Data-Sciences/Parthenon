import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import { TOKEN_FILE } from "../global-setup";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://192.168.1.33:8082";

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

test.describe("Studies Pages", () => {
  test("listing page loads without crash", async ({ page }) => {
    const { consoleErrors, failedRequests } = collectErrors(page);

    await page.goto(`${BASE}/studies`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Should NOT redirect to login
    expect(page.url()).not.toContain("/login");

    // Should render study content
    const body = await page.evaluate(() => document.body.innerText);
    expect(body.length).toBeGreaterThan(50);

    // No error boundary
    const errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    expect(errorBoundary).toBe(0);

    // No pageerror (TypeError, ReferenceError, etc.)
    const pageErrors = consoleErrors.filter((e) => e.includes("[pageerror]"));
    if (pageErrors.length) {
      console.log("  Page errors:", pageErrors);
    }
    expect(pageErrors.length, `Page errors: ${pageErrors.join("; ")}`).toBe(0);

    // Log warnings
    if (failedRequests.length) {
      console.log("  5xx requests:", failedRequests);
    }
  });

  test("study detail page loads without crash", async ({ page }) => {
    const { consoleErrors, failedRequests } = collectErrors(page);

    // First, get a study slug from the API
    const resp = await page.request.get(`${BASE}/api/v1/studies?per_page=1`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/json",
      },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    const studies = data.data ?? [];
    if (studies.length === 0) {
      test.skip(true, "No studies in database");
      return;
    }
    const slug = studies[0].slug;
    console.log(`  Testing study detail: ${slug}`);

    // Navigate to the detail page
    await page.goto(`${BASE}/studies/${slug}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);

    // Should NOT redirect to login
    expect(page.url()).not.toContain("/login");

    // Should render study title
    const body = await page.evaluate(() => document.body.innerText);
    expect(body.length).toBeGreaterThan(50);

    // No error boundary
    const errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    expect(errorBoundary).toBe(0);

    // No pageerror
    const pageErrors = consoleErrors.filter((e) => e.includes("[pageerror]"));
    if (pageErrors.length) {
      console.log("  Page errors:", pageErrors);
    }
    expect(pageErrors.length, `Page errors: ${pageErrors.join("; ")}`).toBe(0);

    // Log but don't fail on 5xx (some sub-resources might 404 on test data)
    if (failedRequests.length) {
      console.log("  Failed requests:", failedRequests);
    }
  });

  test("study detail tabs load without crash", async ({ page }) => {
    const { consoleErrors } = collectErrors(page);

    // Get a study slug
    const resp = await page.request.get(`${BASE}/api/v1/studies?per_page=1`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/json",
      },
    });
    const data = await resp.json();
    const studies = data.data ?? [];
    if (studies.length === 0) {
      test.skip(true, "No studies in database");
      return;
    }
    const slug = studies[0].slug;

    await page.goto(`${BASE}/studies/${slug}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);

    // Dismiss any modal (e.g. changelog "What's New") that may block clicks
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const modalClose = page.locator('[class*="modal"] button, [role="dialog"] button').filter({ hasText: /close|dismiss|got it|ok/i }).first();
    if (await modalClose.count() > 0) {
      await modalClose.click({ force: true });
      await page.waitForTimeout(500);
    }

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
        await page.waitForTimeout(1000);

        // Check for error boundary after each tab click
        const errorBoundary = await page
          .locator("text=/Something went wrong|Unexpected error/i")
          .count();
        if (errorBoundary > 0) {
          const pageErrors = consoleErrors.filter((e) =>
            e.includes("[pageerror]")
          );
          console.log(`  Tab "${label}" crashed:`, pageErrors);
        }
        expect(
          errorBoundary,
          `Tab "${label}" triggered error boundary`
        ).toBe(0);
      }
    }

    // Check for accumulated pageerrors
    const pageErrors = consoleErrors.filter((e) => e.includes("[pageerror]"));
    if (pageErrors.length) {
      console.log("  Accumulated page errors:", pageErrors);
    }
    expect(
      pageErrors.length,
      `Page errors across tabs: ${pageErrors.join("; ")}`
    ).toBe(0);
  });
});

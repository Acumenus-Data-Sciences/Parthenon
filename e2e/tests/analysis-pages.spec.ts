import { test, expect } from "@playwright/test";
import { BASE, dismissModals } from "./helpers";

const analysisPages = [
  { name: "SCCS #1", path: "/analyses/sccs/1" },
  { name: "SCCS #2", path: "/analyses/sccs/2" },
  { name: "Estimation #1", path: "/analyses/estimations/1" },
  { name: "Prediction #1", path: "/analyses/predictions/1" },
];

for (const { name, path } of analysisPages) {
  test(`${name} detail page loads without crash`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Should NOT show React error boundary
    const errorBoundary = page.getByText("Unexpected Application Error");
    await expect(errorBoundary).not.toBeVisible();

    // Should NOT have JS errors about undefined properties
    const crashErrors = errors.filter((e) => e.includes("Cannot read properties"));
    expect(crashErrors).toEqual([]);

    // Should have some visible content (heading or page body)
    const bodyLen = await page.evaluate(() => document.body.innerText.trim().length);
    expect(bodyLen).toBeGreaterThan(10);
  });
}

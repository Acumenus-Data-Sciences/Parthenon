import { test, expect } from "@playwright/test";

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

    await page.goto(path, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Should NOT show React error boundary
    const errorBoundary = page.getByText("Unexpected Application Error");
    await expect(errorBoundary).not.toBeVisible();

    // Should NOT have JS errors about undefined properties
    const crashErrors = errors.filter((e) => e.includes("Cannot read properties"));
    expect(crashErrors).toEqual([]);

    // Should have a visible heading
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
  });
}

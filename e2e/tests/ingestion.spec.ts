import { test, expect } from "@playwright/test";
import {
  assertPageLoads,
  dismissModals,
} from "./helpers";

test.describe("Data Ingestion", () => {
  test("dashboard page loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/ingestion");
  });

  test("upload page loads without crash", async ({ page }) => {
    await assertPageLoads(page, "/ingestion/upload");
  });

  test("upload page has file input or drop zone", async ({ page }) => {
    await assertPageLoads(page, "/ingestion/upload");
    await dismissModals(page);

    // Look for file input or drag-and-drop zone
    const fileInput = page.locator('input[type="file"]');
    const dropZone = page.locator('[class*="drop"], [class*="upload"], [class*="dropzone"]');

    const fileInputCount = await fileInput.count();
    const dropZoneCount = await dropZone.count();

    expect(
      fileInputCount + dropZoneCount,
      "Expected file input or drop zone on upload page"
    ).toBeGreaterThan(0);
  });

  test("upload page has format selector or instructions", async ({ page }) => {
    await assertPageLoads(page, "/ingestion/upload");
    await dismissModals(page);

    // Look for format selection (dropdown, radio buttons, tabs) or instruction text
    const formatSelector = page.locator(
      'select, [role="combobox"], [role="radiogroup"], input[type="radio"]'
    );
    const instructions = page.locator(
      'text=/format|CSV|OMOP|CDM|file type|supported/i'
    );

    const formatCount = await formatSelector.count();
    const instructionCount = await instructions.count();

    expect(
      formatCount + instructionCount,
      "Expected format selector or upload instructions"
    ).toBeGreaterThan(0);
  });
});

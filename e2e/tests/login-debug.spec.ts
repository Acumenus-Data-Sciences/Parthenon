import { test, expect } from "@playwright/test";

const BASE = "https://parthenon.acumenus.net";
const EMAIL = "admin@parthenon.local";
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD ?? "superuser";

test("debug login", async ({ browser }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // Capture all network responses
  const responses: string[] = [];
  page.on("response", (resp) => {
    if (resp.url().includes("/api/") || resp.url().includes("/sanctum/") || resp.url().includes("/login")) {
      responses.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
    }
  });

  // Go to login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Fill form
  const emailField = page.locator('input[type="email"], input[name="email"]').first();
  const passwordField = page.locator('input[type="password"]').first();
  const submitBtn = page.locator('button[type="submit"]').first();

  console.log("  Email field visible:", await emailField.isVisible());
  console.log("  Password field visible:", await passwordField.isVisible());
  console.log("  Submit button visible:", await submitBtn.isVisible());

  await emailField.fill(EMAIL);
  await passwordField.fill(PASSWORD);

  console.log("  Email value:", await emailField.inputValue());
  console.log("  Password value length:", (await passwordField.inputValue()).length);

  // Click and wait for any network activity
  await submitBtn.click();
  await page.waitForTimeout(5000);

  // Check for error messages
  const errorText = await page.locator('[class*="error"], [class*="alert"], [role="alert"], .text-red-500, .text-destructive').allTextContents();
  console.log("  Error messages:", errorText);

  // Check current URL
  console.log("  Current URL:", page.url());

  // Log all API responses
  console.log("  Network responses:");
  for (const r of responses) {
    console.log("    ", r);
  }

  // Take screenshot
  await page.screenshot({ path: "test-results/login-debug.png", fullPage: true });

  // Check page content
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("  Body text (first 500):", bodyText.slice(0, 500));

  await context.close();
});

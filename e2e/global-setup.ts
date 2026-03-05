import { chromium, FullConfig } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://192.168.1.33:8082";
const EMAIL = process.env.PLAYWRIGHT_EMAIL ?? "admin@parthenon.local";
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD ?? "superuser";
export const AUTH_FILE = path.join(__dirname, ".auth/user.json");
export const TOKEN_FILE = path.join(__dirname, ".auth/token.json");

export default async function globalSetup(_config: FullConfig) {
  // Ensure .auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // Navigate to login page first (sets session cookie + triggers CSRF cookie)
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Get CSRF token after the page has loaded it
  const cookies = await context.cookies();
  const xsrfCookie = cookies.find((c) => c.name === "XSRF-TOKEN");
  const xsrfToken = xsrfCookie ? decodeURIComponent(xsrfCookie.value) : "";

  // Login via API to get Bearer token
  const loginResp = await context.request.post(`${BASE}/api/v1/auth/login`, {
    headers: {
      "Content-Type": "application/json",
      "X-XSRF-TOKEN": xsrfToken,
      "Accept": "application/json",
    },
    data: { email: EMAIL, password: PASSWORD },
  });

  const loginBody = await loginResp.json();
  const token: string = loginBody.token ?? "";
  if (!token) {
    console.error("  ✗ API login failed:", JSON.stringify(loginBody));
    throw new Error(`API login returned no token (status ${loginResp.status()})`);
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token }), "utf8");

  // Browser login for storage state (SPA form submit)
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 20_000,
  });

  console.log(`\n  ✓ Logged in as ${EMAIL}, session + token saved`);
  console.log(`  Token: ${token.slice(0, 12)}...`);

  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}

import { chromium, FullConfig } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8082";
const EMAIL = process.env.PLAYWRIGHT_EMAIL ?? "admin@acumenus.net";
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

  async function fetchUserForToken(token: string) {
    const resp = await context.request.get(`${BASE}/api/v1/auth/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!resp.ok()) return null;
    return await resp.json();
  }

  let token = "";
  let user: unknown = null;

  // Reuse a previously saved token when possible to avoid hitting login throttles.
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      const savedToken = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")).token ?? "";
      if (savedToken) {
        const savedUser = await fetchUserForToken(savedToken);
        if (savedUser) {
          token = savedToken;
          user = savedUser;
          console.log(`  ✓ Reusing saved token for ${EMAIL}`);
        }
      }
    } catch {
      // fall through to fresh login
    }
  }

  if (!token) {
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
    token = loginBody.token ?? "";
    user = loginBody.user ?? null;
    if (!token) {
      console.error("  ✗ API login failed:", JSON.stringify(loginBody));
      throw new Error(`API login returned no token (status ${loginResp.status()})`);
    }
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token }), "utf8");
  }

  // Seed the persisted auth store directly; the SPA authenticates from localStorage.
  await page.evaluate(
    ({ seededToken, seededUser }) => {
      localStorage.setItem(
        "parthenon-auth",
        JSON.stringify({
          state: {
            token: seededToken,
            user: seededUser,
            isAuthenticated: true,
          },
          version: 0,
        }),
      );
    },
    { seededToken: token, seededUser: user },
  );

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 20_000,
  });

  // Mark onboarding as completed so the modal doesn't block tests
  const onboardingResp = await context.request.put(
    `${BASE}/api/v1/user/onboarding`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
  );
  if (onboardingResp.ok()) {
    console.log(`  ✓ Onboarding marked complete`);
  } else {
    console.log(`  ⚠ Could not complete onboarding (${onboardingResp.status()}) — modal may block tests`);
  }

  console.log(`\n  ✓ Logged in as ${EMAIL}, session + token saved`);
  console.log(`  Token: ${token.slice(0, 12)}...`);

  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { BASE, authHeaders, dismissModals, getToken } from "./helpers";

type SmokeLocale = {
  locale: string;
  dir: "ltr" | "rtl";
};

type AuthUser = {
  id: number;
  name?: string;
  email?: string;
  locale?: string | null;
  [key: string]: unknown;
};

const SCREENSHOT_DIR = path.join(
  __dirname,
  "..",
  "screenshots",
  "i18n-visual-smoke",
);

const SMOKE_LOCALES: SmokeLocale[] = [
  { locale: "en-US", dir: "ltr" },
  { locale: "es-ES", dir: "ltr" },
  { locale: "ko-KR", dir: "ltr" },
];

const HELP_BUTTON_NAME = new RegExp(
  [
    "open contextual help",
    "open help",
    "help",
    "abrir ayuda contextual",
    "abrir ayuda",
    "ayuda",
    "상황별 도움말 열기",
    "도움말 열기",
    "도움말",
  ].join("|"),
  "i",
);

async function currentUser(page: Page): Promise<AuthUser> {
  const response = await page.request.get(`${BASE}/api/v1/auth/user`, {
    headers: authHeaders(),
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as AuthUser;
}

async function saveLocale(page: Page, locale: string): Promise<void> {
  const response = await page.request.put(`${BASE}/api/v1/user/locale`, {
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    data: { locale },
  });
  expect(response.status()).toBe(200);
}

async function seedStoredLocale(page: Page, locale: string): Promise<void> {
  const user = await currentUser(page);
  const token = getToken();

  await page.addInitScript(
    ({ seededToken, seededUser, seededLocale }) => {
      localStorage.setItem("parthenon-locale", seededLocale);
      localStorage.setItem(
        "parthenon-auth",
        JSON.stringify({
          state: {
            token: seededToken,
            user: { ...seededUser, locale: seededLocale },
            isAuthenticated: true,
          },
          version: 0,
        }),
      );
    },
    { seededToken: token, seededUser: user, seededLocale: locale },
  );
}

async function expectDocumentLocale(
  page: Page,
  locale: string,
  direction: "ltr" | "rtl",
): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.lang))
    .toBe(locale);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dir))
    .toBe(direction);
}

async function expectNoCrash(page: Page): Promise<void> {
  await expect(
    page.locator("text=/Something went wrong|Unexpected error|chunk load failed/i"),
  ).toHaveCount(0);

  const bodyLength = await page.evaluate(() => document.body.innerText.trim().length);
  expect(bodyLength).toBeGreaterThan(10);
}

async function openLocalizedRoute(
  page: Page,
  locale: SmokeLocale,
  route: string,
): Promise<void> {
  await saveLocale(page, locale.locale);
  await seedStoredLocale(page, locale.locale);
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await dismissModals(page);
  await expectNoCrash(page);
  await expectDocumentLocale(page, locale.locale, locale.dir);
}

async function writeScreenshot(page: Page, fileName: string): Promise<void> {
  const screenshotPath = path.join(SCREENSHOT_DIR, fileName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const stats = fs.statSync(screenshotPath);
  expect(stats.size).toBeGreaterThan(1_000);
}

test.describe("i18n visual smoke", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test.afterEach(async ({ page }) => {
    await saveLocale(page, "en-US");
  });

  for (const locale of SMOKE_LOCALES) {
    test(`captures translated shell surfaces in ${locale.locale}`, async ({ page }) => {
      test.setTimeout(90_000);

      await openLocalizedRoute(page, locale, "/");
      await writeScreenshot(page, `${locale.locale}-dashboard.png`);

      const languageSelect = page.locator('select:has(option[value="es-ES"])').first();
      await expect(languageSelect).toBeVisible();
      await languageSelect.screenshot({
        path: path.join(SCREENSHOT_DIR, `${locale.locale}-language-selector.png`),
      });

      const helpButton = page.getByRole("button", { name: HELP_BUTTON_NAME }).first();
      await expect(helpButton).toBeVisible();
      await helpButton.click();
      await page.waitForTimeout(1_500);

      const helpSurface = page
        .locator('[role="dialog"], [class*="slide"], [class*="drawer"]')
        .first();
      await expect(helpSurface).toBeVisible();
      await expectNoCrash(page);
      await writeScreenshot(page, `${locale.locale}-dashboard-help.png`);

      await openLocalizedRoute(page, locale, "/nonexistent-page-xyz");
      await writeScreenshot(page, `${locale.locale}-route-error.png`);

      await openLocalizedRoute(page, locale, "/admin/auth-providers");
      await expect(page).not.toHaveURL(/\/login/);
      await writeScreenshot(page, `${locale.locale}-admin-auth-providers.png`);
    });
  }
});

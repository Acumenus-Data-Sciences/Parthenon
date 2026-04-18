import { test, expect, type Page } from "@playwright/test";
import { BASE, authHeaders, dismissModals, getToken } from "./helpers";

type AuthUser = {
  id: number;
  name?: string;
  email?: string;
  locale?: string | null;
  [key: string]: unknown;
};

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

async function expectHealthyShell(page: Page): Promise<void> {
  await dismissModals(page);

  const bodyLength = await page.evaluate(() => document.body.innerText.trim().length);
  expect(bodyLength).toBeGreaterThan(10);

  await expect(
    page.locator("text=/Something went wrong|Unexpected error|chunk load failed/i"),
  ).toHaveCount(0);
}

test.describe("i18n shell runtime", () => {
  test.afterEach(async ({ page }) => {
    await saveLocale(page, "en-US");
  });

  test("topnav selector exposes certified public locales and persists Spanish and Korean", async ({
    page,
  }) => {
    await saveLocale(page, "en-US");
    await seedStoredLocale(page, "en-US");

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await expectHealthyShell(page);

    const languageSelect = page.locator('select:has(option[value="es-ES"])').first();
    await expect(languageSelect).toBeVisible();

    const optionValues = await languageSelect.locator("option").evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
    expect(optionValues).toEqual(["en-US", "es-ES", "ko-KR"]);

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v1/user/locale") &&
          response.request().method() === "PUT" &&
          response.status() === 200,
      ),
      languageSelect.selectOption("es-ES"),
    ]);
    await expectDocumentLocale(page, "es-ES", "ltr");
    expect((await currentUser(page)).locale).toBe("es-ES");

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/v1/user/locale") &&
          response.request().method() === "PUT" &&
          response.status() === 200,
      ),
      languageSelect.selectOption("ko-KR"),
    ]);
    await expectDocumentLocale(page, "ko-KR", "ltr");
    expect((await currentUser(page)).locale).toBe("ko-KR");
  });

  test("authenticated shell can render the pseudolocale", async ({ page }) => {
    await seedStoredLocale(page, "en-XA");

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await expectHealthyShell(page);
    await expectDocumentLocale(page, "en-XA", "ltr");
    await expect(page.locator("body")).toContainText("[!!");
  });

  test("authenticated shell applies RTL document metadata for Arabic canary", async ({
    page,
  }) => {
    await seedStoredLocale(page, "ar");

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await expectHealthyShell(page);
    await expectDocumentLocale(page, "ar", "rtl");
  });
});

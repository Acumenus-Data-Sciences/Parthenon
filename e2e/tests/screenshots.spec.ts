/**
 * Full application screenshot library.
 *
 * Generates a route x locale x theme matrix under:
 *   e2e/screenshots/application-library/
 *
 * Defaults to the requested review set:
 *   - locales: en-US, es-ES, ko-KR
 *   - themes: dark, light
 *
 * Optional env overrides:
 *   SCREENSHOT_LOCALES=en-US,es-ES,ko-KR
 *   SCREENSHOT_THEMES=dark,light
 *   SCREENSHOT_WAIT_MS=1800
 */
import { expect, test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { BASE, authHeaders, dismissModals, getToken } from "./helpers";

type Theme = "dark" | "light";

type LocaleTarget = {
  code: "es-ES" | "ko-KR" | "en-US";
  label: string;
  dir: "ltr";
};

type ScreenshotRoute = {
  group: string;
  path: string;
  label: string;
  public?: boolean;
  validateShell?: boolean;
};

type ManifestEntry = {
  group: string;
  label: string;
  route: string;
  locale: string;
  theme: Theme;
  file: string;
  status: "captured" | "captured-with-warning" | "failed";
  warning?: string;
  bodyCharacters?: number;
  finalUrl?: string;
  capturedAt: string;
};

type AuthUser = {
  id: number;
  name?: string;
  email?: string;
  locale?: string | null;
  theme_preference?: Theme | null;
  [key: string]: unknown;
};

const LIBRARY_DIR = path.join(__dirname, "..", "screenshots", "application-library");
const MANIFEST_PATH = path.join(LIBRARY_DIR, "manifest.json");
const INDEX_PATH = path.join(LIBRARY_DIR, "index.html");
const DEFAULT_WAIT_MS = Number(process.env.SCREENSHOT_WAIT_MS ?? "1800");

const LOCALES: LocaleTarget[] = [
  { code: "es-ES", label: "Spanish", dir: "ltr" },
  { code: "ko-KR", label: "Korean", dir: "ltr" },
  { code: "en-US", label: "English", dir: "ltr" },
];

const DEFAULT_LOCALES = ["en-US", "es-ES", "ko-KR"];
const DEFAULT_THEMES: Theme[] = ["dark", "light"];

const ROUTES: ScreenshotRoute[] = [
  { group: "Auth", path: "/login", label: "login", public: true },
  { group: "Auth", path: "/register", label: "register", public: true },

  { group: "Core", path: "/", label: "dashboard" },
  { group: "Core", path: "/data-sources", label: "data-sources" },
  { group: "Core", path: "/data-explorer", label: "data-explorer" },
  { group: "Core", path: "/publish", label: "publish" },
  { group: "Core", path: "/query-assistant", label: "query-assistant" },
  { group: "Core", path: "/settings", label: "settings" },

  { group: "Research", path: "/vocabulary", label: "vocabulary" },
  { group: "Research", path: "/vocabulary/compare", label: "vocabulary-compare" },
  { group: "Research", path: "/mapping-assistant", label: "mapping-assistant" },
  { group: "Research", path: "/cohort-definitions", label: "cohort-definitions" },
  { group: "Research", path: "/concept-sets", label: "concept-sets" },
  { group: "Research", path: "/analyses", label: "analyses" },
  { group: "Research", path: "/studies", label: "studies" },
  { group: "Research", path: "/studies/create", label: "studies-create" },
  { group: "Research", path: "/study-packages", label: "study-packages" },
  { group: "Research", path: "/phenotype-library", label: "phenotype-library" },
  { group: "Research", path: "/standard-pros", label: "standard-pros" },
  { group: "Research", path: "/patient-similarity", label: "patient-similarity" },
  { group: "Research", path: "/patient-similarity/compare", label: "patient-similarity-compare" },
  { group: "Research", path: "/risk-scores", label: "risk-scores" },
  { group: "Research", path: "/risk-scores/create", label: "risk-scores-create" },
  { group: "Research", path: "/commons", label: "commons" },

  { group: "Workbench", path: "/workbench", label: "workbench" },
  { group: "Workbench", path: "/workbench/cohorts", label: "workbench-cohorts" },
  { group: "Workbench", path: "/workbench/finngen-analyses", label: "workbench-finngen-analyses" },
  { group: "Workbench", path: "/workbench/finngen-endpoints", label: "workbench-finngen-endpoints" },
  { group: "Workbench", path: "/workbench/community-sdk-demo", label: "workbench-community-sdk-demo" },
  { group: "Workbench", path: "/workbench/care-bundles", label: "workbench-care-bundles" },
  { group: "Workbench", path: "/workbench/care-bundles/intersect", label: "workbench-care-bundles-intersect" },
  { group: "Workbench", path: "/workbench/care-bundles/value-sets", label: "workbench-care-bundles-value-sets" },
  { group: "Workbench", path: "/workbench/care-bundles/measures", label: "workbench-care-bundles-measures" },
  { group: "Workbench", path: "/workbench/investigation", label: "workbench-investigation" },
  { group: "Workbench", path: "/workbench/investigation/new", label: "workbench-investigation-new" },

  { group: "Specialized", path: "/profiles", label: "profiles" },
  { group: "Specialized", path: "/care-gaps", label: "care-gaps" },
  { group: "Specialized", path: "/jobs", label: "jobs" },
  { group: "Specialized", path: "/ingestion", label: "ingestion" },
  { group: "Specialized", path: "/ingestion/upload", label: "ingestion-upload" },
  { group: "Specialized", path: "/genomics", label: "genomics" },
  { group: "Specialized", path: "/genomics/analysis", label: "genomics-analysis" },
  { group: "Specialized", path: "/genomics/tumor-board", label: "genomics-tumor-board" },
  { group: "Specialized", path: "/imaging", label: "imaging" },
  { group: "Specialized", path: "/heor", label: "heor" },
  { group: "Specialized", path: "/gis", label: "gis" },
  { group: "Specialized", path: "/morpheus", label: "morpheus" },
  { group: "Specialized", path: "/morpheus/journey", label: "morpheus-journey" },
  {
    group: "Specialized",
    path: "/jupyter",
    label: "jupyter",
    validateShell: false,
  },

  { group: "Admin", path: "/admin", label: "admin" },
  { group: "Admin", path: "/admin/users", label: "admin-users" },
  { group: "Admin", path: "/admin/user-audit", label: "admin-user-audit" },
  { group: "Admin", path: "/admin/roles", label: "admin-roles" },
  { group: "Admin", path: "/admin/auth-providers", label: "admin-auth-providers" },
  { group: "Admin", path: "/admin/ai-providers", label: "admin-ai-providers" },
  { group: "Admin", path: "/admin/system-health", label: "admin-system-health" },
  { group: "Admin", path: "/admin/honest-broker", label: "admin-honest-broker" },
  { group: "Admin", path: "/admin/vocabulary", label: "admin-vocabulary" },
  { group: "Admin", path: "/admin/webapi-registry", label: "admin-webapi-registry" },
  { group: "Admin", path: "/admin/fhir-connections", label: "admin-fhir-connections" },
  { group: "Admin", path: "/admin/fhir-sync-monitor", label: "admin-fhir-sync-monitor" },
  { group: "Admin", path: "/admin/solr", label: "admin-solr" },
  { group: "Admin", path: "/admin/notifications", label: "admin-notifications" },
  { group: "Admin", path: "/admin/fhir-export", label: "admin-fhir-export" },
];

const manifestEntries: ManifestEntry[] = [];
let cachedUser: AuthUser | null = null;

function parseLocales(): LocaleTarget[] {
  const requested = (process.env.SCREENSHOT_LOCALES ?? DEFAULT_LOCALES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return requested.map((code) => {
    const locale = LOCALES.find((item) => item.code === code);
    if (!locale) {
      throw new Error(
        `Unsupported SCREENSHOT_LOCALES value "${code}". Use one of: ${LOCALES.map((item) => item.code).join(", ")}`,
      );
    }
    return locale;
  });
}

function parseThemes(): Theme[] {
  const requested = (process.env.SCREENSHOT_THEMES ?? DEFAULT_THEMES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return requested.map((theme) => {
    if (theme !== "dark" && theme !== "light") {
      throw new Error('Unsupported SCREENSHOT_THEMES value "' + theme + '". Use dark or light.');
    }
    return theme;
  });
}

function ensureCleanLibraryDir(): void {
  fs.rmSync(LIBRARY_DIR, { recursive: true, force: true });
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
}

function routeUrl(routePath: string, locale: LocaleTarget): string {
  const url = new URL(routePath, BASE);
  url.searchParams.set("locale", locale.code);
  return url.toString();
}

function routeFileName(index: number, route: ScreenshotRoute): string {
  return `${String(index + 1).padStart(2, "0")}-${route.label}.png`;
}

async function currentUser(page: Page): Promise<AuthUser> {
  if (cachedUser) return cachedUser;

  const response = await page.request.get(`${BASE}/api/v1/auth/user`, {
    headers: authHeaders(),
  });

  expect(response.status()).toBe(200);
  cachedUser = (await response.json()) as AuthUser;
  return cachedUser;
}

async function seedBrowserState(
  page: Page,
  locale: LocaleTarget,
  theme: Theme,
): Promise<void> {
  const token = getToken();
  const user = await currentUser(page);

  await page.addInitScript(
    ({ seededToken, seededUser, seededLocale, seededTheme }) => {
      localStorage.setItem("parthenon-locale", seededLocale);
      localStorage.setItem("parthenon-theme", seededTheme);

      localStorage.setItem(
        "parthenon-auth",
        JSON.stringify({
          state: {
            token: seededToken,
            user: {
              ...seededUser,
              locale: seededLocale,
              theme_preference: seededTheme,
            },
            isAuthenticated: true,
            rememberMe: true,
          },
          version: 0,
        }),
      );
    },
    {
      seededToken: token,
      seededUser: user,
      seededLocale: locale.code,
      seededTheme: theme,
    },
  );
}

async function captureRoute(
  page: Page,
  route: ScreenshotRoute,
  routeIndex: number,
  locale: LocaleTarget,
  theme: Theme,
): Promise<void> {
  const outputDir = path.join(LIBRARY_DIR, locale.code, theme);
  fs.mkdirSync(outputDir, { recursive: true });

  const fileName = routeFileName(routeIndex, route);
  const screenshotPath = path.join(outputDir, fileName);
  const relativeFile = path.relative(LIBRARY_DIR, screenshotPath);

  const capturedAt = new Date().toISOString();
  const warnings: string[] = [];

  try {
    await page.goto(routeUrl(route.path, locale), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(DEFAULT_WAIT_MS);
    await dismissModals(page).catch(() => undefined);

    const documentState = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      light: document.documentElement.classList.contains("light"),
      bodyCharacters: document.body.innerText.trim().length,
    }));

    if (route.validateShell !== false) {
      if (documentState.lang !== locale.code) {
        warnings.push(`document lang was ${documentState.lang || "(blank)"}`);
      }

      if (documentState.dir !== locale.dir) {
        warnings.push(`document dir was ${documentState.dir || "(blank)"}`);
      }

      if (documentState.light !== (theme === "light")) {
        warnings.push("document theme class did not match requested theme");
      }
    }

    if (!route.public && page.url().includes("/login")) {
      warnings.push("protected route redirected to login");
    }

    if (documentState.bodyCharacters < 10) {
      warnings.push(`body had ${documentState.bodyCharacters} visible characters`);
    }

    const errorBoundaryCount = await page
      .locator("text=/Something went wrong|Unexpected error|chunk load failed/i")
      .count();
    if (errorBoundaryCount > 0) {
      warnings.push("error boundary text was visible");
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    const size = fs.statSync(screenshotPath).size;
    if (size < 1_000) {
      warnings.push(`screenshot was only ${size} bytes`);
    }

    manifestEntries.push({
      group: route.group,
      label: route.label,
      route: route.path,
      locale: locale.code,
      theme,
      file: relativeFile,
      status: warnings.length ? "captured-with-warning" : "captured",
      warning: warnings.join("; ") || undefined,
      bodyCharacters: documentState.bodyCharacters,
      finalUrl: page.url(),
      capturedAt,
    });
  } catch (error) {
    manifestEntries.push({
      group: route.group,
      label: route.label,
      route: route.path,
      locale: locale.code,
      theme,
      file: relativeFile,
      status: "failed",
      warning: error instanceof Error ? error.message : String(error),
      capturedAt,
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writeManifestAndIndex(locales: LocaleTarget[], themes: Theme[]): void {
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    routeCount: ROUTES.length,
    locales: locales.map((locale) => locale.code),
    themes,
    screenshotCount: manifestEntries.length,
    entries: manifestEntries,
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

  const byLocaleTheme = new Map<string, ManifestEntry[]>();
  for (const entry of manifestEntries) {
    const key = `${entry.locale}/${entry.theme}`;
    const existing = byLocaleTheme.get(key) ?? [];
    existing.push(entry);
    byLocaleTheme.set(key, existing);
  }

  const sections = Array.from(byLocaleTheme.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entries]) => {
      const cards = entries
        .map((entry) => {
          const badgeClass =
            entry.status === "captured"
              ? "ok"
              : entry.status === "failed"
                ? "failed"
                : "warn";
          const imageHtml =
            entry.status === "failed"
              ? `<div class="missing">Capture failed</div>`
              : `<a href="${escapeHtml(entry.file)}"><img src="${escapeHtml(entry.file)}" alt="${escapeHtml(entry.label)}"></a>`;

          return `
            <article>
              ${imageHtml}
              <div class="meta">
                <strong>${escapeHtml(entry.label)}</strong>
                <span>${escapeHtml(entry.route)}</span>
                <span class="${badgeClass}">${escapeHtml(entry.status)}</span>
                ${entry.warning ? `<small>${escapeHtml(entry.warning)}</small>` : ""}
              </div>
            </article>
          `;
        })
        .join("\n");

      return `
        <section>
          <h2>${escapeHtml(key)}</h2>
          <div class="grid">${cards}</div>
        </section>
      `;
    })
    .join("\n");

  fs.writeFileSync(
    INDEX_PATH,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Parthenon Screenshot Library</title>
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #101114;
      color: #f7f2e8;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 18px 24px;
      background: rgba(16, 17, 20, 0.94);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(16px);
    }
    h1 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 650;
    }
    p {
      margin: 0;
      color: #b8b0a3;
      font-size: 14px;
    }
    section {
      padding: 24px;
    }
    h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 650;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 18px;
    }
    article {
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background: #181a1f;
    }
    img,
    .missing {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 10;
      object-fit: cover;
      object-position: top left;
      background: #0a0b0d;
    }
    .missing {
      display: grid;
      place-items: center;
      color: #ffb4a8;
    }
    .meta {
      display: grid;
      gap: 4px;
      padding: 12px;
      font-size: 13px;
    }
    .meta span {
      color: #b8b0a3;
    }
    .meta small {
      color: #ffcf99;
      line-height: 1.4;
    }
    .ok,
    .warn,
    .failed {
      width: fit-content;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
    }
    .ok {
      color: #c9ffd9;
      background: rgba(42, 143, 82, 0.24);
    }
    .warn {
      color: #ffe1a6;
      background: rgba(185, 126, 34, 0.24);
    }
    .failed {
      color: #ffb4a8;
      background: rgba(191, 58, 58, 0.24);
    }
  </style>
</head>
<body>
  <header>
    <h1>Parthenon Screenshot Library</h1>
    <p>${manifest.screenshotCount} captures from ${manifest.routeCount} routes at ${escapeHtml(manifest.generatedAt)}. Base URL: ${escapeHtml(BASE)}.</p>
  </header>
  ${sections}
</body>
</html>
`,
  );
}

test.describe("application screenshot library", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Screenshot library is Chromium-only.");
  test.describe.configure({ mode: "serial" });

  const locales = parseLocales();
  const themes = parseThemes();

  test.beforeAll(() => {
    ensureCleanLibraryDir();
  });

  test.afterAll(() => {
    writeManifestAndIndex(locales, themes);
  });

  for (const locale of locales) {
    for (const theme of themes) {
      test(`captures ${locale.label} ${theme} screenshot library`, async ({ page }) => {
        test.setTimeout(Math.max(240_000, ROUTES.length * 12_000));

        await page.setViewportSize({ width: 1440, height: 1100 });
        await seedBrowserState(page, locale, theme);

        for (const [routeIndex, route] of ROUTES.entries()) {
          await captureRoute(page, route, routeIndex, locale, theme);
        }
      });
    }
  }
});

/**
 * Shared E2E test helpers for Parthenon.
 *
 * Every test file should import from here instead of duplicating
 * error collection, auth helpers, and data-env patterns.
 */
import { Page } from "@playwright/test";
import * as fs from "fs";
import { TOKEN_FILE } from "../global-setup";

export const BASE =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://192.168.1.33:8082";

// ── Auth ──────────────────────────────────────────────────

export function getToken(): string {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")).token ?? "";
  } catch {
    return "";
  }
}

export function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: "application/json",
  };
}

// ── Error collection ──────────────────────────────────────

/** Endpoints that may 5xx due to missing OMOP/CDM data — not code bugs. */
const DATA_ENV_PATTERNS = [
  "/achilles/",
  "/data-quality/",
  "/cdm/",
  "/vocabulary/search",
  "/genomics/variants",
  "/imaging/studies",
  "/imaging/wado",
  "/heor/",
  "/ollama",
  "/ai/",
  "/r-runtime/",
  "/solr/",
];

function isDataEnvFailure(url: string): boolean {
  return DATA_ENV_PATTERNS.some((p) => url.includes(p));
}

export interface CollectedErrors {
  consoleErrors: string[];
  failedRequests: string[];
  pageErrors: string[];
}

/** Attach error listeners to a page. Call before navigation. */
export function collectErrors(page: Page): CollectedErrors {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
    consoleErrors.push(`[pageerror] ${err.message}`);
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500 && !isDataEnvFailure(resp.url())) {
      failedRequests.push(`${resp.status()} ${resp.url()}`);
    }
  });

  return { consoleErrors, failedRequests, pageErrors };
}

// ── Page assertions ───────────────────────────────────────

/** Navigate to route, wait for content, assert no crash. */
export async function assertPageLoads(
  page: Page,
  path: string,
  opts: { waitMs?: number; allowEmpty?: boolean } = {}
) {
  const { waitMs = 3000, allowEmpty = false } = opts;
  const errors = collectErrors(page);

  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(waitMs);

  // Dismiss any modals that may block interaction (onboarding, setup wizard)
  await dismissModals(page);

  // Must not redirect to login
  const url = page.url();
  if (url.includes("/login")) {
    throw new Error(`Redirected to login from ${path}`);
  }

  // Must render content
  if (!allowEmpty) {
    const bodyLen = await page.evaluate(() => document.body.innerText.trim().length);
    if (bodyLen < 10) {
      throw new Error(`Empty page at ${path} (${bodyLen} chars)`);
    }
  }

  // No React error boundary
  const errorBoundary = await page
    .locator("text=/Something went wrong|Unexpected error|chunk load failed/i")
    .count();
  if (errorBoundary > 0) {
    throw new Error(`Error boundary triggered at ${path}`);
  }

  // No JS crashes
  if (errors.pageErrors.length > 0) {
    const crashes = errors.pageErrors.filter((e) =>
      e.includes("Cannot read properties")
    );
    if (crashes.length > 0) {
      throw new Error(`JS crash at ${path}: ${crashes[0]}`);
    }
  }

  // Log warnings
  if (errors.failedRequests.length) {
    console.log(`  ⚠ 5xx on ${path}: ${errors.failedRequests.slice(0, 3).join(", ")}`);
  }

  return errors;
}

/** Dismiss modals/overlays that may block interaction. */
export async function dismissModals(page: Page) {
  // Try clicking the close button on any modal-container (onboarding, setup wizard, etc.)
  const modalClose = page
    .locator('.modal-container .modal-close, .modal-container button[aria-label="Close"]')
    .first();
  if ((await modalClose.count()) > 0) {
    await modalClose.click({ force: true });
    await page.waitForTimeout(500);
  }

  // Fallback: press Escape to close remaining dialogs
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Try generic close/dismiss buttons in modals or dialogs
  const closeBtn = page
    .locator('[class*="modal"] button, [role="dialog"] button')
    .filter({ hasText: /close|dismiss|got it|ok|skip/i })
    .first();
  if ((await closeBtn.count()) > 0) {
    await closeBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

/** Click a tab by label text and verify no crash. */
export async function clickTab(page: Page, label: string) {
  const tab = page.locator(`button:has-text("${label}")`).first();
  if ((await tab.count()) > 0) {
    await tab.click();
    await page.waitForTimeout(1500);

    const errorBoundary = await page
      .locator("text=/Something went wrong|Unexpected error/i")
      .count();
    if (errorBoundary > 0) {
      throw new Error(`Tab "${label}" triggered error boundary`);
    }
  }
}

// ── API helpers ───────────────────────────────────────────

/** Fetch JSON from an authenticated API endpoint. */
export async function apiGet(page: Page, endpoint: string) {
  const resp = await page.request.get(`${BASE}${endpoint}`, {
    headers: authHeaders(),
  });
  return { status: resp.status(), data: await resp.json() };
}

/** Get first item ID from a list endpoint. Returns null if empty. */
export async function getFirstId(
  page: Page,
  endpoint: string
): Promise<number | string | null> {
  const { data } = await apiGet(page, endpoint);
  const items = data.data ?? data ?? [];
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[0].id ?? items[0].slug ?? null;
}

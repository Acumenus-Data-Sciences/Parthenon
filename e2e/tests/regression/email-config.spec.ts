/**
 * Regression guard: EMAIL-01 — RESEND_KEY env matches config/services.php
 *
 * Catches: RESEND_API_KEY vs RESEND_KEY mismatch that silently broke email delivery.
 * The auth/register endpoint should return 200 (not 500) when the mailer is configured.
 */
import { test, expect } from "@playwright/test";
import { BASE, authHeaders } from "../helpers";

test.describe("Email Config Regression", () => {
  test("POST /auth/register returns 200 or 422 (not 500)", async ({ request }) => {
    // A duplicate email should return 422 (validation) or 200 (success) — never 500
    const resp = await request.post(`${BASE}/api/v1/auth/register`, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      data: {
        name: "E2E Test User",
        email: "admin@acumenus.net", // existing user — should get 422 or silent success
        phone: "",
      },
    });
    // 200 = registered (email enumeration prevention returns success even for dupes)
    // 422 = validation error
    // 500 = mailer misconfigured (RESEND_KEY missing)
    expect(
      resp.status(),
      `Register endpoint returned ${resp.status()} — likely mailer misconfiguration`
    ).toBeLessThan(500);
  });

  test("POST /auth/forgot-password returns 200 (not 500)", async ({ request }) => {
    const resp = await request.post(`${BASE}/api/v1/auth/forgot-password`, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      data: { email: "admin@acumenus.net" },
    });
    // 200 = success (always returns 200 for enumeration prevention)
    // 500 = mailer misconfigured
    expect(
      resp.status(),
      `Forgot-password returned ${resp.status()} — likely mailer misconfiguration`
    ).toBeLessThan(500);
  });
});

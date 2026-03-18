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
    // IMPORTANT: Use a throwaway email — NEVER use admin@acumenus.net.
    // Registration generates a temp password and emails it, which would change the admin password.
    const resp = await request.post(`${BASE}/api/v1/auth/register`, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      data: {
        name: "E2E Test User",
        email: "e2e-test-nonexistent@example.com",
        phone: "",
      },
    });
    // 200 = registered (or silent success for enumeration prevention)
    // 422 = validation error
    // 500 = mailer misconfigured (RESEND_KEY missing)
    expect(
      resp.status(),
      `Register endpoint returned ${resp.status()} — likely mailer misconfiguration`
    ).toBeLessThan(500);
  });

  test("POST /auth/forgot-password returns 200 (not 500)", async ({ request }) => {
    // IMPORTANT: Use a fake email — NEVER use admin@acumenus.net here.
    // The forgot-password endpoint generates a new temp password and revokes all tokens.
    // Using the real admin email would lock out the super-admin account.
    const resp = await request.post(`${BASE}/api/v1/auth/forgot-password`, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      data: { email: "e2e-test-nonexistent@example.com" },
    });
    // 200 = success (always returns 200 for enumeration prevention, even for nonexistent emails)
    // 500 = mailer misconfigured
    expect(
      resp.status(),
      `Forgot-password returned ${resp.status()} — likely mailer misconfiguration`
    ).toBeLessThan(500);
  });
});

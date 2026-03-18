import { defineConfig, devices } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  globalSetup: "./global-setup.ts",
  reporter: [["list"], ["json", { outputFile: "results.json" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8082",
    headless: true,
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: true,
    storageState: AUTH_FILE,
  },
  projects: [
    {
      name: "setup",
      testMatch: /global-setup/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

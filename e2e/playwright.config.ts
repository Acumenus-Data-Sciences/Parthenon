import { defineConfig, devices } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  globalSetup: "./global-setup.ts",
  reporter: [["list"], ["json", { outputFile: "results.json" }]],
  use: {
    baseURL: "http://192.168.1.33:8082",
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

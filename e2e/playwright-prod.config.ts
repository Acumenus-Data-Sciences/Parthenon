import { defineConfig, devices } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 1,
  globalSetup: "./global-setup.ts",
  reporter: [["list"], ["json", { outputFile: "results-prod.json" }]],
  use: {
    baseURL: "https://parthenon.acumenus.net",
    headless: true,
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: true,
    storageState: AUTH_FILE,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

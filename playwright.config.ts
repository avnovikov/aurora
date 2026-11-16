import { defineConfig, devices } from "@playwright/test";

/** Its own port, never reused: a dev server from another checkout would test the wrong code. */
const PORT = 5287;

/**
 * Browser tests: the app in a phone-sized Chrome with real touch input.
 * Locally they use the installed Google Chrome; CI installs Playwright's Chromium.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: {
        ...devices["Pixel 7"],
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});

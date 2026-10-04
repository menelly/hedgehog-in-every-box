import { defineConfig, devices } from '@playwright/test'

/**
 * The proof suite: the helpers run against a tiny demo app with two versions
 * of the same form. broken.html has every bug in the catalogue we could fit;
 * fixed.html has them fixed. The tests check BOTH directions: the helpers
 * catch the broken one, and pass the fixed one.
 *
 * Headless, its own port (4790, or HEDGEHOG_DEMO_PORT), and it refuses to
 * reuse a server it didn't start.
 */
const PORT = Number(process.env.HEDGEHOG_DEMO_PORT ?? 4790)

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node demo/server.mjs',
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: false,
    env: { HEDGEHOG_DEMO_PORT: String(PORT) },
  },
})

import { defineConfig, devices } from '@playwright/test'

/**
 * 🦔🌍 FIELD RUNS: the hedgehog pointed at a REAL, LIVE app of ours (not the demo).
 * First one: Shareholder Value, 2026-11-05 ~05:50, because Ren asked "did you run hedgehog in
 * every box on that one too?" and the answer was no. Headless (nothing moves on anybody's screen).
 */
export default defineConfig({
  testDir: '.',
  timeout: 180_000,
  reporter: [['list']],
  use: { headless: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
})

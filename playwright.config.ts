import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 3100;
const WS_PORT = 3101;
const CONTROL_PORT = 3102;
const DB_PORT = 54329;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Throwaway PostgreSQL + game server + a control endpoint for restart/outage tests.
      command: 'npx tsx tests/support/e2e-services.ts',
      env: {
        WS_PORT: String(WS_PORT),
        E2E_CONTROL_PORT: String(CONTROL_PORT),
        E2E_DB_PORT: String(DB_PORT),
      },
      port: CONTROL_PORT,
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      command: `npx next dev -p ${WEB_PORT}`,
      env: {
        WS_PUBLIC_URL: `ws://localhost:${WS_PORT}`,
        GAME_SERVER_WS_URL: `ws://localhost:${WS_PORT}`,
        NEXT_DIST_DIR: '.next-e2e',
      },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

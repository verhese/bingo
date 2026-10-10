import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 3100;
const WS_PORT = 3101;

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
      command: 'npx tsx src/server/ws-server.ts',
      env: { WS_PORT: String(WS_PORT) },
      port: WS_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next dev -p ${WEB_PORT}`,
      env: {
        NEXT_PUBLIC_WS_URL: `ws://localhost:${WS_PORT}`,
        GAME_SERVER_WS_URL: `ws://localhost:${WS_PORT}`,
        NEXT_DIST_DIR: '.next-e2e',
      },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

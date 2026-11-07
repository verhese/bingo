import { expect, test as base } from '@playwright/test';
import { TEST_ADMIN_PASSWORD } from '../support/test-auth';

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    if (!baseURL) throw new Error('Playwright baseURL is required for administrator sign in.');
    const origin = new URL(baseURL).origin;
    const response = await page.request.post(new URL('/api/auth/login', baseURL).toString(), {
      data: { password: TEST_ADMIN_PASSWORD },
      headers: { Origin: origin },
    });
    if (!response.ok()) {
      throw new Error(`Administrator sign in failed (${response.status()}): ${await response.text()}`);
    }
    await use(page);
  },
});

export { expect };
export type { Page } from '@playwright/test';

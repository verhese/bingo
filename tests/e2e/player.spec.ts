import { expect, test } from '@playwright/test';

test.describe('player workflow', () => {
  test('player-card page generates cards and offers print and PDF export', async ({ page }) => {
    await page.goto('/player-card');
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();

    const firstCard = await page.locator('#print-area').first().innerText();
    await page.getByRole('button', { name: 'Generate new cards' }).click();
    await expect.poll(async () => page.locator('#print-area').first().innerText()).not.toBe(firstCard);
  });

  test('home page opens the game room', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/game-room/);
  });

  test('game room is usable at phone width without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/game-room');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

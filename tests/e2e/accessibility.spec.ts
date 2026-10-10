import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

test.describe('accessibility', () => {
  for (const route of ['/game-room', '/admin-panel', '/player-card']) {
    test(`${route} has no axe WCAG A/AA or best-practice violations`, async ({ page }) => {
      await page.goto(route);
      if (route === '/player-card') {
        await expect(page.getByRole('table', { name: '75-ball bingo card 1' })).toBeVisible();
      }
      const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('game room exposes each number and its called state in the board list', async ({ page }) => {
    await page.goto('/game-room');
    const board = page.getByRole('list', { name: 'Number board' });
    await expect(board).toBeVisible();
    await expect(board.getByRole('listitem').first()).toHaveAccessibleName(/Number 1,/);
  });

  test('game room dark theme passes the automated checks', async ({ page }) => {
    await page.goto('/game-room');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    expect(results.violations).toEqual([]);
  });

  test('90-ball player cards have accessible table structure', async ({ page }) => {
    await page.goto('/admin-panel');
    await page.getByLabel('Room name').fill('A11y 90-ball cards');
    await page.getByRole('button', { name: 'Create Room' }).click();
    await page.waitForURL(/room=/);
    const variantChange = page.waitForResponse((response) =>
      response.url().endsWith('/api/game')
      && response.request().method() === 'POST'
      && response.request().postDataJSON().action === 'change-variant'
      && response.ok(),
    );
    await page.getByRole('combobox', { name: 'Game variant' }).selectOption('90-ball');
    await variantChange;

    await page.goto('/player-card');
    await page.getByLabel('Card set room').selectOption({ label: 'A11y 90-ball cards - 90-ball' });
    await expect(page.getByRole('table', { name: '90-ball bingo card 1' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    expect(results.violations).toEqual([]);
  });

  test('verification dialog is keyboard operable and keeps focus modal', async ({ page }) => {
    await page.goto('/admin-panel');
    const trigger = page.getByRole('button', { name: 'Verify Bingo' });
    await trigger.focus();
    await page.keyboard.press('Space');

    const dialog = page.getByRole('dialog', { name: 'Verify a Bingo call' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('spinbutton').first()).toBeFocused();
    const dialogBounds = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(dialogBounds).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(Math.abs(dialogBounds!.x + dialogBounds!.width / 2 - viewport!.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(dialogBounds!.y + dialogBounds!.height / 2 - viewport!.height / 2)).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    expect(results.violations).toEqual([]);

    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Close verification dialog' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('spinbutton').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('keyboard navigation follows page order and shows a focus indicator', async ({ page }) => {
    await page.goto('/admin-panel');
    await page.keyboard.press('Tab');
    await expect(page.locator('#room-id')).toBeFocused();
    const outlineStyle = await page.locator('#room-id').evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outlineStyle).toBe('solid');

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Open Game Room' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#new-room-name')).toBeFocused();
  });
});

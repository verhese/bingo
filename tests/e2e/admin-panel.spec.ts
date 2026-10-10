import { expect, test, type Page } from '@playwright/test';

async function createRoom(page: Page, name: string, variant = '75-ball') {
  await page.goto('/admin-panel/create');
  await page.getByLabel('Room name').fill(name);
  await page.getByLabel('New room variant').selectOption(variant);
  if (variant === '90-ball') {
    await expect(page.getByLabel('New room game mode')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.waitForURL(/\/admin-panel\?room=/);
  return new URL(page.url()).searchParams.get('room') as string;
}

test.describe('admin create and game-control pages', () => {
  test('redirects to the lobby when no room is given and never draws on the default room', async ({ page }) => {
    const before = await (await page.request.get('/api/game?sessionId=default')).json();
    await page.goto('/admin-panel');
    await page.waitForURL(/\/lobby$/);
    await page.keyboard.press('Space');
    const after = await (await page.request.get('/api/game?sessionId=default')).json();
    expect(after.gameState.drawnNumbers).toEqual(before.gameState.drawnNumbers);
  });

  test('creating a room redirects to its game control page', async ({ page }) => {
    const roomId = await createRoom(page, 'E2E Room Setup', '90-ball');

    await expect(page.getByRole('heading', { name: 'Game control', exact: true })).toBeVisible();
    await expect(page.getByText('Active room: E2E Room Setup (90-ball)')).toBeVisible();
    await expect(page.getByText('Game variant: 90-ball — fixed when this room was created.')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Game variant' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Draw Number' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Game Room' })).toHaveAttribute(
      'href',
      `/game-room?room=${roomId}`,
    );
  });

  test('the lobby Admin link goes straight to game control and Back to lobby returns', async ({ page }) => {
    const roomId = await createRoom(page, 'E2E Jump Room');
    await page.goto('/lobby');
    await page.getByRole('link', { name: 'Admin for E2E Jump Room' }).click();

    await expect(page).toHaveURL(new RegExp(`/admin-panel\\?room=${roomId}`));
    await expect(page.getByText('Active room: E2E Jump Room (75-ball)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Draw Number' })).toBeVisible();

    await page.getByRole('link', { name: 'Back to lobby' }).click();
    await expect(page).toHaveURL(/\/lobby$/);
  });

  test('the game room shows its room name without a room switcher', async ({ page }) => {
    const roomId = await createRoom(page, 'E2E Fixed Room');
    await page.goto(`/game-room?room=${roomId}`);
    await expect(page.getByText('Room: E2E Fixed Room')).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to lobby' })).toBeVisible();
  });

  test('the lobby Create Room link opens the create page and Cancel returns', async ({ page }) => {
    await page.goto('/lobby');
    await page.getByRole('link', { name: 'Create Room' }).click();
    await expect(page).toHaveURL(/\/admin-panel\/create$/);
    await page.getByRole('link', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/lobby$/);
  });
});

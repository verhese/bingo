import { expect, test, type Page } from '@playwright/test';

async function createRoom(page: Page, name: string, mode: string) {
  await page.goto('/admin-panel');
  await page.getByLabel('Room name').fill(name);
  await page.getByLabel('Room game mode').selectOption(mode);
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.waitForURL(/room=/);
  await expect(page.getByText('fixed when this room was created')).toBeVisible();
  return new URL(page.url()).searchParams.get('room') as string;
}

async function callNumbers(page: Page, numbers: number[]) {
  for (const number of numbers) {
    await page.getByLabel(/Call a specific number/).fill(String(number));
    await page.getByRole('button', { name: 'Call Number' }).click();
    await expect(page.getByLabel(/Call a specific number/)).toHaveValue('');
  }
}

async function verify(page: Page, numbers: number[]) {
  await page.getByRole('button', { name: 'Verify Bingo' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('spinbutton')).toHaveCount(numbers.length);
  const fields = dialog.getByRole('spinbutton');
  for (const [index, number] of numbers.entries()) await fields.nth(index).fill(String(number));
  await dialog.getByRole('button', { name: 'Verify Bingo' }).click();
  await expect(dialog.getByText('Bingo verified')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

test.describe('caller workflow', () => {
  test('creates a room, calls numbers and shows them on the game room', async ({ page, context }) => {
    const roomId = await createRoom(page, 'E2E Caller', 'standard');
    const gameRoom = await context.newPage();
    await gameRoom.goto(`/game-room?room=${roomId}`);
    await expect(gameRoom.getByText('Stage 1/4: Top Row')).toBeVisible();

    await callNumbers(page, [7, 42]);
    await expect(gameRoom.getByLabel('No number called')).toHaveCount(0);
    await expect(gameRoom.getByText('Drawn: 2')).toBeVisible();
    await expect(gameRoom.getByRole('region', { name: 'Called numbers' }).getByText('42')).toBeVisible();
  });

  test('rejects duplicate calls and can undo the last call', async ({ page }) => {
    await createRoom(page, 'E2E Undo', 'single-row');
    await callNumbers(page, [10]);
    await page.getByLabel(/Call a specific number/).fill('10');
    await page.getByRole('button', { name: 'Call Number' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'already been called' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Undo Last Call' }).click();
    await page.getByRole('button', { name: 'Undo Call' }).click();
    await expect(page.getByText('Undo 10?')).toHaveCount(0);
  });

  test('keeps the room game mode fixed during play', async ({ page }) => {
    await createRoom(page, 'E2E Fixed', 'standard');
    await expect(page.getByLabel('Room game mode')).toHaveCount(1);
    await expect(page.getByRole('combobox', { name: /^game mode$/i })).toHaveCount(0);
    await expect(page.getByText('Standard — fixed when this room was created.')).toBeVisible();
  });

  test('walks every stage with stage-aware verification', async ({ page, context }) => {
    const roomId = await createRoom(page, 'E2E Stages', 'standard');
    const gameRoom = await context.newPage();
    await gameRoom.goto(`/game-room?room=${roomId}`);
    await callNumbers(page, range(1, 24));

    await verify(page, range(1, 5));
    await expect(gameRoom.getByText('BINGO!')).toBeVisible();
    await expect(gameRoom.getByText('1, 2, 3, 4, 5')).toBeVisible();

    await verify(page, range(6, 10));
    await verify(page, range(1, 8));
    await verify(page, range(1, 24));
    await expect(gameRoom.getByText('BINGO!')).toBeVisible();

    await page.getByRole('button', { name: 'Reset Game' }).click();
    await expect(gameRoom.getByText('Stage 1/4: Top Row')).toBeVisible();
    await expect(gameRoom.getByText('BINGO!')).toHaveCount(0);
  });
});

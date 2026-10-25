import { expect, test, type Page } from '@playwright/test';

const CONTROL_URL = 'http://localhost:3102';

async function control(action: 'restart-game-server' | 'pause-database' | 'resume-database') {
  const response = await fetch(`${CONTROL_URL}/${action}`, { method: 'POST' });
  expect(response.status, await response.text()).toBe(204);
}

async function createRoom(page: Page, name: string, mode: string) {
  await page.goto('/admin-panel/create');
  await page.getByLabel('Room name').fill(name);
  await page.getByLabel('New room game mode').selectOption(mode);
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.waitForURL(/room=/);
  await expect(page.getByText('fixed when this room was created').first()).toBeVisible();
  return new URL(page.url()).searchParams.get('room') as string;
}

async function callNumber(page: Page, number: number) {
  await page.getByLabel(/Call a specific number/).fill(String(number));
  await page.getByRole('button', { name: 'Call Number' }).click();
}

test.describe('durable rooms', () => {
  test.describe.configure({ mode: 'serial' });
  test.afterEach(async () => {
    await control('resume-database');
  });

  test('a room, its calls and its undo state survive a game-server restart', async ({ page }) => {
    const roomId = await createRoom(page, 'E2E Durable', 'standard');
    for (const number of [7, 42, 13]) {
      await callNumber(page, number);
      await expect(page.getByLabel(/Call a specific number/)).toHaveValue('');
    }
    await page.getByRole('button', { name: 'Undo Last Call' }).click();
    await page.getByRole('button', { name: 'Undo Call' }).click();
    await expect(page.getByText('Undo 13?')).toHaveCount(0);

    await control('restart-game-server');

    const gameRoom = await page.context().newPage();
    await gameRoom.goto(`/game-room?room=${roomId}`);
    await expect(gameRoom.getByText('Room: E2E Durable')).toBeVisible();
    await expect(gameRoom.getByText('Drawn: 2')).toBeVisible();
    await expect(gameRoom.getByText('Stage 1/4: Top Row')).toBeVisible();
    await expect(gameRoom.getByRole('region', { name: 'Called numbers' }).getByText('42')).toBeVisible();

    await page.goto(`/admin-panel?room=${roomId}`);
    await expect(page.getByText('Active room: E2E Durable (75-ball)')).toBeVisible();
    await callNumber(page, 13);
    await expect(gameRoom.getByText('Drawn: 3')).toBeVisible();

    await page.goto('/lobby');
    await expect(page.getByRole('link', { name: 'Admin for E2E Durable' })).toBeVisible();
  });

  test('a reset survives a restart and other rooms are untouched', async ({ page }) => {
    const keep = await createRoom(page, 'E2E Keep', 'single-row');
    await callNumber(page, 5);
    await expect(page.getByLabel(/Call a specific number/)).toHaveValue('');
    const cleared = await createRoom(page, 'E2E Cleared', 'single-row');
    await callNumber(page, 9);
    await expect(page.getByLabel(/Call a specific number/)).toHaveValue('');
    await page.getByRole('button', { name: 'Reset Game' }).click();
    await expect.poll(async () => (
      (await (await page.request.get(`/api/game?sessionId=${cleared}`)).json()).gameState.drawnNumbers
    )).toEqual([]);

    await control('restart-game-server');

    const clearedState = await (await page.request.get(`/api/game?sessionId=${cleared}`)).json();
    const keptState = await (await page.request.get(`/api/game?sessionId=${keep}`)).json();
    expect(clearedState.gameState.drawnNumbers).toEqual([]);
    expect(keptState.gameState.drawnNumbers).toEqual([5]);
  });

  test('shows a clear error and leaves the game unchanged while storage is down', async ({ page }) => {
    const roomId = await createRoom(page, 'E2E Outage', 'single-row');
    await callNumber(page, 20);
    await expect(page.getByLabel(/Call a specific number/)).toHaveValue('');

    await control('pause-database');
    await callNumber(page, 21);
    await expect(page.getByRole('alert').filter({ hasText: 'could not be saved' }).first()).toBeVisible();
    const during = await (await page.request.get(`/api/game?sessionId=${roomId}`)).json();
    expect(during.gameState.drawnNumbers).toEqual([20]);

    await control('resume-database');
    await page.getByLabel(/Call a specific number/).fill('21');
    await page.getByRole('button', { name: 'Call Number' }).click();
    await expect(page.getByLabel(/Call a specific number/)).toHaveValue('');
    const after = await (await page.request.get(`/api/game?sessionId=${roomId}`)).json();
    expect(after.gameState.drawnNumbers).toEqual([20, 21]);
  });
});

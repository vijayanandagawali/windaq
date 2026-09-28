const { test, expect } = require('@playwright/test');

test.describe('lobby', () => {
  test('lists only playable games and marks unreleased ones as coming soon', async ({ page }) => {
    await page.goto('/');
    const liveTiles = page.getByRole('link', { name: /^Play / });
    await expect(liveTiles).toHaveCount(10);
    await expect(page.getByLabel('Teen Patti — coming soon')).toBeVisible();
    await expect(page.getByRole('link', { name: /Play Teen Patti/ })).toHaveCount(0);
    // No fabricated activity feeds or third-party studio names.
    await expect(page.getByText(/LIVE PAYOUTS|Spribe|Evolution/i)).toHaveCount(0);
  });

  test('category tabs filter the grid and deep-link through the URL', async ({ page }) => {
    await page.goto('/?cat=table');
    await expect(page.getByRole('tab', { name: 'Table games' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('link', { name: /^Play / })).toHaveCount(4);
    await page.getByRole('tab', { name: 'All games' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: /^Play / })).toHaveCount(10);
  });

  test('unreleased game pages take no bets', async ({ page }) => {
    await page.goto('/games/teen-patti');
    await expect(page.getByRole('heading', { name: 'Teen Patti' })).toBeVisible();
    await expect(page.getByText('no bets can be placed here')).toBeVisible();
  });
});

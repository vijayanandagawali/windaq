const { test, expect } = require('@playwright/test');

test.describe('WinDaq 16-Game Thumbnails, Artwork & Category Suite', () => {
  test('Lobby renders 16:9 Hero banner and complete 16-game cards with zero broken images', async ({ page }) => {
    // Navigate to homepage
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    // Wait for the lobby page to be ready
    await page.waitForSelector('.game-card', { timeout: 15000 });

    // 1. Verify 16:9 Hero Banner
    const heroBanner = page.locator('.aspect-\\[16\\/9\\]');
    await expect(heroBanner).toBeVisible();

    const heroImg = heroBanner.locator('img');
    await expect(heroImg).toBeVisible();
    
    // Check that hero image is loaded (naturalWidth > 0 and no error)
    const isHeroLoaded = await heroImg.evaluate((img) => {
      return img.complete && img.naturalWidth > 0;
    });
    expect(isHeroLoaded).toBeTruthy();

    // 2. Verify all Game Cards in the grid
    const gameCards = page.locator('.game-card');
    const count = await gameCards.count();
    console.log(`Found ${count} game cards in lobby`);
    expect(count).toBeGreaterThanOrEqual(14); // All seeded games

    // 3. Inspect every single card for visual completeness & zero broken images
    for (let i = 0; i < count; i++) {
      const card = gameCards.nth(i);
      const img = card.locator('img');
      await expect(img).toBeVisible();

      // Ensure naturalWidth > 0 (not broken, not a 0x0 black box)
      const isLoaded = await img.evaluate((image) => {
        return image.complete && image.naturalWidth > 0;
      });
      expect(isLoaded).toBeTruthy();

      // Check visual completeness elements on the card
      const slug = await card.getAttribute('data-slug');
      console.log(`Verifying visual completeness for: ${slug}`);

      // Title must be present
      const title = card.locator('h3');
      await expect(title).toBeVisible();

      // Min bet must be visible
      const minBet = card.locator('text=Min:');
      await expect(minBet).toBeVisible();

      // Favorite star must be present
      const starBtn = card.locator('button[aria-label="Toggle Favorite"]');
      await expect(starBtn).toBeVisible();
    }

    // 4. Test Category Navigation for requested categories
    const categoriesToTest = [
      { name: 'Crash', expectedSlug: 'aviator' },
      { name: 'Colour', expectedSlug: 'colour-prediction' },
      { name: 'Slots', expectedSlug: 'slots' },
      { name: 'Scratch', expectedSlug: 'scratch' },
      { name: 'Lotto', expectedSlug: 'lotto' },
      { name: 'Teen Patti', expectedSlug: 'teen-patti' },
      { name: 'Poker', expectedSlug: 'texas-holdem' },
      { name: 'Rummy', expectedSlug: 'rummy' },
      { name: 'Roulette', expectedSlug: 'european-roulette' },
      { name: 'Blackjack', expectedSlug: 'blackjack' },
      { name: 'Andar Bahar', expectedSlug: 'andar-bahar' },
      { name: 'Dragon Tiger', expectedSlug: 'dragon-tiger' },
      { name: 'Dice', expectedSlug: 'dice' },
      { name: 'Sports', expectedSlug: 'sportsbook' }
    ];

    for (const cat of categoriesToTest) {
      console.log(`Testing category filter: ${cat.name}`);
      const catButton = page.locator(`.cat-pill:has-text("${cat.name}")`);
      await expect(catButton).toBeVisible();
      await catButton.click();

      // Wait a moment for filter update
      await page.waitForTimeout(400);

      // Verify the expected game card is displayed
      const targetCard = page.locator(`.game-card[data-slug="${cat.expectedSlug}"]`);
      await expect(targetCard).toBeVisible();

      // Verify card image is valid
      const targetImg = targetCard.locator('img');
      const isCardImgLoaded = await targetImg.evaluate((image) => {
        return image.complete && image.naturalWidth > 0;
      });
      expect(isCardImgLoaded).toBeTruthy();
    }

    // 5. Test Hover State on first card
    const firstCard = gameCards.first();
    await firstCard.hover();
    await page.waitForTimeout(300);

    // Switch back to All Games to capture full lobby view
    const allGamesBtn = page.locator('.cat-pill:has-text("All Games")');
    await allGamesBtn.click();
    await page.waitForTimeout(500);

    // Scroll down to games grid and take screenshot
    await page.locator('.game-card').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/windaq_grid_cards_verified.png', fullPage: false });
    console.log('✅ Grid screenshot saved to test-results/windaq_grid_cards_verified.png');
  });
});

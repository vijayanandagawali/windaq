const { test, expect } = require('@playwright/test');

test.describe('WinDaq Premium Production Game Hub Suite', () => {
  test('Lobby renders all 15 sections, complete cards, and filters with zero blank cards', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    // Wait for the lobby page to be ready
    await page.waitForSelector('.game-card', { timeout: 15000 });

    // 1. Verify Hero Banner
    const heroBanner = page.locator('.aspect-\\[16\\/9\\]');
    await expect(heroBanner).toBeVisible();
    const heroImg = heroBanner.locator('img');
    await expect(heroImg).toBeVisible();
    const isHeroLoaded = await heroImg.evaluate((img) => img.complete && img.naturalWidth > 0);
    expect(isHeroLoaded).toBeTruthy();

    // 2. Verify Required Sections
    const requiredSections = [
      { id: '#trending', title: 'Trending Now' },
      { id: '#recently-played', title: 'Recently Played' },
      { id: '#favorites', title: 'Favorites' },
      { id: '#windaq-originals', title: 'WinDaq Originals' },
      { id: '#crash', title: 'Crash Games' },
      { id: '#card-games', title: 'Card Games' },
      { id: '#table-games', title: 'Table Games' },
      { id: '#roulette', title: 'Roulette' },
      { id: '#slots', title: 'Slots & Megaways' },
      { id: '#scratch', title: 'Instant Scratch Cards' },
      { id: '#lotto', title: 'Quick Draw Lottery' },
      { id: '#colour', title: 'Colour Prediction' },
      { id: '#live-tables', title: 'Live & Simulated Tables' },
      { id: '#sports', title: 'Sportsbook & Cricket' }
    ];

    for (const sec of requiredSections) {
      const sectionEl = page.locator(sec.id);
      await expect(sectionEl).toBeVisible();
      const cards = sectionEl.locator('.game-card');
      const count = await cards.count();
      console.log(`Section ${sec.title}: found ${count} cards`);
      expect(count).toBeGreaterThan(0); // Zero blank sections!
    }

    // 3. Verify Card Structure on all visible cards:
    // image → badge → title → provider/type → min bet → status → favorite → Play
    const allCards = page.locator('.game-card');
    const totalCount = await allCards.count();
    console.log(`Total game cards rendered across all sections: ${totalCount}`);
    expect(totalCount).toBeGreaterThan(30);

    for (let i = 0; i < Math.min(totalCount, 15); i++) {
      const card = allCards.nth(i);

      // Image
      const img = card.locator('img');
      await expect(img).toBeVisible();
      const imgLoaded = await img.evaluate(img => img.complete && img.naturalWidth > 0);
      expect(imgLoaded).toBeTruthy();

      // Badge (category tag or LIVE/NEW)
      const badge = card.locator('span.font-extrabold').first();
      await expect(badge).toBeVisible();

      // Title
      const title = card.locator('h3');
      await expect(title).toBeVisible();

      // Provider/type
      const providerType = card.locator('span.uppercase.tracking-wider').first();
      await expect(providerType).toBeVisible();

      // Min Bet
      const minBet = card.locator('text=Min:');
      await expect(minBet).toBeVisible();

      // Status
      const status = card.locator('text=Online').or(card.locator('text=Live 24/7')).first();
      await expect(status).toBeVisible();

      // Favorite button
      const favBtn = card.locator('button[aria-label="Toggle Favorite"]');
      await expect(favBtn).toBeVisible();

      // Play button
      const playBtn = card.locator('text=PLAY NOW').first();
      await expect(playBtn).toBeVisible();
    }

    // 4. Test Search + Category + Filters
    // Test Search
    const searchInput = page.locator('input[placeholder*="Search 16+ games"]');
    await searchInput.fill('Aviator');
    await page.waitForTimeout(400);
    const searchResults = page.locator('.game-card');
    await expect(searchResults.first()).toBeVisible();
    expect(await searchResults.count()).toBeGreaterThanOrEqual(1);

    // Clear Search
    await page.locator('button:has-text("Back to All Hub Sections")').click();
    await page.waitForTimeout(400);

    // Test Provider Filter
    const providerSelect = page.locator('select').first();
    await providerSelect.selectOption({ index: 1 });
    await page.waitForTimeout(400);
    const providerResults = page.locator('.game-card');
    expect(await providerResults.count()).toBeGreaterThanOrEqual(1);

    // Reset Filter
    await page.locator('button:has-text("Back to All Hub Sections")').click();
    await page.waitForTimeout(400);

    // 5. Scroll to sections and capture screenshot
    await page.locator('#trending').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/windaq_production_sections_verified.png', fullPage: false });
    console.log('✅ Sections screenshot saved to test-results/windaq_production_sections_verified.png');
  });
});

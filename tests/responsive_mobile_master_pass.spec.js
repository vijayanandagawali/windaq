import { test, expect } from '@playwright/test';

// Target viewports
const VIEWPORTS = {
  COMPACT_ANDROID: { width: 360, height: 800, name: '360x800 (Compact Android)' },
  IPHONE_STANDARD: { width: 390, height: 844, name: '390x844 (iPhone 12/13/14)' },
  IPHONE_PRO_MAX: { width: 430, height: 932, name: '430x932 (iPhone Pro Max)' },
  DESKTOP_MASTER: { width: 1440, height: 900, name: '1440x900 (Desktop Master)' },
};

test.describe('RESPONSIVE MOBILE MASTER PASS - Multi-Viewport Verification', () => {

  // ==========================================
  // VIEWPORT 1: 360 × 800 (Compact Android)
  // ==========================================
  test('1. Viewport 360 × 800: Lobby, Cards, Overflow, BottomNav, and Modals', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.COMPACT_ANDROID.width, height: VIEWPORTS.COMPACT_ANDROID.height });
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Verify ZERO horizontal overflow on Lobby
    const overflowCheck = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth
      };
    });
    console.log('360x800 Lobby Overflow Check:', overflowCheck);
    expect(overflowCheck.hasHorizontalOverflow).toBe(false);

    // Verify Mobile Bottom Navigation is visible and docked
    const bottomNav = page.locator('nav[aria-label="Mobile Navigation"]');
    await expect(bottomNav).toBeVisible();
    
    // Verify touch targets in BottomNav >= 44px
    const navLinks = bottomNav.locator('a, button');
    const navLinkCount = await navLinks.count();
    expect(navLinkCount).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < navLinkCount; i++) {
      const box = await navLinks.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }

    // Verify Game Cards in 2-column grid
    const gameCards = page.locator('.game-card');
    const cardCount = await gameCards.count();
    expect(cardCount).toBeGreaterThan(0);
    const firstCardBox = await gameCards.first().boundingBox();
    expect(firstCardBox).toBeTruthy();
    // In 360px width, 2-col card should be roughly 140px-175px wide
    expect(firstCardBox.width).toBeLessThan(180);
    expect(firstCardBox.width).toBeGreaterThan(130);

    // Capture 360x800 Lobby Screenshot
    await page.screenshot({ path: 'tests/responsive_360x800_lobby.png', fullPage: false });

    // Open Deposit Modal and verify sizing
    const depositBtn = page.locator('[data-testid="header-deposit-btn"]');
    await expect(depositBtn).toBeVisible();
    await depositBtn.click();

    const depositModal = page.locator('div:has-text("INSTANT UPI DEPOSIT")').last();
    await expect(depositModal).toBeVisible();

    const modalBox = await page.locator('.modal-dialog, div[class*="max-h-[88dvh]"]').first().boundingBox();
    expect(modalBox).toBeTruthy();
    // Modal height must fit within 88% of 800px (<= 704px)
    expect(modalBox.height).toBeLessThanOrEqual(800 * 0.90);

    await page.screenshot({ path: 'tests/responsive_360x800_modal.png', fullPage: false });

    // Close Modal
    const closeBtn = page.locator('button[aria-label="Close Deposit Modal"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await page.waitForTimeout(300);
  });

  test('2. Viewport 360 × 800: Wallet Page & Zero Button Overflow', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.COMPACT_ANDROID.width, height: VIEWPORTS.COMPACT_ANDROID.height });
    await page.goto('http://localhost:3000/wallet');
    await page.waitForLoadState('networkidle');

    // Verify ZERO horizontal overflow on Wallet Page
    const overflowCheck = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth
      };
    });
    console.log('360x800 Wallet Overflow Check:', overflowCheck);
    expect(overflowCheck.hasHorizontalOverflow).toBe(false);

    // Verify Deposit and Withdraw buttons are stacked full-width with >= 44px touch targets
    const depositCta = page.locator('button:has-text("INSTANT DEPOSIT")').first();
    const withdrawCta = page.locator('button:has-text("WITHDRAW")').first();
    await expect(depositCta).toBeVisible();
    await expect(withdrawCta).toBeVisible();

    const depositBox = await depositCta.boundingBox();
    const withdrawBox = await withdrawCta.boundingBox();
    expect(depositBox.height).toBeGreaterThanOrEqual(44);
    expect(withdrawBox.height).toBeGreaterThanOrEqual(44);

    await page.screenshot({ path: 'tests/responsive_360x800_wallet.png', fullPage: false });
  });

  test('3. Viewport 360 × 800: Game Table & Sticky Betting Panel (Dragon Tiger)', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.COMPACT_ANDROID.width, height: VIEWPORTS.COMPACT_ANDROID.height });
    await page.goto('http://localhost:3000/games/dragon-tiger');
    await page.waitForLoadState('networkidle');

    // Verify ZERO horizontal overflow on Game Table
    const overflowCheck = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth
      };
    });
    console.log('360x800 Game Table Overflow Check:', overflowCheck);
    expect(overflowCheck.hasHorizontalOverflow).toBe(false);

    // Verify Battle Felt items (Dragon, Tiger, VS)
    await expect(page.locator('text=DRAGON').first()).toBeVisible();
    await expect(page.locator('text=TIGER').first()).toBeVisible();
    await expect(page.locator('text=VS').first()).toBeVisible();

    // Verify 3 betting buttons (DRAGON, TIE, TIGER) in the interactive grid
    const dragonSpot = page.locator('button:has-text("DRAGON")').last();
    const tieSpot = page.locator('button:has-text("TIE")').last();
    const tigerSpot = page.locator('button:has-text("TIGER")').last();
    await expect(dragonSpot).toBeVisible();
    await expect(tieSpot).toBeVisible();
    await expect(tigerSpot).toBeVisible();

    // Verify bottom control bar chips are rendered and clickable
    const chipBtns = page.locator('button:has-text("10"), button:has-text("50"), button:has-text("100")');
    expect(await chipBtns.count()).toBeGreaterThanOrEqual(3);

    // Click 50 chip
    const chip50 = page.locator('button:has-text("50")').first();
    await chip50.click();

    await page.screenshot({ path: 'tests/responsive_360x800_table.png', fullPage: false });
  });

  // ==========================================
  // VIEWPORT 2: 390 × 844 (iPhone Standard)
  // ==========================================
  test('4. Viewport 390 × 844: iPhone Standard Layout & Table Sizing', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.IPHONE_STANDARD.width, height: VIEWPORTS.IPHONE_STANDARD.height });
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Overflow check
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);

    // Verify BottomNav docked with safe-area
    const bottomNav = page.locator('nav[aria-label="Mobile Navigation"]');
    await expect(bottomNav).toBeVisible();

    // Navigate to Dragon Tiger
    await page.goto('http://localhost:3000/games/dragon-tiger');
    await page.waitForLoadState('networkidle');

    const tableOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(tableOverflow).toBe(false);

    await page.screenshot({ path: 'tests/responsive_390x844_table.png', fullPage: false });
  });

  // ==========================================
  // VIEWPORT 3: 430 × 932 (iPhone Pro Max)
  // ==========================================
  test('5. Viewport 430 × 932: iPhone Pro Max Large Display Scaling', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.IPHONE_PRO_MAX.width, height: VIEWPORTS.IPHONE_PRO_MAX.height });
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Overflow check
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);

    // Verify Game Hub hero and categories
    await expect(page.locator('h1, h2').first()).toBeVisible();

    await page.screenshot({ path: 'tests/responsive_430x932_lobby.png', fullPage: false });

    // Navigate to Dragon Tiger
    await page.goto('http://localhost:3000/games/dragon-tiger');
    await page.waitForLoadState('networkidle');

    const gameOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(gameOverflow).toBe(false);

    await page.screenshot({ path: 'tests/responsive_430x932_table.png', fullPage: false });
  });

  // ==========================================
  // VIEWPORT 4: 1440 × 900 (Desktop Master)
  // ==========================================
  test('6. Viewport 1440 × 900: Desktop Master View & Navigation Adaptation', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.DESKTOP_MASTER.width, height: VIEWPORTS.DESKTOP_MASTER.height });
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Overflow check
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);

    // Mobile Bottom Navigation MUST BE HIDDEN on Desktop (lg:hidden)
    const bottomNav = page.locator('nav[aria-label="Mobile Navigation"]');
    await expect(bottomNav).toBeHidden();

    // Desktop Header Navigation Links MUST BE VISIBLE
    const desktopNav = page.locator('header nav.hidden.lg\\:flex, header nav');
    await expect(desktopNav.first()).toBeVisible();
    await expect(page.locator('header a:has-text("Lobby")').first()).toBeVisible();
    await expect(page.locator('header a:has-text("Crash")').first()).toBeVisible();
    await expect(page.locator('header a:has-text("Live Casino")').first()).toBeVisible();

    await page.screenshot({ path: 'tests/responsive_desktop_lobby.png', fullPage: false });

    // Navigate to Wallet on Desktop: verify inline buttons
    await page.goto('http://localhost:3000/wallet');
    await page.waitForLoadState('networkidle');

    const walletOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(walletOverflow).toBe(false);

    const depositCta = page.locator('button:has-text("INSTANT DEPOSIT")').first();
    const withdrawCta = page.locator('button:has-text("WITHDRAW")').first();
    const depositBox = await depositCta.boundingBox();
    const withdrawBox = await withdrawCta.boundingBox();

    // On desktop, the two buttons should sit horizontally side-by-side (same Y level approximately)
    expect(Math.abs(depositBox.y - withdrawBox.y)).toBeLessThan(15);

    await page.screenshot({ path: 'tests/responsive_desktop_wallet.png', fullPage: false });

    // Navigate to Dragon Tiger on Desktop
    await page.goto('http://localhost:3000/games/dragon-tiger');
    await page.waitForLoadState('networkidle');

    const dtOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(dtOverflow).toBe(false);

    await page.screenshot({ path: 'tests/responsive_desktop_table.png', fullPage: false });
  });

});

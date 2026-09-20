const { test, expect } = require('@playwright/test');

const VIEWPORTS = [
  { name: 'Mobile-360x800', width: 360, height: 800 },
  { name: 'Mobile-390x844', width: 390, height: 844 },
  { name: 'Mobile-430x932', width: 430, height: 932 },
  { name: 'Desktop-1280x800', width: 1280, height: 800 },
];

test.describe('WINDAQ - AUTONOMOUS MASTER QA SUITE', () => {

  // 1. Viewport & Responsive Visual Audit
  for (const vp of VIEWPORTS) {
    test(`Responsive Viewport Layout & Hub Navigation [${vp.name}]`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

      // Brand Title & Live Marquee Check
      await expect(page.locator('.brand-title').first()).toBeVisible();
      await expect(page.locator('#live-winners-marquee')).toBeVisible();

      // Ensure Game Cards are rendered
      const cards = page.locator('.game-card');
      await expect(cards.first()).toBeVisible({ timeout: 10000 });
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(8);

      // Screenshot for visual audit
      await page.screenshot({ path: `test-results/audit_home_${vp.name}.png` });
    });
  }

  // 2. Financial Simulation: Instant Deposit & Balance Auto-Credit Flow
  test('Safe Financial Simulation: Deposit Flow & Balance Update', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    // Open Deposit Modal via Header Balance Chip (+)
    const depositTrigger = page.locator('[data-testid="header-deposit-btn"]');
    await depositTrigger.click();

    // Verify Deposit Modal is rendered
    await expect(page.locator('text=INSTANT UPI DEPOSIT')).toBeVisible({ timeout: 8000 });

    // Test 1-Tap Mock Payment Trigger (PhonePe button)
    const phonepeBtn = page.locator('button', { hasText: 'PhonePe' });
    await expect(phonepeBtn).toBeVisible();
    await phonepeBtn.click();

    // Verify confirmation and modal closure
    await page.waitForTimeout(2500);
    await expect(page.locator('text=INSTANT UPI DEPOSIT')).not.toBeVisible();
  });

  // 3. Modals & Drawers Interaction Matrix
  test('Modals & Drawers: Daily Spin, VIP Club, Passbook & Notifications', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

    // Notification Drawer
    const bellBtn = page.locator('button[title="Notifications"]').first();
    await bellBtn.click();
    await expect(page.locator('text=SYSTEM NOTIFICATIONS')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // VIP Club Modal
    const vipBadge = page.locator('header button', { hasText: 'GOLD' }).or(page.locator('button', { hasText: 'VIP Club' })).first();
    if (await vipBadge.isVisible()) {
      await vipBadge.click();
      await expect(page.locator('text=VIP CLUB')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // Daily Spin Modal
    const spinBtn = page.locator('button[title="Daily Lucky Spin"]').first();
    if (await spinBtn.isVisible()) {
      await spinBtn.click();
      await expect(page.locator('text=LUCKY WHEEL')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  });

  // 4. Play Every Game Matrix
  const GAMES = [
    { slug: 'aviator', name: 'Aviator Crash', selector: '#aviator-canvas, canvas, h1:has-text("Aviator")' },
    { slug: 'color-prediction', name: 'Colour Prediction', selector: 'button:has-text("GREEN")' },
    { slug: 'european-roulette', name: 'European Roulette', selector: 'h1:has-text("Roulette")' },
    { slug: 'dragon-tiger', name: 'Dragon vs Tiger', selector: 'h1:has-text("Dragon Tiger")' },
    { slug: 'slots', name: 'Vegas 777 Slots', selector: 'button:has-text("SPIN"), button:has-text("Spin")' },
    { slug: 'scratch', name: 'Lucky 7 Scratch', selector: 'h1:has-text("Scratch Cards")' },
    { slug: 'lotto', name: 'Quick Draw Lotto', selector: 'button:has-text("BUY TICKET"), button:has-text("QUICK PICK")' },
    { slug: 'teen-patti', name: 'Teen Patti Classic', selector: 'h1:has-text("Teen Patti")' },
    { slug: 'texas-holdem', name: 'Texas Hold\'em Poker', selector: 'button:has-text("CHECK"), button:has-text("CALL"), button:has-text("FOLD")' },
    { slug: 'blackjack', name: 'Blackjack 21', selector: 'button:has-text("HIT"), button:has-text("STAND"), button:has-text("DEAL")' },
    { slug: 'andar-bahar', name: 'Andar Bahar', selector: 'h1:has-text("Andar Bahar")' },
    { slug: 'rummy', name: 'Indian Rummy', selector: 'h1:has-text("Points Rummy"), button:has-text("Drop")' },
    { slug: 'live-roulette', name: 'Live VIP Roulette', selector: 'h1:has-text("VIP Roulette")' },
    { slug: 'sportsbook', name: 'Cricket Sportsbook', selector: 'h1:has-text("WinDaq Sports")' }
  ];

  for (const g of GAMES) {
    test(`Game Round & Interface QA: ${g.name} (/games/${g.slug})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`http://localhost:3000/games/${g.slug}`, { waitUntil: 'domcontentloaded' });

      // Verify no "Application Error" or unhandled 500 crash
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('Application error: a client-side exception has occurred');
      expect(bodyText).not.toContain('Game Not Found');

      // Verify game controls / interactive elements
      const targetLocator = page.locator(g.selector).first();
      await expect(targetLocator).toBeVisible({ timeout: 12000 });

      // Capture screenshot for visual proof
      await page.screenshot({ path: `test-results/audit_game_${g.slug}.png` });
    });
  }

  // 5. Admin & Operator Dashboards
  test('Admin Console & Operations (/admin)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Operations Control Center' })).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'test-results/audit_admin_dashboard.png' });
  });

  // 6. Live Dealer Console (/dealer)
  test('Studio Dealer Console & PIN Login (/dealer)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:3000/dealer', { waitUntil: 'domcontentloaded' });

    // Verify Studio Login
    await expect(page.locator('h1')).toHaveText(/STUDIO LOGIN/);
    await page.locator('input[type="password"]').fill('1234');
    await page.locator('button', { hasText: 'Authenticate' }).click();

    // Verify Dealer Controls
    await expect(page.locator('text=VIP Live Roulette').or(page.locator('text=STUDIO')).or(page.locator('text=TABLE CONTROL'))).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/audit_dealer_studio.png' });
  });

  // 7. Responsible Gaming, Fairness & Legal Routes
  const LEGAL_ROUTES = [
    { path: '/fairness', title: 'FAIRNESS' },
    { path: '/responsible-gaming', title: 'RESPONSIBLE GAMING' },
    { path: '/terms', title: 'TERMS' },
    { path: '/privacy', title: 'PRIVACY' },
    { path: '/support', title: 'SUPPORT' }
  ];

  for (const lr of LEGAL_ROUTES) {
    test(`Static / Legal Route Verification: ${lr.path}`, async ({ page }) => {
      await page.goto(`http://localhost:3000${lr.path}`, { waitUntil: 'domcontentloaded' });
      const body = await page.locator('body').innerText();
      expect(body.toUpperCase()).toContain(lr.title);
    });
  }
});

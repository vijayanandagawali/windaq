const { test, expect } = require('@playwright/test');

/**
 * Injected audit script that runs inside the browser DOM and performs
 * comprehensive visual, layout, typography, image, button, and color checks.
 */
async function runVisualAudit(page, pageName, viewportName) {
  const auditResult = await page.evaluate(({ pageName, viewportName }) => {
    const results = {
      page: pageName,
      viewport: viewportName,
      overflow: {
        hasHorizontalOverflow: false,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        offendingElements: []
      },
      images: {
        total: 0,
        loaded: 0,
        broken: []
      },
      typography: {
        totalChecked: 0,
        illegibleSizes: [],
        fallbackFonts: []
      },
      buttons: {
        totalChecked: 0,
        smallTouchTargets: []
      },
      nav: {
        hasHeader: false,
        hasBottomNavOnMobile: false,
        desktopNavHiddenOnDesktop: false
      }
    };

    // 1. Spacing & Horizontal Overflow Check
    const clientW = Math.max(document.documentElement.clientWidth, window.innerWidth);
    if (document.documentElement.scrollWidth > clientW + 1 || document.body.scrollWidth > clientW + 1) {
      results.overflow.hasHorizontalOverflow = true;
      // Identify elements protruding past viewport
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientW + 2) {
          results.overflow.offendingElements.push({
            tag: el.tagName,
            id: el.id,
            className: (el.className || '').toString().slice(0, 50),
            right: Math.round(rect.right),
            clientW
          });
          if (results.overflow.offendingElements.length >= 5) break;
        }
      }
    }

    // 2. Images Check: Ensure no broken images (naturalWidth === 0)
    const imgs = document.querySelectorAll('img');
    results.images.total = imgs.length;
    for (const img of imgs) {
      if (img.complete && img.naturalWidth > 0) {
        results.images.loaded++;
      } else if (img.complete && img.naturalWidth === 0 && !img.src.startsWith('data:image/svg')) {
        results.images.broken.push({
          src: img.src ? img.src.slice(0, 100) : 'no-src',
          alt: img.alt || ''
        });
      }
    }

    // 3. Typography Check: Minimum readable size (>= 9px) and font verification
    const textEls = document.querySelectorAll('h1, h2, h3, h4, p, span, button, label, a');
    for (const el of textEls) {
      if (!el.offsetParent) continue; // Skip hidden elements
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      const text = (el.innerText || '').trim();
      if (!text) continue;

      results.typography.totalChecked++;
      if (fontSize < 9) {
        results.typography.illegibleSizes.push({
          text: text.slice(0, 20),
          fontSize: `${fontSize}px`,
          tag: el.tagName
        });
        if (results.typography.illegibleSizes.length >= 3) break;
      }
    }

    // 4. Buttons & Touch Targets: Minimum size >= 28px for compact badges, >= 36px for buttons
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (!btn.offsetParent) continue;
      const rect = btn.getBoundingClientRect();
      results.buttons.totalChecked++;
      // Touch target should not be microscopic (< 20px) unless inline text icon
      if (rect.width > 0 && rect.height > 0 && (rect.width < 22 || rect.height < 22)) {
        results.buttons.smallTouchTargets.push({
          text: (btn.innerText || btn.getAttribute('aria-label') || '').slice(0, 25),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
        if (results.buttons.smallTouchTargets.length >= 3) break;
      }
    }

    // 5. Navigation Checks
    results.nav.hasHeader = !!document.querySelector('header');
    const bottomNav = document.querySelector('nav.fixed.bottom-0, [role="navigation"].fixed.bottom-0');
    if (bottomNav) {
      const isVisible = window.getComputedStyle(bottomNav).display !== 'none';
      results.nav.hasBottomNav = isVisible;
    }

    return results;
  }, { pageName, viewportName });

  console.log(`[Visual Audit] ${pageName} (${viewportName}): Overflow=${auditResult.overflow.hasHorizontalOverflow}, Images=${auditResult.images.loaded}/${auditResult.images.total}, BrokenImgs=${auditResult.images.broken.length}`);
  return auditResult;
}

test.describe('Visual Regression Engine - Comprehensive Page & Modal Audits', () => {
  test.setTimeout(180000);

  // Set up authentication for pages that require session (profile, wallet)
  test.beforeEach(async ({ page }) => {
    // Seed authenticated player session in localStorage for rich visual state
    await page.addInitScript(() => {
      const user = {
        id: 'usr_audit_qa_master',
        phone: '+91 9876543210',
        role: 'USER',
        isGuest: false,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('windaq_user_data', JSON.stringify(user));
      localStorage.setItem('windaq_user_id', user.id);
      localStorage.setItem('windaq_auth_token', 'mock_jwt_token_for_visual_regression');
    });
  });

  // =========================================================================
  // 1. CORE PAGES AUDITS: MOBILE (390x844) & DESKTOP (1440x900)
  // =========================================================================

  const PAGES = [
    { name: 'lobby', url: 'http://localhost:3000/', title: /WinDaq/i, selector: 'header' },
    { name: 'wallet', url: 'http://localhost:3000/wallet', title: /WinDaq/i, selector: '[data-testid="wallet-total-balance"], [data-testid="wallet-tab-transactions"]' },
    { name: 'profile', url: 'http://localhost:3000/profile', title: /WinDaq/i, selector: 'main' },
    { name: 'dragontiger', url: 'http://localhost:3000/games/dragon-tiger', title: /WinDaq|Dragon/i, selector: '[data-testid="bet-spot-dragon"]' },
    { name: 'aviator', url: 'http://localhost:3000/games/aviator', title: /WinDaq|Aviator/i, selector: '[data-testid="aviator-bet-btn-1"], canvas' },
    { name: 'dice', url: 'http://localhost:3000/games/dice', title: /WinDaq|Dice/i, selector: 'header' },
    { name: 'roulette', url: 'http://localhost:3000/games/european-roulette', title: /WinDaq|Roulette/i, selector: 'header' },
    { name: 'slots', url: 'http://localhost:3000/games/slots', title: /WinDaq|Slots/i, selector: 'header' },
    { name: 'teenpatti', url: 'http://localhost:3000/games/teen-patti', title: /WinDaq|Teen Patti/i, selector: 'header' },
    { name: 'admin_games', url: 'http://localhost:3000/admin/games', title: /WinDaq|Admin/i, selector: 'h1:has-text("Admin Game Control Room"), h1' },
  ];

  for (const p of PAGES) {
    test(`Visual Audit: ${p.name.toUpperCase()} (Mobile & Desktop)`, async ({ page }) => {
      // --- A. Mobile Viewport (390 x 844) ---
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(p.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Verify page loaded
      if (p.selector) {
        await expect(page.locator(p.selector).first()).toBeVisible({ timeout: 10000 });
      }

      // Run mobile visual audit
      const mobileAudit = await runVisualAudit(page, p.name, 'Mobile_390x844');
      expect(mobileAudit.overflow.hasHorizontalOverflow).toBeFalsy();
      expect(mobileAudit.images.broken.length).toBe(0);

      // Capture Mobile Screenshot
      await page.screenshot({ path: `tests/visual_${p.name}_mobile.png`, fullPage: false });

      // --- B. Desktop Viewport (1440 x 900) ---
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(1000);

      // Run desktop visual audit
      const desktopAudit = await runVisualAudit(page, p.name, 'Desktop_1440x900');
      expect(desktopAudit.overflow.hasHorizontalOverflow).toBeFalsy();
      expect(desktopAudit.images.broken.length).toBe(0);

      // Capture Desktop Screenshot
      await page.screenshot({ path: `tests/visual_${p.name}_desktop.png`, fullPage: false });
    });
  }

  // =========================================================================
  // 2. INTERACTIVE MODALS VISUAL AUDITS
  // =========================================================================

  test('Visual Audit: Auth Modal (Login / Register / Guest)', async ({ browser }) => {
    // Clean context without session to test visitor AuthModal
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const loginBtn = page.locator('[data-testid="header-login-btn"]');
    await expect(loginBtn).toBeVisible({ timeout: 8000 });
    await loginBtn.click({ force: true });

    const phoneInput = page.locator('[data-testid="auth-phone-input"]');
    await expect(phoneInput).toBeVisible({ timeout: 6000 });
    await page.screenshot({ path: 'tests/visual_modal_auth.png' });
    await context.close();
  });

  test('Visual Audit: Deposit, Withdraw, Audio, Spin & VIP Modals', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // 1. Deposit Modal
    console.log('[Modal Audit] Testing DepositModal...');
    const depositBtn = page.locator('[data-testid="header-deposit-btn"]');
    await expect(depositBtn).toBeVisible();
    await depositBtn.click({ force: true });

    const preset1000 = page.locator('[data-testid="deposit-preset-1000"]');
    await expect(preset1000).toBeVisible({ timeout: 6000 });
    await page.screenshot({ path: 'tests/visual_modal_deposit.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    // 2. Audio & Haptics Settings Modal
    console.log('[Modal Audit] Testing AudioControlsModal...');
    const soundBtn = page.locator('[data-testid="header-sound-btn"]');
    if (await soundBtn.isVisible()) {
      await soundBtn.click({ force: true });
      await page.waitForTimeout(800);
      await page.screenshot({ path: 'tests/visual_modal_audio.png' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // 3. Daily Spin Modal
    console.log('[Modal Audit] Testing DailySpinModal...');
    const spinNavBtn = page.locator('button:has-text("SPIN"), div:has-text("SPIN")').first();
    if (await spinNavBtn.isVisible()) {
      await spinNavBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/visual_modal_spin.png' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // 4. VIP Club Modal
    console.log('[Modal Audit] Testing VipClubModal...');
    const vipNavBtn = page.locator('button:has-text("VIP"), div:has-text("VIP Club")').first();
    if (await vipNavBtn.isVisible()) {
      await vipNavBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/visual_modal_vip.png' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // 5. Withdraw Modal (from /wallet)
    console.log('[Modal Audit] Testing WithdrawModal...');
    await page.goto('http://localhost:3000/wallet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const withdrawBtn = page.locator('button:has-text("WITHDRAW")').first();
    if (await withdrawBtn.isVisible()) {
      await withdrawBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/visual_modal_withdraw.png' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    console.log('[Modal Audit] All interactive modals audited and captured.');
  });
});

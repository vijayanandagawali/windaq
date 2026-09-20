/**
 * FULL AUTONOMOUS BUG HUNT ENGINE
 * Proactive discovery, inspection, interactive simulation, and defect detection.
 * "Do not wait for me to tell you what is broken."
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:4000';

test.describe('FULL AUTONOMOUS BUG HUNT: PLATFORM-WIDE CRAWL & DEEP AUDIT', () => {

  const defectsFound = [];

  test.afterAll(async () => {
    console.log('\n=============================================================');
    console.log(`🕷️ AUTONOMOUS BUG HUNT SUMMARY: ${defectsFound.length} DEFECTS FOUND`);
    console.log('=============================================================');
    if (defectsFound.length === 0) {
      console.log('🌟 ZERO DEFECTS DETECTED ACROSS ALL 35+ ROUTES! 100% HEALTHY.');
    } else {
      defectsFound.forEach((d, i) => {
        console.log(`  [${i + 1}] Route: ${d.route} | Type: ${d.type} | Detail: ${d.detail}`);
      });
    }
  });

  // Helper to attach error listeners to page
  function attachMonitors(page, routeName) {
    const errors = [];
    const failedRequests = [];

    page.on('pageerror', err => {
      // Ignore known harmless browser-only ResizeObserver loop limit errors if any
      if (err.message.includes('ResizeObserver')) return;
      errors.push({ type: 'UNCAUGHT_EXCEPTION', message: err.message });
      console.error(`  ❌ [${routeName}] Runtime Error:`, err.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out expected favicon 404 or connection retry logs during tests
        if (text.includes('favicon') || text.includes('net::ERR_') && text.includes('sock')) return;
        // Check for React hydration failures or critical warnings
        if (text.includes('Hydration failed') || text.includes('did not match') || text.includes('Minified React error')) {
          errors.push({ type: 'REACT_HYDRATION_ERROR', message: text });
          console.error(`  ❌ [${routeName}] React Hydration Error:`, text);
        }
      }
    });

    page.on('response', res => {
      const status = res.status();
      const url = res.url();
      // Flag broken static assets (404 / 500 images, css, scripts)
      if (status >= 400 && (url.includes('/images/') || url.includes('.png') || url.includes('.svg') || url.includes('.jpg'))) {
        failedRequests.push({ type: 'BROKEN_ASSET', url, status });
        console.error(`  ❌ [${routeName}] Broken Asset (${status}):`, url);
      }
    });

    return { errors, failedRequests };
  }

  // -------------------------------------------------------------------------
  // 1. PUBLIC MARKETING, INFO & POLICY ROUTES (12 Routes)
  // -------------------------------------------------------------------------
  const infoRoutes = [
    { name: 'Home Lobby', path: '/' },
    { name: 'Game Lobby', path: '/lobby' },
    { name: 'Game Search', path: '/search' },
    { name: 'Promotions', path: '/promotions' },
    { name: 'Provably Fair Verifier', path: '/fairness' },
    { name: 'Responsible Gaming', path: '/responsible-gaming' },
    { name: '24/7 Support Desk', path: '/support' },
    { name: 'Terms of Service', path: '/terms' },
    { name: 'Privacy Policy', path: '/privacy' },
    { name: 'Design System Tokens', path: '/design-system' },
    { name: 'Player Profile & KYC', path: '/profile' },
    { name: 'Wallet Hub', path: '/wallet' }
  ];

  for (const r of infoRoutes) {
    test(`HUNT: Public Route ${r.name} (${r.path})`, async ({ page }) => {
      console.log(`\n🔍 Inspecting Route: ${r.name} (${r.path})...`);
      const { errors, failedRequests } = attachMonitors(page, r.name);

      await page.goto(`${BASE_URL}${r.path}`);
      await page.waitForLoadState('networkidle');

      // Check title and single h1 or prominent header
      const pageTitle = await page.title();
      expect(pageTitle).toBeTruthy();

      // Check for zero horizontal overflow (spacing regression check)
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      });
      if (hasOverflow) {
        defectsFound.push({ route: r.path, type: 'HORIZONTAL_OVERFLOW', detail: 'scrollWidth > innerWidth' });
      }
      expect(hasOverflow).toBe(false);

      // Interactive clicks: Click tabs or filter pills if present
      const interactiveButtons = page.locator('button:visible, a:visible');
      const buttonCount = await interactiveButtons.count();
      console.log(`  👉 Found ${buttonCount} visible interactive targets`);

      // Click up to 3 non-navigation action buttons (e.g. tabs, category filters)
      const tabs = page.locator('[role="tab"], button:has-text("All"), button:has-text("VIP"), button:has-text("Live"), button:has-text("Table")');
      const tabCount = await tabs.count();
      for (let i = 0; i < Math.min(tabCount, 3); i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible()) {
          await tab.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(200);
        }
      }

      // Record any defects
      errors.forEach(e => defectsFound.push({ route: r.path, type: e.type, detail: e.message }));
      failedRequests.forEach(f => defectsFound.push({ route: r.path, type: f.type, detail: `${f.status} on ${f.url}` }));

      expect(errors.length).toBe(0);
      expect(failedRequests.length).toBe(0);
    });
  }

  // -------------------------------------------------------------------------
  // 2. LIVE GAME ROOMS & PLAY SIMULATION (15 Games)
  // -------------------------------------------------------------------------
  const gameRoutes = [
    { name: 'Dragon Tiger Live Table', path: '/games/dragon-tiger', type: 'table' },
    { name: 'Aviator Multiplier Jet', path: '/games/aviator', type: 'crash' },
    { name: 'European Roulette 3D', path: '/games/european-roulette', type: 'wheel' },
    { name: 'Vegas 777 Slots', path: '/games/slots', type: 'slots' },
    { name: 'Provably Fair Dice', path: '/games/dice', type: 'dice' },
    { name: 'Teen Patti Indian Poker', path: '/games/teen-patti', type: 'cards' },
    { name: 'Andar Bahar Live Cards', path: '/games/andar-bahar', type: 'cards' },
    { name: 'Blackjack 21 Elite', path: '/games/blackjack', type: 'cards' },
    { name: 'Lotto 5-Min Blower', path: '/games/lotto', type: 'lottery' },
    { name: 'Rummy 10 Classic', path: '/games/rummy', type: 'cards' },
    { name: 'Colour Prediction 1M', path: '/games/color-prediction', type: 'prediction' },
    { name: 'Scratch Card Gold', path: '/games/scratch', type: 'instant' },
    { name: 'Live Casino Hub', path: '/games/live-casino', type: 'lobby' },
    { name: 'Live Roulette Automated Table', path: '/games/live-roulette', type: 'live' },
    { name: 'Sportsbook Match Center', path: '/games/sportsbook', type: 'sports' }
  ];

  for (const g of gameRoutes) {
    test(`HUNT: Game Simulation & Interactivity ${g.name} (${g.path})`, async ({ page }) => {
      console.log(`\n🎮 Simulating Gameplay: ${g.name}...`);
      const { errors, failedRequests } = attachMonitors(page, g.name);

      await page.goto(`${BASE_URL}${g.path}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify canvas or SVG or table is mounted
      const hasGameElement = await page.evaluate(() => {
        return !!(
          document.querySelector('canvas') ||
          document.querySelector('svg') ||
          document.querySelector('[data-testid="game-table"]') ||
          document.querySelector('.relative')
        );
      });
      expect(hasGameElement).toBe(true);

      // Interact with chips / betting buttons if visible
      const chipButtons = page.locator('button:has-text("10"), button:has-text("50"), button:has-text("100"), button:has-text("₹10")');
      if (await chipButtons.count() > 0) {
        await chipButtons.first().click({ timeout: 1500, force: true }).catch(() => {});
        await page.waitForTimeout(300);
      }

      // Action buttons: BET, SPIN, DEAL, ROLL, CASH OUT
      const actionButtons = page.locator('button:has-text("BET"), button:has-text("SPIN"), button:has-text("DEAL"), button:has-text("ROLL"), button:has-text("DRAGON"), button:has-text("RED")');
      if (await actionButtons.count() > 0) {
        await actionButtons.first().click({ timeout: 1500, force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }

      // Check audio or sound controls if present
      const soundBtn = page.locator('button[aria-label="Sound"], button:has-text("🔊"), button:has-text("🔈")');
      if (await soundBtn.count() > 0) {
        await soundBtn.first().click({ timeout: 1500, force: true }).catch(() => {});
      }

      errors.forEach(e => defectsFound.push({ route: g.path, type: e.type, detail: e.message }));
      failedRequests.forEach(f => defectsFound.push({ route: g.path, type: f.type, detail: `${f.status} on ${f.url}` }));

      expect(errors.length).toBe(0);
      expect(failedRequests.length).toBe(0);
    });
  }

  // -------------------------------------------------------------------------
  // 3. ADMIN & DEALER PORTAL AUDIT (8 Routes)
  // -------------------------------------------------------------------------
  const adminRoutes = [
    { name: 'Admin Dashboard', path: '/admin' },
    { name: 'Admin Game Control Room', path: '/admin/games' },
    { name: 'Admin KYC Manager', path: '/admin/kyc' },
    { name: 'Admin Double-Entry Ledger', path: '/admin/ledger' },
    { name: 'Admin Payment Approvals', path: '/admin/payments' },
    { name: 'Admin Risk & AML Flags', path: '/admin/risk' },
    { name: 'Admin System Audit Trail', path: '/admin/audit' },
    { name: 'Admin Wallet Adjustments', path: '/admin/adjustments' },
    { name: 'Live Dealer Operator Console', path: '/dealer' }
  ];

  for (const a of adminRoutes) {
    test(`HUNT: Administrative Portal ${a.name} (${a.path})`, async ({ page }) => {
      console.log(`\n🛡️ Auditing Admin Route: ${a.name}...`);
      const { errors, failedRequests } = attachMonitors(page, a.name);

      await page.goto(`${BASE_URL}${a.path}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify page mounted and has content
      const bodyText = await page.innerText('body');
      expect(bodyText.length).toBeGreaterThan(50);

      // Verify no broken images or runtime script crashes
      errors.forEach(e => defectsFound.push({ route: a.path, type: e.type, detail: e.message }));
      failedRequests.forEach(f => defectsFound.push({ route: a.path, type: f.type, detail: `${f.status} on ${f.url}` }));

      expect(errors.length).toBe(0);
      expect(failedRequests.length).toBe(0);
    });
  }

  // -------------------------------------------------------------------------
  // 4. DATABASE & WEBSOCKET SANITY AUDIT
  // -------------------------------------------------------------------------
  test('HUNT: Database Integrity & Active Game Engine Heartbeats', async () => {
    console.log('\n🗄️ Checking PostgreSQL / Prisma Database Health...');

    // 1. User and Wallet table counts
    const userCount = await prisma.user.count();
    const walletCount = await prisma.wallet.count();
    const transactionCount = await prisma.transaction.count();
    const ledgerTxCount = await prisma.ledgerTransaction.count();

    expect(userCount).toBeGreaterThan(0);
    expect(walletCount).toBeGreaterThan(0);

    console.log(`  📊 DB Stats: Users: ${userCount} | Wallets: ${walletCount} | Transactions: ${transactionCount} | Ledger: ${ledgerTxCount}`);

    // 2. Orphaned Wallets check (Referential integrity audit)
    const orphanedWallets = await prisma.$queryRaw`
      SELECT w.id FROM "Wallet" w 
      LEFT JOIN "User" u ON w."userId" = u.id 
      WHERE u.id IS NULL
    `;
    expect(orphanedWallets.length).toBe(0);
    console.log('  ✅ Zero orphaned wallets in database.');

    // 3. Negative Balance Audit (All wallet balances must be >= 0)
    const negativeWallets = await prisma.wallet.findMany({
      where: { balance: { lt: 0n } }
    });
    expect(negativeWallets.length).toBe(0);
    console.log('  ✅ Zero negative/overdrawn wallet balances in database.');
  });

});

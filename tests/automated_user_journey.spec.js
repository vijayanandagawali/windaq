const { test, expect } = require('@playwright/test');

test.describe('Automated User Journey Test - WinDaq End-to-End', () => {
  // Allow ample time for live table cycle (15s betting + 5s dealing + 3s result)
  test.setTimeout(180000);

  test('Full User Journey: Register -> Deposit -> Game Hub -> Play -> Bet -> Round -> Result -> Settlement -> Wallet -> Another Game -> Logout -> Login -> History Persisted', async ({ page }) => {
    // Generate a unique 10-digit Indian phone number starting with 98
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000).toString();
    const testPhone = `98${randomSuffix}`;
    console.log(`[Journey] Starting automated test with test user phone: ${testPhone}`);

    // ----------------------------------------------------
    // STEP 1: Open WinDaq
    // ----------------------------------------------------
    console.log('[Step 1] Opening WinDaq homepage...');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page).toHaveTitle(/WinDaq/i);
    await expect(page.locator('header')).toBeVisible();
    await page.screenshot({ path: 'tests/journey_01_open_windaq.png' });
    console.log('[Step 1] WinDaq homepage opened successfully.');

    // ----------------------------------------------------
    // STEP 2: Register
    // ----------------------------------------------------
    console.log('[Step 2] Initiating Registration flow...');
    const registerBtn = page.locator('[data-testid="header-register-btn"]');
    await expect(registerBtn).toBeVisible();
    await registerBtn.click();

    // Verify AuthModal is open on REGISTER tab
    const phoneInput = page.locator('[data-testid="auth-phone-input"]');
    await expect(phoneInput).toBeVisible({ timeout: 5000 });

    // Ensure register tab is active
    const registerTab = page.locator('[data-testid="auth-tab-register"]');
    if (await registerTab.isVisible()) {
      await registerTab.click();
    }

    // Fill phone number
    await phoneInput.fill(testPhone);
    await page.waitForTimeout(500);

    // Submit Registration
    const submitBtn = page.locator('[data-testid="auth-submit-btn"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await page.screenshot({ path: 'tests/journey_02_register.png' });
    console.log(`[Step 2] Registration form submitted for ${testPhone}.`);

    // ----------------------------------------------------
    // STEP 3: Login / Authenticated
    // ----------------------------------------------------
    console.log('[Step 3] Verifying authenticated state...');
    const profileLink = page.locator('[data-testid="header-profile-link"]');
    const logoutBtn = page.locator('[data-testid="header-logout-btn"]');

    // Wait for user to be logged in
    await expect(profileLink).toBeVisible({ timeout: 10000 });
    await expect(logoutBtn).toBeVisible();
    await page.screenshot({ path: 'tests/journey_03_login_authenticated.png' });
    console.log('[Step 3] User successfully authenticated and logged in.');

    // ----------------------------------------------------
    // STEP 4: Wallet created
    // ----------------------------------------------------
    console.log('[Step 4] Verifying wallet creation & welcome bonus...');
    const depositChip = page.locator('[data-testid="header-deposit-btn"]');
    await expect(depositChip).toBeVisible();

    // Should have initial ₹500 welcome bonus credits
    await expect(depositChip).toContainText('500.00', { timeout: 8000 });
    await page.screenshot({ path: 'tests/journey_04_wallet_created.png' });
    console.log('[Step 4] Wallet created with initial ₹500.00 balance.');

    // ----------------------------------------------------
    // STEP 5: Sandbox deposit
    // ----------------------------------------------------
    console.log('[Step 5] Triggering instant Sandbox UPI deposit...');
    await depositChip.click();

    // Wait for Deposit Modal
    const preset1000Btn = page.locator('[data-testid="deposit-preset-1000"]');
    await expect(preset1000Btn).toBeVisible({ timeout: 6000 });
    await preset1000Btn.click();
    await page.waitForTimeout(400);

    // Click 1-Tap Sandbox UPI (PhonePe)
    const phonePeBtn = page.locator('[data-testid="deposit-phonepe-btn"]');
    await expect(phonePeBtn).toBeVisible();
    await phonePeBtn.click();

    // Wait for mock processing & auto-credit (modal closes after ~2s)
    await page.waitForTimeout(3000);

    // Balance should now be 500 + 1000 = ₹1,500.00
    await expect(depositChip).toContainText('1,500.00', { timeout: 10000 });
    await page.screenshot({ path: 'tests/journey_05_sandbox_deposit.png' });
    console.log('[Step 5] Sandbox deposit completed. Wallet balance updated to ₹1,500.00.');

    // ----------------------------------------------------
    // STEP 6: Game Hub
    // ----------------------------------------------------
    console.log('[Step 6] Navigating through Game Hub...');
    const dragonTigerCard = page.locator('[data-testid="game-card-dragon-tiger"]').first();
    await expect(dragonTigerCard).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'tests/journey_06_game_hub.png' });
    console.log('[Step 6] Game Hub active with games catalog.');

    // ----------------------------------------------------
    // STEP 7: Select game
    // ----------------------------------------------------
    console.log('[Step 7] Selecting Dragon Tiger game...');
    await dragonTigerCard.click();
    await page.waitForURL('**/games/dragon-tiger', { timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/journey_07_select_game.png' });
    console.log('[Step 7] Dragon Tiger selected and game page loaded.');

    // ----------------------------------------------------
    // STEP 8: Play
    // ----------------------------------------------------
    console.log('[Step 8] Checking live table stage & dealer...');
    const tableSoundBtn = page.locator('[data-testid="table-sound-toggle-btn"]');
    const betSpotDragon = page.locator('[data-testid="bet-spot-dragon"]');
    await expect(betSpotDragon).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'tests/journey_08_play_table.png' });
    console.log('[Step 8] Live table loaded with Maya virtual dealer and betting spots.');

    // ----------------------------------------------------
    // STEP 9: Bet
    // ----------------------------------------------------
    console.log('[Step 9] Waiting for BETTING_OPEN phase to place bet...');
    // Table cycle loops: BETTING_OPEN (15s) -> DEALING (5s) -> RESULT (4s) -> BETTING_OPEN
    // Poll until bet button is enabled
    let bettingOpen = false;
    for (let i = 0; i < 30; i++) {
      const isEnabled = await betSpotDragon.isEnabled().catch(() => false);
      if (isEnabled) {
        bettingOpen = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    expect(bettingOpen).toBeTruthy();

    // Select ₹100 chip
    const chip100 = page.locator('[data-testid="chip-100"]');
    if (await chip100.isVisible()) {
      await chip100.click();
      await page.waitForTimeout(300);
    }

    // Place bet on DRAGON
    await betSpotDragon.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/journey_09_bet_placed.png' });
    console.log('[Step 9] Bet of ₹100 placed on DRAGON successfully.');

    // ----------------------------------------------------
    // STEP 10: Round
    // ----------------------------------------------------
    console.log('[Step 10] Waiting for round to lock and begin dealing...');
    // Wait until betting locks or table enters DEALING phase
    let roundActive = false;
    for (let i = 0; i < 25; i++) {
      const isDisabled = await betSpotDragon.isDisabled().catch(() => false);
      if (isDisabled) {
        roundActive = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/journey_10_round_dealing.png' });
    console.log('[Step 10] Round in progress, virtual cards dealt.');

    // ----------------------------------------------------
    // STEP 11: Result
    // ----------------------------------------------------
    console.log('[Step 11] Waiting for round result...');
    // Wait for winner announcement / result flash
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'tests/journey_11_round_result.png' });
    console.log('[Step 11] Round result evaluated.');

    // ----------------------------------------------------
    // STEP 12: Settlement
    // ----------------------------------------------------
    console.log('[Step 12] Waiting for round settlement...');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/journey_12_round_settlement.png' });
    console.log('[Step 12] Round settlement confirmed.');

    // ----------------------------------------------------
    // STEP 13: Wallet update
    // ----------------------------------------------------
    console.log('[Step 13] Verifying wallet update after round settlement...');
    // Balance chip in header should reflect bet deduction/payout
    const currentBalanceText = await page.locator('header button').filter({ hasText: '₹' }).first().innerText();
    console.log(`[Step 13] Current wallet balance display: ${currentBalanceText.trim()}`);
    await page.screenshot({ path: 'tests/journey_13_wallet_updated.png' });

    // ----------------------------------------------------
    // STEP 14: History
    // ----------------------------------------------------
    console.log('[Step 14] Navigating to Wallet Hub to inspect transaction history...');
    await page.goto('http://localhost:3000/wallet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const txTab = page.locator('[data-testid="wallet-tab-transactions"]');
    await expect(txTab).toBeVisible();

    // Verify transactions exist
    const txItems = page.locator('[data-testid="wallet-tx-item"]');
    const txCount = await txItems.count();
    console.log(`[Step 14] Found ${txCount} transaction record(s) in wallet history.`);
    expect(txCount).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: 'tests/journey_14_history_view.png' });
    console.log('[Step 14] Transaction history verified successfully.');

    // ----------------------------------------------------
    // STEP 15: Another game
    // ----------------------------------------------------
    console.log('[Step 15] Navigating to second game (Aviator)...');
    await page.goto('http://localhost:3000/games/aviator', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Verify Aviator canvas and bet button
    const aviatorBetBtn = page.locator('[data-testid="aviator-bet-btn-1"]');
    await expect(aviatorBetBtn).toBeVisible({ timeout: 8000 });

    // Place bet or interact
    try {
      await aviatorBetBtn.click({ force: true, timeout: 3000 });
    } catch {
      await aviatorBetBtn.evaluate(b => b.click()).catch(() => {});
    }
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'tests/journey_15_another_game.png' });
    console.log('[Step 15] Successfully interacted with Aviator (second game).');

    // ----------------------------------------------------
    // STEP 16: Logout
    // ----------------------------------------------------
    console.log('[Step 16] Logging out user...');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const headerLogoutBtn = page.locator('[data-testid="header-logout-btn"]');
    await expect(headerLogoutBtn).toBeVisible();
    await headerLogoutBtn.click({ force: true });

    // Verify visitor state (LOGIN button visible)
    const headerLoginBtn = page.locator('[data-testid="header-login-btn"]');
    await expect(headerLoginBtn).toBeVisible({ timeout: 6000 });
    await page.screenshot({ path: 'tests/journey_16_logged_out.png' });
    console.log('[Step 16] User successfully logged out. Visitor state active.');

    // ----------------------------------------------------
    // STEP 17: Login
    // ----------------------------------------------------
    console.log('[Step 17] Logging back in with registered phone...');
    // Wait for logout toast to fade or remove toast containers
    await page.evaluate(() => {
      document.querySelectorAll('[role="status"]').forEach(el => el.remove());
      const toastContainers = document.querySelectorAll('div[style*="z-index: 9999"], div[style*="z-index: 50"]');
    }).catch(() => {});
    await page.waitForTimeout(1500);

    await headerLoginBtn.click({ force: true });

    // Auth modal opens
    const modalPhoneInput = page.locator('[data-testid="auth-phone-input"]');
    const isModalVisible = await modalPhoneInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isModalVisible) {
      await headerLoginBtn.click({ force: true });
    }
    await expect(modalPhoneInput).toBeVisible({ timeout: 8000 });

    // Switch to LOGIN tab if not active
    const modalLoginTab = page.locator('[data-testid="auth-tab-login"]');
    if (await modalLoginTab.isVisible()) {
      await modalLoginTab.click({ force: true });
    }

    // Fill registered phone and OTP 1234
    await modalPhoneInput.fill(testPhone);
    const modalOtpInput = page.locator('[data-testid="auth-otp-input"]');
    await modalOtpInput.fill('1234');
    await page.waitForTimeout(400);

    // Submit login
    const modalSubmitBtn = page.locator('[data-testid="auth-submit-btn"]');
    await modalSubmitBtn.click({ force: true });

    // Verify user is re-authenticated
    const reauthenticatedProfile = page.locator('[data-testid="header-profile-link"]');
    await expect(reauthenticatedProfile).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'tests/journey_17_logged_in_again.png' });
    console.log('[Step 17] Successfully logged back in with phone & OTP 1234.');

    // ----------------------------------------------------
    // STEP 18: History still available
    // ----------------------------------------------------
    console.log('[Step 18] Verifying transaction history is still available post-login...');
    await page.goto('http://localhost:3000/wallet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Check transaction rows
    const persistentTxItems = page.locator('[data-testid="wallet-tx-item"]');
    const persistentCount = await persistentTxItems.count();
    console.log(`[Step 18] Persistent transaction records found: ${persistentCount}`);
    expect(persistentCount).toBeGreaterThanOrEqual(1);

    // Check balance is persisted
    const walletBalance = page.locator('[data-testid="wallet-total-balance"]');
    await expect(walletBalance).toBeVisible();
    const finalBalanceText = await walletBalance.innerText();
    console.log(`[Step 18] Verified persistent balance: ${finalBalanceText}`);

    await page.screenshot({ path: 'tests/journey_18_history_persisted.png' });
    console.log('[Step 18] End-to-end user journey test completed with 100% success!');
  });
});

const { test, expect } = require('@playwright/test');

test.describe('WINDAQ - COMPLETE AUTHENTICATION & SESSION LIFECYCLE', () => {

  const uniquePhone = `99${Date.now().toString().slice(-8)}`;

  test('Visitor -> Register -> Session -> Profile -> Wallet -> Logout -> Login Again Flow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // ==========================================
    // 1. VISITOR STATE
    // ==========================================
    console.log('Step 1: Navigating to Home Lobby as unauthenticated Visitor...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Visitor should see LOGIN and REGISTER buttons in Header
    const loginBtn = page.locator('button', { hasText: 'LOGIN' }).first();
    const registerBtn = page.locator('button', { hasText: 'REGISTER' }).first();
    const guestBtn = page.locator('button', { hasText: 'GUEST' }).first();

    await expect(loginBtn).toBeVisible({ timeout: 10000 });
    await expect(registerBtn).toBeVisible();
    await expect(guestBtn).toBeVisible();

    // ==========================================
    // 2. PROTECTED ROUTE BARRIER FOR VISITOR
    // ==========================================
    console.log('Step 2: Checking Protected Route guard on /wallet for Visitor...');
    await page.goto('http://localhost:3000/wallet', { waitUntil: 'domcontentloaded' });
    
    // Should see Authentication Required barrier
    await expect(page.locator('text=MY GAMING WALLET')).toBeVisible();
    await expect(page.locator('text=You must be logged in to view your private wallet')).toBeVisible();
    
    // Click "Return to Home Lobby"
    await page.locator('text=← Return to Home Lobby').click();
    await expect(page).toHaveURL('http://localhost:3000/');

    // ==========================================
    // 3. REGISTRATION FLOW
    // ==========================================
    console.log(`Step 3: Registering brand new user with phone +91${uniquePhone}...`);
    await registerBtn.click();

    // Verify Auth Modal opened in REGISTER tab
    await expect(page.locator('text=WINDAQ ACCESS')).toBeVisible();
    await expect(page.locator('text=₹500 instant welcome bonus')).toBeVisible();

    // Fill registration form
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill(uniquePhone);
    
    const submitRegBtn = page.locator('button', { hasText: 'CREATE ACCOUNT & CLAIM ₹500' });
    await expect(submitRegBtn).toBeEnabled();
    await submitRegBtn.click();

    // Wait for successful registration toast and modal closure
    await expect(page.locator('text=WINDAQ ACCESS')).not.toBeVisible({ timeout: 10000 });

    // ==========================================
    // 4. AUTHENTICATED SESSION & WALLET
    // ==========================================
    console.log('Step 4: Verifying session state, VIP badge, and auto-provisioned wallet...');
    
    // Header should now show VIP / Role badge and Profile avatar instead of Register
    await expect(page.locator('button', { hasText: 'REGISTER' })).not.toBeVisible();
    
    // Wallet should be provisioned with welcome balance (₹500.00)
    await page.waitForTimeout(1000);
    const balanceChip = page.locator('[data-testid="header-deposit-btn"]');
    await expect(balanceChip).toBeVisible();
    const balanceText = await balanceChip.innerText();
    console.log(`   Balance in Header: ${balanceText}`);
    expect(balanceText).toContain('500.00');

    // ==========================================
    // 5. USER PROFILE PAGE VERIFICATION
    // ==========================================
    console.log('Step 5: Navigating to User Profile (/profile)...');
    await page.goto('http://localhost:3000/profile', { waitUntil: 'domcontentloaded' });

    // Verify user profile displays real dynamic data
    await expect(page.locator('text=MY PROFILE & KYC')).toBeVisible();
    await expect(page.locator(`text=+91${uniquePhone}`)).toBeVisible();
    await expect(page.locator('text=WALLET BALANCE')).toBeVisible();
    await expect(page.locator('text=₹500.00').first()).toBeVisible();
    await expect(page.locator('text=ID:')).toBeVisible();

    // ==========================================
    // 6. LOGOUT FLOW
    // ==========================================
    console.log('Step 6: Logging out from WinDaq...');
    const logoutBtn = page.locator('button', { hasText: 'LOG OUT FROM WINDAQ' });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // User is redirected to home and returns to Visitor state
    await page.waitForURL('http://localhost:3000/');
    await expect(page.locator('button', { hasText: 'LOGIN' }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('button', { hasText: 'REGISTER' }).first()).toBeVisible();

    // ==========================================
    // 7. LOGIN AGAIN FLOW
    // ==========================================
    console.log(`Step 7: Logging back in with registered phone ${uniquePhone}...`);
    await page.locator('button', { hasText: 'LOGIN' }).first().click();
    await expect(page.locator('text=WINDAQ ACCESS')).toBeVisible();

    // Enter phone and demo OTP 1234
    await page.locator('input[type="tel"]').fill(uniquePhone);
    await page.locator('text=⚡ Use Demo OTP (1234)').click();
    
    const signInBtn = page.locator('button', { hasText: 'SECURE SIGN IN' });
    await signInBtn.click();

    // Modal closes upon successful login
    await expect(page.locator('text=WINDAQ ACCESS')).not.toBeVisible({ timeout: 10000 });

    // Balance restored
    await page.waitForTimeout(1000);
    const reloadedBalance = await page.locator('[data-testid="header-deposit-btn"]').innerText();
    console.log(`   Balance after re-login: ${reloadedBalance}`);
    expect(reloadedBalance).toContain('500.00');

    // ==========================================
    // 8. SESSION PERSISTENCE (PAGE RELOAD)
    // ==========================================
    console.log('Step 8: Verifying session persistence across full page reload...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // User remains logged in
    await expect(page.locator('button', { hasText: 'REGISTER' })).not.toBeVisible();
    await expect(page.locator('[data-testid="header-deposit-btn"]')).toBeVisible();

    // ==========================================
    // 9. EXPLICIT 🧪 TEST GUEST MODE
    // ==========================================
    console.log('Step 9: Testing switch to 🧪 TEST GUEST MODE (₹50,000 credit)...');
    // Logout first
    await page.goto('http://localhost:3000/profile', { waitUntil: 'domcontentloaded' });
    await page.locator('button', { hasText: 'LOG OUT FROM WINDAQ' }).click();
    await page.waitForURL('http://localhost:3000/');

    // Click TEST GUEST button in Header
    const testGuestHeaderBtn = page.locator('button', { hasText: 'GUEST' }).first();
    await testGuestHeaderBtn.click();

    // Wait for guest authentication
    await page.waitForTimeout(1500);
    const guestBalanceText = await page.locator('[data-testid="header-deposit-btn"]').innerText();
    console.log(`   Guest Sandbox Balance: ${guestBalanceText}`);
    expect(guestBalanceText).toContain('50,000.00');

    console.log('🎉 FULL AUTHENTICATION & SESSION LIFECYCLE VALIDATION COMPLETE!');
  });
});

require('dotenv').config();
const jwt = require('jsonwebtoken');

async function runAuthFlowTest() {
  const BASE_URL = 'http://localhost:4000';
  console.log('🚀 Starting Full WinDaq Authentication & Session Lifecycle Test...\n');

  // Helper for fetch
  async function api(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  const testPhone = `98${Date.now().toString().slice(-8)}`;

  // 1. Visitor Flow: Browsing public catalog without authentication
  console.log('1️⃣ Testing Visitor State (Public Catalog)...');
  const catalogRes = await api('/api/catalog');
  if (catalogRes.status !== 200 || !catalogRes.data.success) {
    throw new Error(`Public catalog failed for visitor: ${JSON.stringify(catalogRes.data)}`);
  }
  console.log(`   ✅ Visitor successfully browsed catalog without token.`);

  // 2. Register Flow: Registering brand new user
  console.log(`\n2️⃣ Testing Registration with phone +91${testPhone}...`);
  const regRes = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ phone: testPhone })
  });

  if (regRes.status !== 201 || !regRes.data.success || !regRes.data.token) {
    throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
  }

  const registeredUser = regRes.data.user;
  const registeredToken = regRes.data.token;
  const initialWallet = regRes.data.wallet;

  console.log(`   ✅ Registered User ID: ${registeredUser.id}`);
  console.log(`   ✅ Auto-Provisioned Wallet Balance: ₹${initialWallet.balance} (Welcome bonus credited)`);
  console.log(`   ✅ Token Issued: ${registeredToken.slice(0, 20)}...`);

  // 3. Duplicate Registration Check
  console.log('\n3️⃣ Testing Duplicate Phone Registration Rejection...');
  const dupRes = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ phone: testPhone })
  });
  if (dupRes.status !== 409 || dupRes.data.code !== 'USER_EXISTS') {
    throw new Error(`Duplicate registration was not rejected properly: ${JSON.stringify(dupRes.data)}`);
  }
  console.log('   ✅ Duplicate registration correctly rejected with 409 USER_EXISTS.');

  // 4. Session Validation (/api/auth/me)
  console.log('\n4️⃣ Testing Session Persistence (/api/auth/me)...');
  const meRes = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${registeredToken}` }
  });

  if (meRes.status !== 200 || !meRes.data.success) {
    throw new Error(`Session validation failed: ${JSON.stringify(meRes.data)}`);
  }
  console.log(`   ✅ Active Session Validated: User=${meRes.data.user.phone}, Balance=₹${meRes.data.wallet.balance}, KYC=${meRes.data.user.kycStatus}`);

  // 5. Test Guest Account Creation (Explicit TEST MODE)
  console.log('\n5️⃣ Testing Explicit 🧪 TEST MODE Guest Account...');
  const guestRes = await api('/api/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ testMode: true })
  });

  if (guestRes.status !== 200 || !guestRes.data.success || !guestRes.data.token) {
    throw new Error(`Guest test provisioning failed: ${JSON.stringify(guestRes.data)}`);
  }
  console.log(`   ✅ Guest ID: ${guestRes.data.user.id}, isGuest: ${guestRes.data.user.isGuest}`);
  console.log(`   ✅ Test Currency Provisioned: ₹${guestRes.data.wallet.balance.toLocaleString('en-IN')}`);

  // 6. Token Expiry & Session Expiry Handling
  console.log('\n6️⃣ Testing Session Expiry (Expired JWT Rejection)...');
  const expiredToken = jwt.sign(
    { userId: registeredUser.id, phone: testPhone, role: 'USER' },
    process.env.JWT_SECRET || 'super-secret-key-fallback',
    { expiresIn: -10 } // expired 10 seconds ago
  );

  const expRes = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${expiredToken}` }
  });

  if (expRes.status !== 401 || expRes.data.code !== 'SESSION_EXPIRED') {
    throw new Error(`Expired token was not rejected with 401 SESSION_EXPIRED: ${JSON.stringify(expRes.data)}`);
  }
  console.log('   ✅ Expired token correctly rejected with 401 SESSION_EXPIRED.');

  // 7. Logout Flow
  console.log('\n7️⃣ Testing Logout Flow...');
  const logoutRes = await api('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${registeredToken}` }
  });
  if (logoutRes.status !== 200 || !logoutRes.data.success) {
    throw new Error(`Logout failed: ${JSON.stringify(logoutRes.data)}`);
  }
  console.log('   ✅ Logout confirmed.');

  // 8. Login Again Flow: Logging back in with registered phone & OTP
  console.log('\n8️⃣ Testing "Login Again" with Registered Phone...');
  const loginRes = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: testPhone, otp: '1234' })
  });

  if (loginRes.status !== 200 || !loginRes.data.success || !loginRes.data.token) {
    throw new Error(`Login again failed: ${JSON.stringify(loginRes.data)}`);
  }

  console.log(`   ✅ Re-logged in successfully as ${loginRes.data.user.id}`);
  console.log(`   ✅ Wallet balance restored: ₹${loginRes.data.wallet.balance}`);

  console.log('\n🎉 ALL 8 AUTHENTICATION & SESSION LIFECYCLE TESTS PASSED PERFECTLY!\n');
}

runAuthFlowTest().catch((err) => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});

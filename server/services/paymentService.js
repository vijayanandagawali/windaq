const db = require('../database');
const https = require('https');

class PaymentService {
  constructor() {
    this.merchantUpiId = process.env.MERCHANT_UPI_ID || 'windaq@okhdfcbank';
    this.merchantName = process.env.MERCHANT_NAME || 'WinDaq Gaming';
    
    // Gateway Credentials (Optional for automated gateway link)
    this.cashfreeAppId = process.env.CASHFREE_APP_ID || '';
    this.cashfreeSecret = process.env.CASHFREE_SECRET_KEY || '';
    this.cashfreeEnv = process.env.CASHFREE_ENV || 'TEST'; // TEST or PROD
  }

  // 1. Generate Dynamic UPI Intent Deep-link & QR Code Payload
  createDepositIntent(phone, amount) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount < 100) throw new Error('Minimum deposit amount is ₹100');

    const orderId = 'ORD_' + Math.random().toString(36).substring(2, 8).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
    const upiLink = `upi://pay?pa=${encodeURIComponent(this.merchantUpiId)}&pn=${encodeURIComponent(this.merchantName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('WinDaq_' + orderId)}`;

    return {
      success: true,
      orderId,
      amount,
      merchantUpiId: this.merchantUpiId,
      merchantName: this.merchantName,
      upiIntentUrl: upiLink,
      qrData: upiLink,
      instructions: [
        '1. Tap on PhonePe / GPay / Paytm or scan the QR code',
        `2. Complete the payment of ₹${amount.toFixed(2)}`,
        '3. Copy the 12-digit UTR / UPI Reference Number from your payment receipt',
        '4. Paste the 12-digit UTR below to credit your WinDaq wallet instantly'
      ]
    };
  }

  // 2. Generate Automated Payment Link (Cashfree / Easebuzz)
  async createPaymentGatewayLink(phone, amount, customerName = 'Player') {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount < 100) throw new Error('Minimum deposit amount is ₹100');

    const orderId = 'WDQ_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    // If Cashfree keys configured, create real Cashfree payment session/link
    if (this.cashfreeAppId && this.cashfreeSecret) {
      try {
        const host = this.cashfreeEnv === 'PROD' ? 'api.cashfree.com' : 'sandbox.cashfree.com';
        const payload = JSON.stringify({
          order_id: orderId,
          order_amount: amount,
          order_currency: 'INR',
          customer_details: {
            customer_id: 'CUST_' + phone.slice(-6),
            customer_phone: phone.slice(-10),
            customer_name: customerName
          },
          order_meta: {
            return_url: `http://localhost:3000/wallet?order_id=${orderId}`
          }
        });

        const options = {
          hostname: host,
          path: '/pg/orders',
          method: 'POST',
          headers: {
            'x-client-id': this.cashfreeAppId,
            'x-client-secret': this.cashfreeSecret,
            'x-api-version': '2023-08-01',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const result = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                resolve({ raw: data });
              }
            });
          });
          req.on('error', reject);
          req.write(payload);
          req.end();
        });

        if (result.payment_link || result.payment_session_id) {
          return {
            success: true,
            orderId,
            paymentLink: result.payment_link || `https://payments.cashfree.com/order/#${result.payment_session_id}`,
            provider: 'CASHFREE'
          };
        }
      } catch (err) {
        console.warn('[Payment Gateway] Cashfree link error, fallback to UPI Intent:', err.message);
      }
    }

    // Direct Instant UPI Intent fallback
    const intent = this.createDepositIntent(phone, amount);
    return {
      success: true,
      orderId,
      upiIntentUrl: intent.upiIntentUrl,
      merchantUpiId: this.merchantUpiId,
      provider: 'DIRECT_UPI'
    };
  }

  // 3. Submit UTR with Duplicate Protection
  submitUTR(phone, amount, utr, upiApp = 'UPI', screenshot = null) {
    return db.submitDepositRequest(phone, amount, utr, upiApp, screenshot);
  }

  // 4. Automated Webhook Handler for Gateways (Cashfree / Easebuzz)
  handleGatewayWebhook(event, payload, signature) {
    try {
      console.log('⚡ Received Gateway Webhook:', event);
      const { orderId, amount, phone, utr, status } = payload;

      if (status === 'SUCCESS' && utr) {
        return db.submitDepositRequest(phone, amount, utr, 'GATEWAY_AUTO');
      }
      return { success: true, message: 'Webhook received' };
    } catch (err) {
      console.error('Webhook error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // 5. Submit Withdrawal Request (with winning balance locking)
  requestWithdrawal(phone, amount, paymentMethod, details) {
    return db.submitWithdrawalRequest(phone, amount, paymentMethod, details);
  }

  // Admin Banking Actions
  getPendingDeposits() {
    return db.getPendingDeposits();
  }

  approveDeposit(requestId, adminNotes) {
    return db.approveDepositRequest(requestId, adminNotes);
  }

  rejectDeposit(requestId, reason) {
    return db.rejectDepositRequest(requestId, reason);
  }

  getPendingWithdrawals() {
    return db.getPendingWithdrawals();
  }

  processWithdrawal(requestId, adminNotes) {
    return db.processWithdrawalRequest(requestId, adminNotes);
  }

  rejectWithdrawal(requestId, reason) {
    return db.rejectWithdrawalRequest(requestId, reason);
  }
}

module.exports = new PaymentService();

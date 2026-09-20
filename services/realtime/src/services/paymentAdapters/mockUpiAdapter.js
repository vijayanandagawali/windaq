const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

class MockUpiAdapter {
  constructor() {
    this.providerName = 'MOCK_UPI';
    // In production, keep secrets in a vault, e.g. Hashicorp Vault or AWS Secrets Manager.
    this.merchantId = process.env.UPI_MERCHANT_ID || 'MOCK_MERCHANT_999';
    this.secretKey = process.env.UPI_SECRET_KEY || 'mock-secret-key-123';
  }

  /**
   * Initializes a deposit request with the provider.
   * Returns intent URL and provider reference.
   */
  async initiateDeposit(amountPaise, intentId) {
    // Generate a mock UPI intent URI
    const amountINR = (Number(amountPaise) / 100).toFixed(2);
    const providerRef = `upi_txn_${crypto.randomBytes(8).toString('hex')}`;
    const intentUrl = `upi://pay?pa=${this.merchantId}@okmock&pn=WinDaq&tr=${providerRef}&am=${amountINR}&cu=INR`;
    
    return {
      success: true,
      providerReference: providerRef,
      metadata: {
        intentUrl,
        qrCodePayload: intentUrl,
        expireAt: Date.now() + 15 * 60 * 1000 // 15 mins
      }
    };
  }

  /**
   * Verifies the webhook signature using HMAC SHA256 (Standard UPI/Razorpay/PhonePe practice)
   */
  verifyWebhookSignature(payload, signature) {
    const expectedSig = crypto
      .createHmac('sha256', this.secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return expectedSig === signature;
  }

  /**
   * Process a payout (Withdrawal)
   */
  async initiateWithdrawal(amountPaise, destinationVpa) {
    // Mock processing
    if (!destinationVpa.includes('@')) {
      return { success: false, message: 'Invalid VPA destination.' };
    }
    const providerRef = `upi_payout_${crypto.randomBytes(8).toString('hex')}`;
    
    return {
      success: true,
      providerReference: providerRef,
      status: 'PENDING'
    };
  }
}

module.exports = new MockUpiAdapter();

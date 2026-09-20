const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// AES-256-CBC Encryption config
// In production, load from a secure vault (KMS).
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32); // Must be 32 bytes
const IV_LENGTH = 16; 

class ComplianceService {

  /**
   * Core Gateway: Checks if a user is legally and responsibly allowed to place a wager.
   * Throws an Error if blocked.
   */
  async checkEligibility(userId, productType, amountPaise) {
    // 1. Fetch all compliance data for user
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        selfExclusions: {
          where: {
            OR: [
              { isPermanent: true },
              { exclusionEndDate: { gt: new Date() } }
            ]
          }
        },
        kycProfile: true,
        rgLimits: true
      }
    });

    if (!user) {
      // Auto-provision user & wallet to prevent "User not found" error
      const walletService = require('./walletService');
      const ensured = await walletService.ensureUserAndWallet(prisma, userId);
      user = ensured.user;
    }

    // 2. Self-Exclusion Check
    if (user.selfExclusions && user.selfExclusions.length > 0) {
      throw new Error('Account is restricted due to Self-Exclusion or Cool-Off.');
    }

    // 3. KYC & Jurisdiction Check
    const kyc = user.kycProfile;
    if (kyc) {
      // Get jurisdiction rules
      const rules = await prisma.jurisdictionConfig.findUnique({
        where: { id: kyc.jurisdiction }
      });

      if (rules) {
        if (productType === 'CASINO' && !rules.allowCasino) {
          throw new Error(`Jurisdiction ${kyc.jurisdiction} does not permit Casino wagers.`);
        }
        if (productType === 'SPORTS' && !rules.allowSports) {
          throw new Error(`Jurisdiction ${kyc.jurisdiction} does not permit Sports wagers.`);
        }
        if (productType === 'LIVE' && !rules.allowLive) {
          throw new Error(`Jurisdiction ${kyc.jurisdiction} does not permit Live Casino wagers.`);
        }
      }
    }

    // 4. Responsible Gaming Limits
    const rg = user.rgLimits;
    if (rg) {
      // Simple daily wager check (in production, we sum the day's ledger transactions)
      if (rg.dailyWagerLimit && amountPaise > rg.dailyWagerLimit) {
        throw new Error(`Wager exceeds your configured daily limit of ₹${Number(rg.dailyWagerLimit)/100}.`);
      }
      
      // Note: We are doing a naive single-bet limit check for prototype.
      // A robust implementation would calculate: SUM(Ledger BET_PLACE today) + amountPaise <= dailyWagerLimit.
    }
    
    return true;
  }

  /**
   * Encrypts sensitive KYC documents (e.g., URL to S3, or base64 data)
   */
  encryptDocument(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * Decrypts sensitive KYC documents
   */
  decryptDocument(text) {
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  async submitKyc(userId, jurisdiction, dob, documentData) {
    const encryptedDoc = this.encryptDocument(documentData);
    
    return await prisma.kycProfile.upsert({
      where: { userId },
      update: {
        status: 'PENDING',
        jurisdiction,
        dob: new Date(dob),
        documentHash: encryptedDoc
      },
      create: {
        userId,
        status: 'PENDING',
        jurisdiction,
        dob: new Date(dob),
        documentHash: encryptedDoc
      }
    });
  }
}

module.exports = new ComplianceService();

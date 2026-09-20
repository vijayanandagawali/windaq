const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

class RiskService {
  /**
   * Flags a user for suspicious or adversarial activity.
   */
  async flagUser(userId, reasonCode, evidence = {}, severity = 'MEDIUM') {
    try {
      console.warn(`[RiskService] Flagging user ${userId} for ${reasonCode} (Severity: ${severity})`);
      
      const flag = await prisma.riskFlag.create({
        data: {
          userId,
          reasonCode,
          severity,
          evidence,
          status: 'OPEN'
        }
      });
      
      // Update risk profile score (e.g., +10 for LOW, +25 for MEDIUM, +50 for HIGH, +100 for CRITICAL)
      let scoreIncrease = 25;
      if (severity === 'LOW') scoreIncrease = 10;
      if (severity === 'HIGH') scoreIncrease = 50;
      if (severity === 'CRITICAL') scoreIncrease = 100;

      await prisma.userRiskProfile.upsert({
        where: { userId },
        update: {
          riskScore: { increment: scoreIncrease }
        },
        create: {
          userId,
          riskScore: scoreIncrease
        }
      });

      return flag;
    } catch (err) {
      console.error('[RiskService] Failed to flag user:', err);
    }
  }

  /**
   * Device fingerprinting and multi-account tracking
   */
  async trackDevice(userId, ipAddress, userAgent = 'unknown') {
    try {
      // Simple server-side hash to track identical physical origins
      const deviceId = crypto.createHash('sha256').update(`${ipAddress}-${userAgent}`).digest('hex');
      
      await prisma.deviceFingerprint.upsert({
        where: { userId_deviceId: { userId, deviceId } },
        update: { lastSeen: new Date(), ipAddress },
        create: { userId, deviceId, ipAddress }
      });

      // Check if this device ID is used by other users
      const otherUsers = await prisma.deviceFingerprint.findMany({
        where: { deviceId, userId: { not: userId } }
      });

      if (otherUsers.length > 0) {
        await this.flagUser(
          userId, 
          'MULTI_ACCOUNT', 
          { deviceId, linkedUsers: otherUsers.map(u => u.userId) }, 
          'HIGH'
        );
      }
      
      return deviceId;
    } catch (err) {
      console.error('[RiskService] Failed to track device:', err);
    }
  }

  /**
   * Checks if an error is a Prisma Unique Constraint error (often indicating Replay/Duplicate attempt)
   */
  async checkIdempotencyError(err, userId, endpoint, payload) {
    if (err.code === 'P2002') {
      await this.flagUser(
        userId,
        'DUPLICATE_ATTEMPT',
        { endpoint, target: err.meta?.target, payload },
        'MEDIUM'
      );
      return true; // Indicates it was handled as a duplicate
    }
    return false;
  }
}

module.exports = new RiskService();

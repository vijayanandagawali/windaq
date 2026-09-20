const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const complianceService = require('../services/complianceService');
const { requireRole, logAudit } = require('../middleware/AdminRBAC');

// --- USER ROUTES ---

// Submit KYC
router.post('/kyc', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'mock-user-id'; // Auth placeholder
    const { jurisdiction, dob, documentData } = req.body;
    
    if (!jurisdiction || !dob || !documentData) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const profile = await complianceService.submitKyc(userId, jurisdiction, dob, documentData);
    res.json({ success: true, data: { status: profile.status, jurisdiction: profile.jurisdiction } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get or Update RG Limits
router.post('/rg-limits', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'mock-user-id';
    const { dailyWagerLimit, selfExcludeDays } = req.body;
    
    // Update Wager Limits
    if (dailyWagerLimit !== undefined) {
      await prisma.responsibleGamingLimits.upsert({
        where: { userId },
        update: { dailyWagerLimit: BigInt(dailyWagerLimit) },
        create: { userId, dailyWagerLimit: BigInt(dailyWagerLimit) }
      });
    }

    // Process Self-Exclusion
    if (selfExcludeDays) {
      const exclusionEndDate = new Date();
      exclusionEndDate.setDate(exclusionEndDate.getDate() + parseInt(selfExcludeDays));
      
      await prisma.selfExclusion.create({
        data: {
          userId,
          exclusionEndDate,
          reason: 'User requested Cool-Off'
        }
      });
    }

    res.json({ success: true, message: 'RG Limits updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ADMIN ROUTES ---

// Get Pending KYC
router.get('/admin/kyc', requireRole(['SUPPORT', 'RISK', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const profiles = await prisma.kycProfile.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { phone: true } } }
    });
    
    // In a real system we would never send the raw documentHash, but for this prototype admin view we decrypt it to show the power of the service
    const safeProfiles = profiles.map(p => ({
      ...p,
      decryptedDoc: p.documentHash ? complianceService.decryptDocument(p.documentHash) : null
    }));

    res.json({ success: true, data: safeProfiles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve/Reject KYC
router.post('/admin/kyc/:id/review', requireRole(['SUPPORT', 'RISK', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'APPROVED' or 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(status)) {
       return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const profile = await prisma.kycProfile.update({
      where: { id },
      data: { status, verifiedAt: status === 'APPROVED' ? new Date() : null }
    });

    await logAudit(req.admin.id, 'KYC_REVIEW', id, { status }, req.ip);
    res.json({ success: true, data: { status: profile.status } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

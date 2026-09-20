const express = require('express');
const router = express.Router();
const bonusService = require('../services/bonusService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

BigInt.prototype.toJSON = function () {
  return this.toString();
};

// 1. List Available Campaigns
router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'ACTIVE' }
    });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Activate Campaign
router.post('/activate', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'mock-user-id';
    const { campaignId } = req.body;
    
    if (!campaignId) {
      return res.status(400).json({ success: false, message: 'Missing campaignId' });
    }

    const bonus = await bonusService.activateCampaign(userId, campaignId);
    res.json({ success: true, data: bonus });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 3. View Active Bonuses for User
router.get('/active', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'mock-user-id';
    
    const bonuses = await prisma.bonusBalance.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { campaign: true }
    });
    
    res.json({ success: true, data: bonuses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

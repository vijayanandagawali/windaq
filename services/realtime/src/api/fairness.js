const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const provablyFair = require('../services/ProvablyFairService');

/**
 * Public Verifier endpoint
 */
router.get('/verify', (req, res) => {
  const { game, serverSeed, clientSeed, nonce = 0 } = req.query;

  if (!game || !serverSeed || !clientSeed) {
    return res.status(400).json({ success: false, message: 'Missing parameters' });
  }

  let result = null;

  try {
    switch (game) {
      case 'dice':
        result = provablyFair.deriveDiceResult(serverSeed, clientSeed, Number(nonce));
        break;
      case 'roulette':
        result = provablyFair.deriveRouletteResult(serverSeed, clientSeed, Number(nonce));
        break;
      case 'dragon-tiger':
        result = provablyFair.deriveDragonTigerResult(serverSeed, clientSeed, Number(nonce));
        break;
      case 'andar-bahar':
        result = provablyFair.deriveAndarBaharResult(serverSeed, clientSeed, Number(nonce));
        break;
      default:
        return res.status(400).json({ success: false, message: 'Unsupported game for public verification' });
    }

    res.json({
      success: true,
      game,
      outcome: result.outcome,
      hash: result.hash,
      algorithmVersion: result.version
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Admin Dispute Resolution endpoint
 * Fetch a past round's committed seed and run it through the verifier
 */
router.get('/admin/dispute', async (req, res) => {
  const { game, roundId } = req.query;

  if (!game || !roundId) {
    return res.status(400).json({ success: false, message: 'Missing parameters' });
  }

  try {
    let dbRecord = null;
    let result = null;

    if (game === 'dice') {
      dbRecord = await prisma.diceRoll.findUnique({ where: { id: roundId } });
      if (dbRecord && dbRecord.status === 'SETTLED') {
        result = provablyFair.deriveDiceResult(dbRecord.serverSeed, dbRecord.clientSeed, 0);
      }
    } else if (game === 'roulette') {
      dbRecord = await prisma.rouletteRoll.findUnique({ where: { id: roundId } });
      if (dbRecord && dbRecord.status === 'SETTLED') {
        result = provablyFair.deriveRouletteResult(dbRecord.serverSeed, dbRecord.clientSeed, 0);
      }
    } else if (game === 'dragon-tiger' || game === 'andar-bahar') {
      dbRecord = await prisma.tableGameRound.findUnique({ where: { id: roundId } });
      if (dbRecord && dbRecord.status === 'SETTLED') {
        if (game === 'dragon-tiger') result = provablyFair.deriveDragonTigerResult(dbRecord.serverSeed, dbRecord.clientSeed, 0);
        if (game === 'andar-bahar') result = provablyFair.deriveAndarBaharResult(dbRecord.serverSeed, dbRecord.clientSeed, 0);
      }
    }

    if (!dbRecord) return res.status(404).json({ success: false, message: 'Round not found' });
    if (dbRecord.status !== 'SETTLED') return res.status(400).json({ success: false, message: 'Round not yet settled, seeds are secret' });

    res.json({
      success: true,
      roundId: dbRecord.id,
      serverSeedHash: dbRecord.serverSeedHash,
      serverSeed: dbRecord.serverSeed, // Revealed for verification
      clientSeed: dbRecord.clientSeed,
      dbStoredOutcome: dbRecord.result || dbRecord.diceResult || dbRecord.resultNumber,
      verifiedOutcome: result.outcome,
      isMatch: JSON.stringify(dbRecord.result || dbRecord.diceResult || dbRecord.resultNumber) === JSON.stringify(result.outcome)
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

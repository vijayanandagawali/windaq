const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Universal Result History API (Prompt #62)
 * 
 * Supports:
 * - Latest 10, 20, 50, 100 completed rounds
 * - Pagination via page and limit query params
 * - Verification references and cryptographic proof links
 * - Filter by gameId and variantId
 */

router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const variantId = req.query.variantId || req.query.room;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * limit;

    const where = {
      gameId,
      status: 'COMPLETED'
    };

    if (variantId) {
      where.variantId = variantId;
    }

    const [rounds, total] = await Promise.all([
      prisma.gameRound.findMany({
        where,
        orderBy: { completedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          gameId: true,
          variantId: true,
          sequenceNumber: true,
          status: true,
          result: true,
          resultSummary: true,
          multiplier: true,
          winningNumber: true,
          winningColor: true,
          cards: true,
          serverSeedHash: true,
          serverSeed: true,
          clientSeed: true,
          nonce: true,
          fairnessRef: true,
          settlementStatus: true,
          totalStakePaise: true,
          totalPayoutPaise: true,
          playerCount: true,
          completedAt: true,
          createdAt: true
        }
      }),
      prisma.gameRound.count({ where })
    ]);

    // Format serialized response
    const formatted = rounds.map(r => ({
      roundId: r.id,
      gameId: r.gameId,
      variantId: r.variantId,
      sequenceNumber: r.sequenceNumber.toString(),
      result: r.result,
      resultSummary: r.resultSummary,
      multiplier: r.multiplier,
      winningNumber: r.winningNumber,
      winningColor: r.winningColor,
      cards: r.cards,
      serverSeedHash: r.serverSeedHash,
      serverSeed: r.serverSeed,
      clientSeed: r.clientSeed,
      nonce: r.nonce,
      fairnessRef: r.fairnessRef || `/api/fairness/verify?roundId=${r.id}`,
      settlementStatus: r.settlementStatus,
      totalStakePaise: r.totalStakePaise.toString(),
      totalPayoutPaise: r.totalPayoutPaise.toString(),
      playerCount: r.playerCount,
      completedAt: r.completedAt || r.createdAt
    }));

    res.json({
      success: true,
      gameId,
      variantId: variantId || 'ALL',
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      history: formatted
    });
  } catch (err) {
    console.error('[HistoryAPI] Error fetching history:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve result history.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const gameId = req.query.gameId;

    const where = { status: 'COMPLETED' };
    if (gameId) where.gameId = gameId;

    const rounds = await prisma.gameRound.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        gameId: true,
        variantId: true,
        sequenceNumber: true,
        result: true,
        resultSummary: true,
        serverSeedHash: true,
        serverSeed: true,
        clientSeed: true,
        completedAt: true
      }
    });

    res.json({
      success: true,
      history: rounds.map(r => ({
        ...r,
        roundId: r.id,
        sequenceNumber: r.sequenceNumber.toString()
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

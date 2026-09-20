const express = require('express');
const router = express.Router();
// We use the root prisma client
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/catalog
router.get('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    const categories = await prisma.category.findMany({
      include: {
        games: true
      },
      orderBy: {
        order: 'asc'
      }
    });

    const heroFeatured = await prisma.game.findFirst({
      where: { isActive: true },
      orderBy: { minStake: 'desc' }
    });
    
    let favoriteGameIds = [];
    if (userId) {
      const favs = await prisma.playerFavorite.findMany({
        where: { userId },
        select: { gameId: true }
      });
      favoriteGameIds = favs.map(f => f.gameId);
    }

    res.json({
      success: true,
      data: {
        hero: heroFeatured,
        categories: categories,
        favorites: favoriteGameIds
      }
    });
  } catch (error) {
    console.error('Catalog fetch error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/catalog/favorite
router.post('/favorite', async (req, res) => {
  try {
    const { userId, gameId, isFavorite } = req.body;
    
    if (isFavorite) {
      await prisma.playerFavorite.upsert({
        where: { userId_gameId: { userId, gameId } },
        update: {},
        create: { userId, gameId }
      });
    } else {
      await prisma.playerFavorite.deleteMany({
        where: { userId, gameId }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/catalog/track
router.post('/track', async (req, res) => {
  try {
    const { userId, gameId } = req.body;
    await prisma.gameSession.create({
      data: {
        userId,
        gameId
      }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;

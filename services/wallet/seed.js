require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Game Hub Catalog...');

  // Create Categories
  const catTrending = await prisma.category.upsert({ where: { slug: 'trending' }, update: {}, create: { slug: 'trending', name: 'Trending Now', order: 1 } });
  const catLive = await prisma.category.upsert({ where: { slug: 'live-casino' }, update: {}, create: { slug: 'live-casino', name: 'Live Dealers', order: 2 } });
  const catSports = await prisma.category.upsert({ where: { slug: 'sports' }, update: {}, create: { slug: 'sports', name: 'Sportsbook', order: 3 } });
  const catSlots = await prisma.category.upsert({ where: { slug: 'slots' }, update: {}, create: { slug: 'slots', name: 'Slots', order: 4 } });
  const catTable = await prisma.category.upsert({ where: { slug: 'table-games' }, update: {}, create: { slug: 'table-games', name: 'Table Games', order: 5 } });

  const defaultLimits = { min: 1000, max: 10000000 }; // paise (10 INR to 100,000 INR)
  const defaultRG = { warning: "Play responsibly", RTP: 97.5, volatility: "MEDIUM" };

  const games = [
    {
      slug: 'aviator', name: 'Aviator', type: 'CRASH', provider: 'Spribe', variant: 'Classic',
      thumbnailUrl: 'https://images.unsplash.com/photo-1596280327429-231a49dc976f?q=80&w=800&auto=format&fit=crop', // Airplane / sky
      isLive: false, isNew: false, isActive: true, minStake: 10,
      rules: { howToPlay: "Cash out before the plane flies away!" }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 97.0, volatility: "HIGH" },
      cats: [catTrending]
    },
    {
      slug: 'colour-prediction', name: 'Colour Prediction', type: 'CASINO', provider: 'WinDaq Originals', variant: '1-Min',
      thumbnailUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop', // Colors
      isLive: false, isNew: false, isActive: true, minStake: 10,
      rules: { howToPlay: "Guess the next color to win 2x!" }, limits: defaultLimits, rgInfo: defaultRG,
      cats: [catTrending]
    },
    {
      slug: 'texas-holdem', name: 'Texas Hold\'em Poker', type: 'CASINO', provider: 'WinDaq Originals', variant: 'No Limit',
      thumbnailUrl: 'https://images.unsplash.com/photo-1541339893910-c44bb8373b5d?q=80&w=800&auto=format&fit=crop', // Poker chips
      isLive: false, isNew: true, isActive: true, minStake: 50,
      rules: { howToPlay: "Standard Texas Hold'em rules apply." }, limits: { min: 5000, max: 50000000 }, rgInfo: { ...defaultRG, volatility: "HIGH" },
      cats: [catTable, catTrending]
    },
    {
      slug: 'slots', name: 'Ocean Treasures', type: 'SLOTS', provider: 'WinDaq Originals', variant: 'Megaways',
      thumbnailUrl: 'https://images.unsplash.com/photo-1595568326848-bc3513a967a5?q=80&w=800&auto=format&fit=crop', // Slots
      isLive: false, isNew: true, isActive: true, minStake: 10,
      rules: { howToPlay: "Spin to match symbols on 243 paylines." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 96.2, volatility: "HIGH" },
      cats: [catSlots]
    },
    {
      slug: 'scratch', name: 'Lucky 7 Scratch', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Instant',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop', // Scratch/Lucky
      isLive: false, isNew: true, isActive: true, minStake: 50,
      rules: { howToPlay: "Match 3 symbols to win up to 10,000x." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 95.0, volatility: "EXTREME" },
      cats: [catTrending]
    },
    {
      slug: 'lotto', name: 'Quick Draw 6/49', type: 'LOTTERY', provider: 'WinDaq Originals', variant: '5-Min',
      thumbnailUrl: 'https://images.unsplash.com/photo-1628102491629-77858ab215f7?q=80&w=800&auto=format&fit=crop', // Lottery balls
      isLive: true, isNew: true, isActive: true, minStake: 100,
      rules: { howToPlay: "Pick 6 numbers from 1-49." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 85.0, volatility: "EXTREME" },
      cats: [catLive]
    },
    {
      slug: 'teen-patti', name: 'Teen Patti Classic', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Classic',
      thumbnailUrl: 'https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?q=80&w=800&auto=format&fit=crop', // Cards
      isLive: true, isNew: true, isActive: true, minStake: 10,
      rules: { howToPlay: "Indian 3-card poker." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 98.0, volatility: "MEDIUM" },
      cats: [catTable, catTrending]
    },
    {
      slug: 'dice', name: 'Sic Bo Classic', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Classic',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517457210631-01ea540eb406?q=80&w=800&auto=format&fit=crop', // Dice
      isLive: true, isNew: true, isActive: true, minStake: 10,
      rules: { howToPlay: "Predict the outcome of 3 dice." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 97.2, volatility: "MEDIUM" },
      cats: [catTable]
    },
    {
      slug: 'dragon-tiger', name: 'Dragon Tiger', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Speed',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop', // Dragon
      isLive: true, isNew: false, isActive: true, minStake: 10,
      rules: { howToPlay: "Bet on Dragon or Tiger. Highest card wins." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 96.27, volatility: "LOW" },
      cats: [catTable, catTrending]
    },
    {
      slug: 'european-roulette', name: 'European Roulette', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Auto',
      thumbnailUrl: 'https://images.unsplash.com/photo-1606167668511-22c62c3e1e94?q=80&w=800&auto=format&fit=crop', // Roulette wheel
      isLive: true, isNew: false, isActive: true, minStake: 10,
      rules: { howToPlay: "Single zero roulette." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 97.3, volatility: "LOW" },
      cats: [catTable, catTrending]
    },
    {
      slug: 'andar-bahar', name: 'Andar Bahar', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Speed',
      thumbnailUrl: 'https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=800&auto=format&fit=crop', // Cards
      isLive: true, isNew: false, isActive: true, minStake: 10,
      rules: { howToPlay: "Match the Joker card on Andar or Bahar side." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 95.0, volatility: "LOW" },
      cats: [catTable, catLive]
    },
    {
      slug: 'blackjack', name: 'Blackjack', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Classic',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517540277353-832d20cc162b?q=80&w=800&auto=format&fit=crop', // Blackjack
      isLive: true, isNew: true, isActive: true, minStake: 50,
      rules: { howToPlay: "Beat the dealer without going over 21." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 99.5, volatility: "LOW" },
      cats: [catTable]
    },
    {
      slug: 'rummy', name: 'Indian Rummy', type: 'CASINO', provider: 'WinDaq Originals', variant: '13-Card',
      thumbnailUrl: 'https://images.unsplash.com/photo-1622359480650-6819a8ea41e0?q=80&w=800&auto=format&fit=crop', // Cards
      isLive: true, isNew: true, isActive: true, minStake: 10,
      rules: { howToPlay: "Form valid sequences and sets." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 97.0, volatility: "MEDIUM" },
      cats: [catTable]
    },
    {
      slug: 'lightning-roulette', name: 'Lightning Roulette', type: 'LIVE', provider: 'Evolution', variant: 'Multiplier',
      thumbnailUrl: 'https://images.unsplash.com/photo-1601292025754-0775cb560411?q=80&w=800&auto=format&fit=crop', // Lightning Roulette
      isLive: true, isNew: false, isActive: true, minStake: 20,
      rules: { howToPlay: "Roulette with random multipliers up to 500x." }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 97.3, volatility: "HIGH" },
      cats: [catLive, catTrending]
    },
    {
      slug: 'sportsbook', name: 'Cricket Sportsbook', type: 'SPORTS', provider: 'WinDaq Sports', variant: 'Live & Pre-Match',
      thumbnailUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop', // Cricket stadium
      isLive: true, isNew: true, isActive: true, minStake: 50,
      rules: { howToPlay: "Bet on Live Cricket Matches and International Leagues." }, limits: { min: 5000, max: 50000000 }, rgInfo: { ...defaultRG, volatility: "MEDIUM" },
      cats: [catSports, catTrending]
    },
    {
      slug: 'live-casino', name: 'Live Dealer Studio', type: 'LIVE', provider: 'WinDaq Studios', variant: 'VIP Tables',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=800&auto=format&fit=crop', // Live Studio
      isLive: true, isNew: true, isActive: true, minStake: 100,
      rules: { howToPlay: "Play with live human dealers in real-time." }, limits: { min: 10000, max: 100000000 }, rgInfo: { ...defaultRG, volatility: "LOW" },
      cats: [catLive]
    }
  ];

  for (const g of games) {
    await prisma.game.upsert({
      where: { slug: g.slug },
      update: {
        name: g.name, type: g.type, provider: g.provider, variant: g.variant,
        thumbnailUrl: g.thumbnailUrl, isLive: g.isLive, isNew: g.isNew, isActive: g.isActive, minStake: g.minStake,
        rules: g.rules, limits: g.limits, rgInfo: g.rgInfo,
        categories: { set: g.cats.map(c => ({ id: c.id })) }
      },
      create: {
        slug: g.slug, name: g.name, type: g.type, provider: g.provider, variant: g.variant,
        thumbnailUrl: g.thumbnailUrl, isLive: g.isLive, isNew: g.isNew, isActive: g.isActive, minStake: g.minStake,
        rules: g.rules, limits: g.limits, rgInfo: g.rgInfo,
        categories: { connect: g.cats.map(c => ({ id: c.id })) }
      }
    });
  }

  // Live Dealer Setup
  await prisma.liveDealer.upsert({
    where: { pinCode: '1234' },
    update: {},
    create: { name: 'Alice', pinCode: '1234' }
  });

  await prisma.liveTable.upsert({
    where: { id: 'live-roulette-1' },
    update: {},
    create: { id: 'live-roulette-1', gameType: 'ROULETTE', name: 'VIP Live Roulette' }
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

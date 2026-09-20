export interface CatalogGame {
  id: string;
  slug: string;
  name: string;
  category: string;
  type: string;
  minStake: number;
  maxStake: number;
  rtp: number;
  isHot: boolean;
  isFeatured: boolean;
  provider: string;
  thumbnailUrl: string;
  bannerUrl: string;
  description: string;
}

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  order: number;
  games: CatalogGame[];
}

export const ALL_17_GAMES: CatalogGame[] = [
  {
    id: 'game_aviator',
    slug: 'aviator',
    name: 'Aviator (Crash)',
    category: 'CRASH',
    type: 'CRASH',
    minStake: 10,
    maxStake: 100000,
    rtp: 97.0,
    isHot: true,
    isFeatured: true,
    provider: 'Spribe / WinDaq',
    thumbnailUrl: '/games/aviator.png',
    bannerUrl: '/banners/aviator.png',
    description: 'Watch the multiplier climb and cash out before the jet flies away!'
  },
  {
    id: 'game_colour_prediction',
    slug: 'colour-prediction',
    name: 'Colour Prediction',
    category: 'LOTTERY',
    type: 'COLOUR',
    minStake: 10,
    maxStake: 50000,
    rtp: 97.5,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Originals',
    thumbnailUrl: '/games/colour.png',
    bannerUrl: '/banners/colour.png',
    description: 'Predict Red, Green, or Violet with instant 1-minute and 3-minute draws.'
  },
  {
    id: 'game_slots',
    slug: 'slots',
    name: 'Vegas 777 Slots',
    category: 'SLOTS',
    type: 'SLOTS',
    minStake: 10,
    maxStake: 10000,
    rtp: 96.5,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Studios',
    thumbnailUrl: '/games/slots.png',
    bannerUrl: '/banners/slots.png',
    description: 'Spin 3 reels and hit 777 wilds for massive payouts.'
  },
  {
    id: 'game_scratch',
    slug: 'scratch',
    name: 'Scratch Card Gold',
    category: 'CASUAL',
    type: 'SCRATCH',
    minStake: 50,
    maxStake: 1000,
    rtp: 96.0,
    isHot: false,
    isFeatured: true,
    provider: 'WinDaq Casual',
    thumbnailUrl: '/games/scratch.png',
    bannerUrl: '/banners/scratch.png',
    description: 'Scratch metallic foil to reveal 3 matching cash multipliers.'
  },
  {
    id: 'game_lotto',
    slug: 'lotto',
    name: 'Lotto 5-Min Blower',
    category: 'LOTTERY',
    type: 'LOTTERY',
    minStake: 20,
    maxStake: 10000,
    rtp: 95.5,
    isHot: false,
    isFeatured: false,
    provider: 'WinDaq Lottery',
    thumbnailUrl: '/games/lotto.png',
    bannerUrl: '/banners/lotto.png',
    description: '36-ball air chamber draw with guaranteed tier payouts.'
  },
  {
    id: 'game_teen_patti',
    slug: 'teen-patti',
    name: 'Teen Patti 20-20',
    category: 'CARD',
    type: 'TABLE',
    minStake: 10,
    maxStake: 50000,
    rtp: 98.2,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Live',
    thumbnailUrl: '/games/teen-patti.png',
    bannerUrl: '/banners/teen-patti.png',
    description: 'Classic Indian 3-card poker with Trail, Pure Sequence, and Pair bets.'
  },
  {
    id: 'game_texas_holdem',
    slug: 'texas-holdem',
    name: 'Texas Holdem Poker',
    category: 'CARD',
    type: 'POKER',
    minStake: 50,
    maxStake: 100000,
    rtp: 98.5,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Poker Room',
    thumbnailUrl: '/games/poker.png',
    bannerUrl: '/banners/poker.png',
    description: '9-seat multiplayer poker table with Flop, Turn, and River action.'
  },
  {
    id: 'game_rummy',
    slug: 'rummy',
    name: 'Rummy 10 Classic',
    category: 'CARD',
    type: 'RUMMY',
    minStake: 25,
    maxStake: 25000,
    rtp: 98.0,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Cards',
    thumbnailUrl: '/games/rummy.png',
    bannerUrl: '/banners/rummy.png',
    description: '10-card Indian rummy with pure sequence declarations.'
  },
  {
    id: 'game_dice',
    slug: 'dice',
    name: 'Provably Fair Dice',
    category: 'TABLE',
    type: 'DICE',
    minStake: 10,
    maxStake: 50000,
    rtp: 99.0,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Originals',
    thumbnailUrl: '/games/dice.png',
    bannerUrl: '/banners/dice.png',
    description: 'Small / Big / Triple bets backed by SHA-256 cryptographic verification.'
  },
  {
    id: 'game_european_roulette',
    slug: 'european-roulette',
    name: 'European Roulette 3D',
    category: 'ROULETTE',
    type: 'ROULETTE',
    minStake: 10,
    maxStake: 100000,
    rtp: 97.3,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Live',
    thumbnailUrl: '/games/roulette.png',
    bannerUrl: '/banners/roulette.png',
    description: 'Single-zero 37-pocket European roulette wheel with 35:1 straight payouts.'
  },
  {
    id: 'game_lightning_roulette',
    slug: 'lightning-roulette',
    name: 'Lightning Roulette Live',
    category: 'ROULETTE',
    type: 'ROULETTE',
    minStake: 20,
    maxStake: 100000,
    rtp: 97.3,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Live',
    thumbnailUrl: '/games/lightning-roulette.png',
    bannerUrl: '/banners/lightning-roulette.png',
    description: 'High-voltage lightning strikes boosting straight numbers up to 500x.'
  },
  {
    id: 'game_blackjack',
    slug: 'blackjack',
    name: 'Blackjack 21 Elite',
    category: 'CARD',
    type: 'BLACKJACK',
    minStake: 50,
    maxStake: 100000,
    rtp: 99.5,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Live',
    thumbnailUrl: '/games/blackjack.png',
    bannerUrl: '/banners/blackjack.png',
    description: 'Dealer stands on Soft 17, 3:2 Natural Blackjack, Double Down & Split.'
  },
  {
    id: 'game_andar_bahar',
    slug: 'andar-bahar',
    name: 'Andar Bahar Live Cards',
    category: 'TABLE',
    type: 'CARD',
    minStake: 10,
    maxStake: 50000,
    rtp: 98.0,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Live',
    thumbnailUrl: '/games/andar-bahar.png',
    bannerUrl: '/banners/andar-bahar.png',
    description: 'Joker card match battle between Andar and Bahar with bead road history.'
  },
  {
    id: 'game_dragon_tiger',
    slug: 'dragon-tiger',
    name: 'Dragon Tiger Live Table',
    category: 'TABLE',
    type: 'CARD',
    minStake: 10,
    maxStake: 50000,
    rtp: 96.2,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Live',
    thumbnailUrl: '/games/dragon-tiger.png',
    bannerUrl: '/banners/dragon-tiger.png',
    description: 'Single-card showdown between Dragon and Tiger with 8:1 Tie payouts.'
  },
  {
    id: 'game_live_casino',
    slug: 'live-casino',
    name: 'Live Dealer Casino Hub',
    category: 'LIVE',
    type: 'LIVE',
    minStake: 50,
    maxStake: 200000,
    rtp: 98.5,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq VIP Tables',
    thumbnailUrl: '/games/live-casino.png',
    bannerUrl: '/banners/live-casino.png',
    description: 'Immersive simulated live dealer tables with real-time video and audio streams.'
  },
  {
    id: 'game_live_roulette',
    slug: 'live-roulette',
    name: 'Simulated Live Dealer Roulette',
    category: 'LIVE',
    type: 'ROULETTE',
    minStake: 10,
    maxStake: 100000,
    rtp: 97.3,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Live Studio',
    thumbnailUrl: '/games/live-roulette.png',
    bannerUrl: '/banners/live-roulette.png',
    description: 'Synchronized virtual croupier spinning 37 pockets with audio commentary.'
  },
  {
    id: 'game_sportsbook',
    slug: 'sportsbook',
    name: 'Live Sports & Cricket Exchange',
    category: 'SPORTS',
    type: 'SPORTS',
    minStake: 50,
    maxStake: 500000,
    rtp: 96.8,
    isHot: true,
    isFeatured: true,
    provider: 'WinDaq Exchange',
    thumbnailUrl: '/games/sportsbook.png',
    bannerUrl: '/banners/sportsbook.png',
    description: 'Back and lay cricket odds, IPL, football, and tennis with live market suspension.'
  }
];

export const CATEGORIES: CatalogCategory[] = [
  {
    id: 'cat_crash',
    slug: 'crash',
    name: 'Crash Games',
    icon: 'Rocket',
    order: 1,
    games: ALL_17_GAMES.filter(g => g.category === 'CRASH')
  },
  {
    id: 'cat_live',
    slug: 'live-casino',
    name: 'Live Casino & Dealers',
    icon: 'Video',
    order: 2,
    games: ALL_17_GAMES.filter(g => g.category === 'LIVE' || g.slug === 'dragon-tiger' || g.slug === 'andar-bahar')
  },
  {
    id: 'cat_cards',
    slug: 'card-games',
    name: 'Indian & International Cards',
    icon: 'Club',
    order: 3,
    games: ALL_17_GAMES.filter(g => g.category === 'CARD' || g.slug === 'andar-bahar' || g.slug === 'dragon-tiger')
  },
  {
    id: 'cat_table',
    slug: 'table-games',
    name: 'Table Games & Roulette',
    icon: 'Dice5',
    order: 4,
    games: ALL_17_GAMES.filter(g => g.category === 'TABLE' || g.category === 'ROULETTE')
  },
  {
    id: 'cat_slots',
    slug: 'slots',
    name: 'Slots & Arcade',
    icon: 'Coins',
    order: 5,
    games: ALL_17_GAMES.filter(g => g.category === 'SLOTS' || g.category === 'CASUAL')
  },
  {
    id: 'cat_lottery',
    slug: 'lottery',
    name: 'Lottery & Colour',
    icon: 'Sparkles',
    order: 6,
    games: ALL_17_GAMES.filter(g => g.category === 'LOTTERY')
  },
  {
    id: 'cat_sports',
    slug: 'sports',
    name: 'Sports & Cricket Exchange',
    icon: 'Trophy',
    order: 7,
    games: ALL_17_GAMES.filter(g => g.category === 'SPORTS')
  }
];

export const DEFAULT_CATALOG = {
  hero: ALL_17_GAMES.find(g => g.slug === 'aviator') || ALL_17_GAMES[0],
  categories: CATEGORIES,
  favorites: ['game_aviator', 'game_teen_patti', 'game_colour_prediction']
};

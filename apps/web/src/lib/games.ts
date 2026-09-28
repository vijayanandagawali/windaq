/**
 * The WinDaq game catalog — the single source of truth for what the lobby shows.
 *
 * Only games whose outcomes and money run on the authoritative game server are listed as live.
 * Every figure here must be true: payouts mirror the server engines, and nothing claims a live
 * studio, a third-party provider or player counts that do not exist.
 */

export type GameCategory = 'crash' | 'instant' | 'table' | 'draws';
export type GameStatus = 'live' | 'coming-soon';

export interface LobbyGame {
  slug: string;
  name: string;
  href: string;
  category: GameCategory;
  status: GameStatus;
  /** One line shown under the title. */
  tagline: string;
  /** Short, factual hook drawn from the server paytable (e.g. "Pays up to 35:1"). */
  highlight: string;
  minBet: number;
  /** Portrait 4:5 artwork. */
  cardImage: string;
  /** Wide artwork for the featured hero. */
  heroImage: string;
  accent: string;
}

const art = (slug: string) => ({
  cardImage: `/artwork/games/${slug}-card.svg`,
  heroImage: `/artwork/games/${slug}-hero.svg`
});

export const GAMES: LobbyGame[] = [
  {
    slug: 'aviator', name: 'Aviator', href: '/games/aviator', category: 'crash', status: 'live',
    tagline: 'Cash out before the plane flies away', highlight: 'Multiplier crash', minBet: 10,
    accent: '#0EA5E9', ...art('aviator')
  },
  {
    slug: 'colour-prediction', name: 'Colour Prediction', href: '/games/color-prediction', category: 'draws', status: 'live',
    tagline: 'Red, green or violet every minute', highlight: 'Pays up to 9x', minBet: 10,
    accent: '#26F0B2', ...art('colour-prediction')
  },
  {
    slug: 'dice', name: 'Sic Bo Dice', href: '/games/dice', category: 'draws', status: 'live',
    tagline: 'Three dice, big or small, totals and triples', highlight: 'Pays up to 150:1', minBet: 10,
    accent: '#FFC857', ...art('dice')
  },
  {
    slug: 'lotto', name: 'Lotto 6/49', href: '/games/lotto', category: 'draws', status: 'live',
    tagline: 'Pick six numbers for the next draw', highlight: '₹1 Crore jackpot', minBet: 100,
    accent: '#5BB8FF', ...art('lotto')
  },
  {
    slug: 'european-roulette', name: 'European Roulette', href: '/games/european-roulette', category: 'table', status: 'live',
    tagline: 'Single-zero wheel, every classic bet', highlight: 'Pays up to 35:1', minBet: 10,
    accent: '#FF5D6C', ...art('european-roulette')
  },
  {
    slug: 'dragon-tiger', name: 'Dragon Tiger', href: '/games/dragon-tiger', category: 'table', status: 'live',
    tagline: 'One card each — the higher card wins', highlight: 'Tie pays 11:1', minBet: 10,
    accent: '#FF8A3D', ...art('dragon-tiger')
  },
  {
    slug: 'andar-bahar', name: 'Andar Bahar', href: '/games/andar-bahar', category: 'table', status: 'live',
    tagline: 'Where will the joker’s match land?', highlight: 'Real 52-card deal', minBet: 10,
    accent: '#B46CFF', ...art('andar-bahar')
  },
  {
    slug: 'blackjack', name: 'Blackjack', href: '/games/blackjack', category: 'table', status: 'live',
    tagline: 'Beat the dealer to 21', highlight: 'Blackjack pays 3:2', minBet: 10,
    accent: '#2BD67B', ...art('blackjack')
  },
  {
    slug: 'slots', name: 'Ocean Treasures Slots', href: '/games/slots', category: 'instant', status: 'live',
    tagline: '5 reels, wilds and scatters', highlight: '95.6% RTP', minBet: 10,
    accent: '#FFC857', ...art('slots')
  },
  {
    slug: 'scratch', name: 'Scratch Cards', href: '/games/scratch', category: 'instant', status: 'live',
    tagline: 'Silver, Gold and Diamond tickets', highlight: 'Win up to ₹1,00,000', minBet: 50,
    accent: '#FFD166', ...art('scratch')
  },
  {
    slug: 'teen-patti', name: 'Teen Patti 20-20', href: '/games/teen-patti', category: 'table', status: 'live',
    tagline: 'Player A or Player B — which hand wins?', highlight: 'Pair+ up to 41x', minBet: 10,
    accent: '#FF5FA2', ...art('teen-patti')
  },
  {
    slug: 'texas-holdem', name: 'Casino Hold’em', href: '/games/texas-holdem', category: 'table', status: 'live',
    tagline: 'Your best five cards against the dealer', highlight: 'Royal flush pays 100:1', minBet: 10,
    accent: '#26F0B2', ...art('texas-holdem')
  },
  {
    slug: 'rummy', name: 'Rummy', href: '/games/rummy', category: 'table', status: 'live',
    tagline: '13-card Points Rummy against the Computer', highlight: 'Free practice', minBet: 0,
    accent: '#B46CFF', ...art('rummy')
  },
  {
    slug: 'sportsbook', name: 'Sports', href: '/games/sportsbook', category: 'crash', status: 'coming-soon',
    tagline: 'Cricket and football markets are on the way', highlight: 'Coming soon', minBet: 10,
    accent: '#2BD67B', ...art('sportsbook')
  }
];

export const LIVE_GAMES = GAMES.filter((g) => g.status === 'live');
export const COMING_SOON_GAMES = GAMES.filter((g) => g.status === 'coming-soon');

export const CATEGORIES: { id: 'all' | GameCategory; label: string }[] = [
  { id: 'all', label: 'All games' },
  { id: 'table', label: 'Table games' },
  { id: 'draws', label: 'Draws & dice' },
  { id: 'instant', label: 'Slots & scratch' },
  { id: 'crash', label: 'Crash' }
];

export function findGame(slug: string): LobbyGame | undefined {
  return GAMES.find((g) => g.slug === slug);
}

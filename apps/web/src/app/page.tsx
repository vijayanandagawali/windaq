'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  Search, 
  Star, 
  Sparkles,
  Flame,
  Palette,
  Gamepad2,
  Coins,
  Ticket,
  Crown,
  Club,
  Layers,
  CircleDot,
  ShieldCheck,
  Zap,
  Dices,
  LayoutGrid,
  Trophy
} from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';
import GameCard from '@/components/games/GameCard';
import HeroBanner from '@/components/games/HeroBanner';
import { getGameArtwork, LOBBY_CATEGORIES } from '@/lib/gameArtwork';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  all: <Sparkles className="w-4 h-4" />,
  favorites: <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />,
  crash: <TrendingUp className="w-4 h-4 text-rose-400" />,
  colour: <Palette className="w-4 h-4 text-emerald-400" />,
  slots: <Gamepad2 className="w-4 h-4 text-amber-400" />,
  scratch: <Coins className="w-4 h-4 text-amber-500" />,
  lotto: <Ticket className="w-4 h-4 text-sky-400" />,
  'teen-patti': <Crown className="w-4 h-4 text-pink-400" />,
  poker: <Club className="w-4 h-4 text-emerald-400" />,
  rummy: <Layers className="w-4 h-4 text-purple-400" />,
  roulette: <CircleDot className="w-4 h-4 text-rose-500" />,
  blackjack: <ShieldCheck className="w-4 h-4 text-teal-400" />,
  'andar-bahar': <Flame className="w-4 h-4 text-fuchsia-400" />,
  'dragon-tiger': <Zap className="w-4 h-4 text-orange-400" />,
  dice: <Dices className="w-4 h-4 text-yellow-400" />,
  table: <LayoutGrid className="w-4 h-4 text-sky-400" />,
  hot: <Flame className="w-4 h-4 text-red-500" />,
  sports: <Trophy className="w-4 h-4 text-emerald-500" />
};

export default function GameHubPage() {
  const [catalog, setCatalog] = useState<{ categories: any[]; hero: any; favorites: string[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const { userId } = useWalletStore();
  const activeUserId = userId || 'sbx-usr-normal-001';

  useEffect(() => {
    fetch(getApiUrl('/api/catalog'), { headers: { 'x-user-id': activeUserId } })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCatalog(data.data);
        }
      })
      .catch(err => console.error('Catalog fetch error:', err))
      .finally(() => setLoading(false));
  }, [activeUserId]);

  const toggleFavorite = async (e: React.MouseEvent, gameId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!catalog) return;
    
    const isCurrentlyFav = catalog.favorites.includes(gameId);
    const newFavs = isCurrentlyFav 
      ? catalog.favorites.filter(id => id !== gameId)
      : [...catalog.favorites, gameId];
      
    // Optimistic UI update
    setCatalog({ ...catalog, favorites: newFavs });

    try {
      await fetch(getApiUrl('/api/catalog/favorite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': activeUserId },
        body: JSON.stringify({ userId: activeUserId, gameId, isFavorite: !isCurrentlyFav })
      });
      if (!isCurrentlyFav) {
        toast.success("Added to Favorites!");
      } else {
        toast("Removed from Favorites", { icon: '⭐' });
      }
    } catch (err) {
      // Revert if error
      setCatalog({ ...catalog, favorites: catalog.favorites });
    }
  };

  // Flatten and deduplicate all games from catalog
  const allGames = useMemo(() => {
    if (!catalog?.categories) return [];
    const flat = catalog.categories.flatMap(c => c.games);
    const seen = new Set();
    return flat.filter(g => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });
  }, [catalog]);

  // Comprehensive Category Filter Matrix
  const displayGames = useMemo(() => {
    let filtered = allGames;

    if (activeCategory === 'favorites') {
      filtered = filtered.filter(g => catalog?.favorites.includes(g.id));
    } else if (activeCategory !== 'all') {
      filtered = filtered.filter(g => {
        const slug = g.slug.toLowerCase();
        const type = (g.type || '').toUpperCase();

        switch (activeCategory) {
          case 'crash':
            return slug === 'aviator' || type === 'CRASH';
          case 'colour':
            return slug === 'colour-prediction';
          case 'slots':
            return slug === 'slots' || type === 'SLOTS';
          case 'scratch':
            return slug === 'scratch';
          case 'lotto':
            return slug === 'lotto' || type === 'LOTTERY';
          case 'teen-patti':
            return slug === 'teen-patti';
          case 'poker':
            return slug === 'texas-holdem';
          case 'rummy':
            return slug === 'rummy';
          case 'roulette':
            return slug === 'european-roulette' || slug === 'lightning-roulette';
          case 'blackjack':
            return slug === 'blackjack';
          case 'andar-bahar':
            return slug === 'andar-bahar';
          case 'dragon-tiger':
            return slug === 'dragon-tiger';
          case 'dice':
            return slug === 'dice';
          case 'table':
            return ['teen-patti', 'texas-holdem', 'rummy', 'european-roulette', 'blackjack', 'andar-bahar', 'dragon-tiger', 'dice', 'table-games', 'lightning-roulette'].includes(slug);
          case 'hot':
            return ['aviator', 'colour-prediction', 'slots', 'teen-patti', 'lightning-roulette', 'sportsbook', 'live-casino'].includes(slug);
          case 'sports':
            return slug === 'sportsbook' || type === 'SPORTS';
          default:
            return true;
        }
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(g => 
        g.name.toLowerCase().includes(q) || 
        g.provider?.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [allGames, activeCategory, searchQuery, catalog?.favorites]);

  const hero = catalog?.hero || allGames[0];
  const heroArtwork = hero ? getGameArtwork(hero.slug) : null;

  return (
    <div className="space-y-8 pb-24">
      {/* Preload Link for 16:9 Hero Image */}
      {heroArtwork && (
        <link rel="preload" as="image" href={heroArtwork.heroImage} />
      )}

      {/* Live Winners Marquee Ticker */}
      <div id="live-winners-marquee" className="bg-ocean-card/90 border-b border-neon-mint/20 py-2.5 px-4 overflow-hidden relative shadow-[0_0_15px_rgba(0,255,163,0.1)]">
        <div className="flex items-center gap-6 text-xs font-bold whitespace-nowrap overflow-x-auto hide-scrollbar">
          <span className="flex items-center gap-1.5 text-neon-mint font-extrabold uppercase tracking-wider bg-neon-mint/10 px-2.5 py-0.5 rounded-full border border-neon-mint/30">
            <span className="w-2 h-2 rounded-full bg-neon-mint animate-ping" />
            LIVE PAYOUTS
          </span>
          <span className="text-gray-300">🏆 <strong className="text-white">Player_8492</strong> won <span className="text-neon-mint font-black">₹48,200</span> on Aviator (12.4x)</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-300">⚡ <strong className="text-white">Player_1029</strong> won <span className="text-emerald-400 font-black">₹15,000</span> on Live Roulette</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-300">🔥 <strong className="text-white">Player_5839</strong> won <span className="text-yellow-400 font-black">₹25,000</span> on Ocean Treasures</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-300">💎 <strong className="text-white">Player_9420</strong> won <span className="text-cyan-400 font-black">₹9,800</span> on Colour Prediction</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-300">👑 <strong className="text-white">Player_3319</strong> won <span className="text-pink-400 font-black">₹32,500</span> on Teen Patti Classic</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-300">🎯 <strong className="text-white">Player_7102</strong> won <span className="text-amber-400 font-black">₹1,00,000</span> on Lucky 7 Scratch</span>
        </div>
      </div>

      {/* Sticky Search & 16-Category Filter Bar */}
      <div className="sticky top-[58px] z-30 bg-deep-ocean/95 backdrop-blur-md border-b border-white/10 py-3.5 px-4 md:px-8 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-4 justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search 16+ games, providers..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-neon-mint transition-colors"
            />
          </div>

          {/* 16 Category Navigation Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar select-none">
            {LOBBY_CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.slug;
              return (
                <button 
                  key={cat.slug}
                  onClick={() => setActiveCategory(cat.slug)}
                  className={`cat-pill whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive 
                      ? 'bg-neon-mint text-deep-ocean shadow-[0_0_15px_rgba(0,255,163,0.3)] scale-105' 
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
                  }`}
                >
                  {CATEGORY_ICONS[cat.slug] || <Sparkles className="w-3.5 h-3.5" />}
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-10">
        {/* HERO SECTION: 16:9 Cinema Banner */}
        {hero && activeCategory === 'all' && !searchQuery && (
          <HeroBanner hero={hero} />
        )}

        {/* GAMES GRID */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-neon-mint/10 border border-neon-mint/20 text-neon-mint">
                {CATEGORY_ICONS[activeCategory] || <TrendingUp size={20} />}
              </span>
              <span>
                {searchQuery 
                  ? `Search Results ("${searchQuery}")` 
                  : activeCategory === 'favorites' 
                    ? 'My Favorites' 
                    : LOBBY_CATEGORIES.find(c => c.slug === activeCategory)?.name || 'All Games'
                }
              </span>
              <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                {displayGames.length} Games
              </span>
            </h2>
          </div>
          
          {loading ? (
            /* Loading Skeleton Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] rounded-2xl bg-slate-900 border border-slate-800 animate-pulse p-4 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="h-4 w-12 bg-slate-800 rounded" />
                    <div className="h-6 w-6 bg-slate-800 rounded-full" />
                  </div>
                  <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto" />
                  <div className="space-y-2">
                    <div className="h-3 w-16 bg-slate-800 rounded" />
                    <div className="h-5 w-28 bg-slate-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayGames.length === 0 ? (
            <div className="py-20 text-center bg-slate-900/50 rounded-3xl border border-slate-800">
              <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white">No games found</h3>
              <p className="text-slate-400 mt-2 text-sm">
                {activeCategory === 'favorites' 
                  ? 'You haven\'t added any games to your favorites yet. Click the star on any card to add it!'
                  : 'Try adjusting your search query or selecting a different category.'}
              </p>
              <button 
                onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
                className="mt-6 px-6 py-2.5 bg-neon-mint text-deep-ocean font-bold rounded-xl hover:bg-white transition-all text-sm"
              >
                View All Games
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {displayGames.map((game: any, idx: number) => (
                <GameCard
                  key={game.id || game.slug}
                  game={game}
                  isFavorite={catalog?.favorites?.includes(game.id)}
                  onToggleFavorite={toggleFavorite}
                  priority={idx < 5} // Priority preload top visible cards
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

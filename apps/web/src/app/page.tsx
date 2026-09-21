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
  Trophy,
  History,
  Radio,
  SlidersHorizontal,
  X,
  ChevronRight
} from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';
import GameCard from '@/components/games/GameCard';
import { DEFAULT_CATALOG } from '@/lib/defaultCatalog';
import HeroBanner from '@/components/games/HeroBanner';
import { getGameArtwork, LOBBY_CATEGORIES } from '@/lib/gameArtwork';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  all: <Sparkles className="w-4 h-4" />,
  favorites: <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />,
  trending: <Flame className="w-4 h-4 text-red-500" />,
  recent: <History className="w-4 h-4 text-cyan-400" />,
  originals: <ShieldCheck className="w-4 h-4 text-neon-mint" />,
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
  live: <Radio className="w-4 h-4 text-red-500" />,
  hot: <Flame className="w-4 h-4 text-red-500" />,
  sports: <Trophy className="w-4 h-4 text-emerald-500" />
};

export default function GameHubPage() {
  const [catalog, setCatalog] = useState<{ categories: any[]; hero: any; favorites: string[] }>(DEFAULT_CATALOG);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'rtp' | 'minBet' | 'az'>('featured');
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { userId } = useWalletStore();

  // Load catalog and recently played from localStorage
  useEffect(() => {
    const headers: Record<string, string> = {};
    if (userId) headers['x-user-id'] = userId;
    fetch(getApiUrl('/api/catalog'), { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCatalog(data.data);
        }
      })
      .catch(err => console.error('Catalog fetch error:', err))
      .finally(() => setLoading(false));

    // Load recent games
    try {
      const saved = localStorage.getItem('windaq_recent_games');
      if (saved) {
        setRecentSlugs(JSON.parse(saved));
      } else {
        // Sensible defaults so section is NEVER blank
        setRecentSlugs(['aviator', 'colour-prediction', 'slots']);
      }
    } catch (e) {
      setRecentSlugs(['aviator', 'colour-prediction', 'slots']);
    }
  }, [userId]);

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

    if (!userId) {
      if (!isCurrentlyFav) {
        toast.success("Added to Favorites!");
      } else {
        toast("Removed from Favorites", { icon: '⭐' });
      }
      return;
    }

    try {
      await fetch(getApiUrl('/api/catalog/favorite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ userId, gameId, isFavorite: !isCurrentlyFav })
      });
      if (!isCurrentlyFav) {
        toast.success("Added to Favorites!");
      } else {
        toast("Removed from Favorites", { icon: '⭐' });
      }
    } catch (err) {
      // Revert on error
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

  // Providers list
  const providers = useMemo(() => {
    const list = Array.from(new Set(allGames.map(g => g.provider).filter(Boolean)));
    return ['all', ...list];
  }, [allGames]);

  // Helper map for fast lookup by slug
  const gamesBySlug = useMemo(() => {
    const map = new Map<string, any>();
    allGames.forEach(g => map.set(g.slug, g));
    return map;
  }, [allGames]);

  // 15 Curated Sections
  const trendingGames = useMemo(() => {
    const slugs = ['aviator', 'colour-prediction', 'slots', 'teen-patti', 'lightning-roulette', 'sportsbook'];
    return slugs.map(s => gamesBySlug.get(s)).filter(Boolean);
  }, [gamesBySlug]);

  const recentlyPlayedGames = useMemo(() => {
    const games = recentSlugs.map(s => gamesBySlug.get(s)).filter(Boolean);
    // Never blank rule: fallback to top 3 if empty
    return games.length > 0 ? games : trendingGames.slice(0, 3);
  }, [recentSlugs, gamesBySlug, trendingGames]);

  const favoriteGames = useMemo(() => {
    const favs = allGames.filter(g => catalog?.favorites?.includes(g.id));
    // Never blank rule: fallback to recommended favorites if user has not picked any yet
    if (favs.length > 0) return { list: favs, isUserCustom: true };
    const defaults = ['teen-patti', 'texas-holdem', 'european-roulette'].map(s => gamesBySlug.get(s)).filter(Boolean);
    return { list: defaults, isUserCustom: false };
  }, [allGames, catalog?.favorites, gamesBySlug]);

  const windaqOriginals = useMemo(() => {
    const slugs = ['aviator', 'colour-prediction', 'slots', 'scratch', 'dice', 'lotto'];
    return slugs.map(s => gamesBySlug.get(s)).filter(Boolean);
  }, [gamesBySlug]);

  const crashGames = useMemo(() => {
    return allGames.filter(g => g.slug === 'aviator' || g.type === 'CRASH');
  }, [allGames]);

  const cardGames = useMemo(() => {
    const slugs = ['teen-patti', 'texas-holdem', 'rummy', 'blackjack', 'andar-bahar', 'dragon-tiger'];
    return slugs.map(s => gamesBySlug.get(s)).filter(Boolean);
  }, [gamesBySlug]);

  const tableGames = useMemo(() => {
    const slugs = ['european-roulette', 'lightning-roulette', 'dice', 'blackjack', 'texas-holdem'];
    return slugs.map(s => gamesBySlug.get(s)).filter(Boolean);
  }, [gamesBySlug]);

  const rouletteGames = useMemo(() => {
    const slugs = ['european-roulette', 'lightning-roulette'];
    return slugs.map(s => gamesBySlug.get(s)).filter(Boolean);
  }, [gamesBySlug]);

  const slotGames = useMemo(() => {
    return allGames.filter(g => g.slug === 'slots' || g.type === 'SLOTS');
  }, [allGames]);

  const scratchGames = useMemo(() => {
    return allGames.filter(g => g.slug === 'scratch');
  }, [allGames]);

  const lottoGames = useMemo(() => {
    return allGames.filter(g => g.slug === 'lotto' || g.type === 'LOTTERY');
  }, [allGames]);

  const colourGames = useMemo(() => {
    return allGames.filter(g => g.slug === 'colour-prediction');
  }, [allGames]);

  const liveTableGames = useMemo(() => {
    const slugs = ['live-casino', 'lightning-roulette', 'andar-bahar', 'dragon-tiger'];
    return slugs.map(s => gamesBySlug.get(s)).filter(Boolean);
  }, [gamesBySlug]);

  const sportsGames = useMemo(() => {
    return allGames.filter(g => g.slug === 'sportsbook' || g.type === 'SPORTS');
  }, [allGames]);

  // Filtered Search Results Grid
  const isFiltering = activeCategory !== 'all' || searchQuery.trim() !== '' || providerFilter !== 'all';

  const filteredGames = useMemo(() => {
    let list = allGames;

    // Category Filter
    if (activeCategory === 'favorites') {
      list = favoriteGames.list;
    } else if (activeCategory !== 'all') {
      const catSlug = activeCategory;
      list = list.filter(g => {
        const slug = g.slug.toLowerCase();
        const type = (g.type || '').toUpperCase();
        switch (catSlug) {
          case 'crash': return slug === 'aviator' || type === 'CRASH';
          case 'colour': return slug === 'colour-prediction';
          case 'slots': return slug === 'slots' || type === 'SLOTS';
          case 'scratch': return slug === 'scratch';
          case 'lotto': return slug === 'lotto' || type === 'LOTTERY';
          case 'teen-patti': return slug === 'teen-patti';
          case 'poker': return slug === 'texas-holdem';
          case 'rummy': return slug === 'rummy';
          case 'roulette': return slug === 'european-roulette' || slug === 'lightning-roulette';
          case 'blackjack': return slug === 'blackjack';
          case 'andar-bahar': return slug === 'andar-bahar';
          case 'dragon-tiger': return slug === 'dragon-tiger';
          case 'dice': return slug === 'dice';
          case 'table': return ['teen-patti', 'texas-holdem', 'rummy', 'european-roulette', 'blackjack', 'andar-bahar', 'dragon-tiger', 'dice', 'lightning-roulette'].includes(slug);
          case 'hot': return ['aviator', 'colour-prediction', 'slots', 'teen-patti', 'lightning-roulette', 'sportsbook', 'live-casino'].includes(slug);
          case 'sports': return slug === 'sportsbook' || type === 'SPORTS';
          default: return true;
        }
      });
    }

    // Provider Filter
    if (providerFilter !== 'all') {
      list = list.filter(g => g.provider === providerFilter);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(g => 
        g.name.toLowerCase().includes(q) || 
        g.provider?.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q)
      );
    }

    // Sort
    const sorted = [...list];
    if (sortBy === 'rtp') {
      sorted.sort((a, b) => (b.rgInfo?.RTP || 95) - (a.rgInfo?.RTP || 95));
    } else if (sortBy === 'minBet') {
      sorted.sort((a, b) => (a.limits?.min || 1000) - (b.limits?.min || 1000));
    } else if (sortBy === 'az') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  }, [allGames, activeCategory, providerFilter, searchQuery, sortBy, favoriteGames.list]);

  const hero = catalog?.hero || allGames[0];
  const heroArtwork = hero ? getGameArtwork(hero.slug) : null;

  // Reusable Section Renderer
  const renderSection = (
    id: string,
    title: string,
    icon: React.ReactNode,
    games: any[],
    badge?: string,
    viewAllCat?: string
  ) => {
    if (!games || games.length === 0) return null;

    return (
      <section id={id} className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-neon-mint/10 border border-neon-mint/20 text-neon-mint shadow-[0_0_15px_rgba(0,255,163,0.15)]">
              {icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-2xl font-black text-white uppercase tracking-wider">
                  {title}
                </h2>
                {badge && (
                  <span className="text-[10px] font-extrabold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                    {badge}
                  </span>
                )}
              </div>
            </div>
          </div>

          {viewAllCat && (
            <button
              onClick={() => setActiveCategory(viewAllCat)}
              className="text-xs font-bold text-slate-400 hover:text-neon-mint flex items-center gap-1 transition-colors cursor-pointer group"
            >
              <span>See All ({games.length})</span>
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {/* 4:5 Game Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 md:gap-5">
          {games.map(game => (
            <GameCard
              key={`${id}-${game.id || game.slug}`}
              game={game}
              isFavorite={catalog?.favorites?.includes(game.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Hero Preload Link */}
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

      {/* Sticky Search + Category Navigation + Filter Controls */}
      <div className="sticky top-[58px] z-30 bg-deep-ocean/95 backdrop-blur-md border-b border-white/10 py-3.5 px-4 md:px-8 shadow-xl">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Top Row: Search & Advanced Filters */}
          <div className="flex flex-col md:flex-row items-center gap-3 justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search 16+ games, providers..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-neon-mint transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Provider and Sort Dropdowns */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto hide-scrollbar">
              {/* Provider Filter */}
              <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-700/70 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300">
                <SlidersHorizontal size={13} className="text-neon-mint" />
                <span className="text-slate-500">Provider:</span>
                <select 
                  value={providerFilter} 
                  onChange={e => setProviderFilter(e.target.value)}
                  className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all" className="bg-slate-900">All Providers</option>
                  {providers.filter(p => p !== 'all').map(p => (
                    <option key={p} value={p} className="bg-slate-900">{p}</option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-700/70 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300">
                <span className="text-slate-500">Sort:</span>
                <select 
                  value={sortBy} 
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
                >
                  <option value="featured" className="bg-slate-900">Featured</option>
                  <option value="rtp" className="bg-slate-900">Highest RTP</option>
                  <option value="minBet" className="bg-slate-900">Lowest Min Bet</option>
                  <option value="az" className="bg-slate-900">A to Z</option>
                </select>
              </div>

              {/* Reset Filter Pill */}
              {isFiltering && (
                <button
                  onClick={() => {
                    setActiveCategory('all');
                    setProviderFilter('all');
                    setSearchQuery('');
                    setSortBy('featured');
                  }}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold bg-red-600/80 hover:bg-red-600 text-white flex items-center gap-1 transition-all"
                >
                  <X size={12} />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: 16 Category Navigation Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 hide-scrollbar select-none">
            {LOBBY_CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.slug;
              return (
                <button 
                  key={cat.slug}
                  onClick={() => setActiveCategory(cat.slug)}
                  className={`cat-pill whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive 
                      ? 'bg-neon-mint text-deep-ocean shadow-[0_0_15px_rgba(0,255,163,0.35)] scale-105' 
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

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12">
        {/* CONDITIONAL RENDER: Filtered Results OR Full 15-Section Production Hub */}
        {isFiltering ? (
          /* Filtered Results Grid */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-neon-mint/10 border border-neon-mint/20 text-neon-mint">
                  {CATEGORY_ICONS[activeCategory] || <TrendingUp size={20} />}
                </span>
                <span>
                  {searchQuery 
                    ? `Search Results ("${searchQuery}")` 
                    : activeCategory === 'favorites' 
                      ? 'My Favorites' 
                      : LOBBY_CATEGORIES.find(c => c.slug === activeCategory)?.name || 'Filtered Games'
                  }
                </span>
                <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  {filteredGames.length} Games
                </span>
              </h2>

              <button
                onClick={() => {
                  setActiveCategory('all');
                  setProviderFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-neon-mint hover:underline cursor-pointer"
              >
                ← Back to All Hub Sections
              </button>
            </div>

            {filteredGames.length === 0 ? (
              <div className="py-20 text-center bg-slate-900/50 rounded-3xl border border-slate-800">
                <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">No games found</h3>
                <p className="text-slate-400 mt-2 text-sm">
                  Try adjusting your search query or removing filters.
                </p>
                <button 
                  onClick={() => { setActiveCategory('all'); setSearchQuery(''); setProviderFilter('all'); }}
                  className="mt-6 px-6 py-2.5 bg-neon-mint text-deep-ocean font-bold rounded-xl hover:bg-white transition-all text-sm cursor-pointer"
                >
                  View All Games
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {filteredGames.map((game: any, idx: number) => (
                  <GameCard
                    key={game.id || game.slug}
                    game={game}
                    isFavorite={catalog?.favorites?.includes(game.id)}
                    onToggleFavorite={toggleFavorite}
                    priority={idx < 5}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* FULL 15-SECTION PREMIUM PRODUCTION HUB */
          <div className="space-y-12">
            {/* 1. HERO SECTION */}
            {hero && (
              <HeroBanner hero={hero} />
            )}

            {/* 2. TRENDING */}
            {renderSection(
              'trending',
              'Trending Now',
              <Flame className="w-5 h-5 text-red-500" />,
              trendingGames,
              'Top Volume',
              'hot'
            )}

            {/* 3. RECENTLY PLAYED */}
            {renderSection(
              'recently-played',
              'Recently Played',
              <History className="w-5 h-5 text-cyan-400" />,
              recentlyPlayedGames,
              'Quick Resume'
            )}

            {/* 4. FAVORITES */}
            {renderSection(
              'favorites',
              favoriteGames.isUserCustom ? 'My Favorites' : 'Community Favorites',
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />,
              favoriteGames.list,
              favoriteGames.isUserCustom ? 'Personal' : 'Recommended',
              'favorites'
            )}

            {/* 5. WINDAQ ORIGINALS */}
            {renderSection(
              'windaq-originals',
              'WinDaq Originals',
              <ShieldCheck className="w-5 h-5 text-neon-mint" />,
              windaqOriginals,
              'Provably Fair 99%'
            )}

            {/* 6. CRASH */}
            {renderSection(
              'crash',
              'Crash Games',
              <TrendingUp className="w-5 h-5 text-rose-400" />,
              crashGames,
              'Multipliers up to 10,000x',
              'crash'
            )}

            {/* 7. CARD GAMES */}
            {renderSection(
              'card-games',
              'Card Games',
              <Crown className="w-5 h-5 text-pink-400" />,
              cardGames,
              'Classic & Modern',
              'teen-patti'
            )}

            {/* 8. TABLE GAMES */}
            {renderSection(
              'table-games',
              'Table Games',
              <LayoutGrid className="w-5 h-5 text-sky-400" />,
              tableGames,
              'VIP Saloon',
              'table'
            )}

            {/* 9. ROULETTE */}
            {renderSection(
              'roulette',
              'Roulette',
              <CircleDot className="w-5 h-5 text-rose-500" />,
              rouletteGames,
              'Single Zero & Multipliers',
              'roulette'
            )}

            {/* 10. SLOTS */}
            {renderSection(
              'slots',
              'Slots & Megaways',
              <Gamepad2 className="w-5 h-5 text-amber-400" />,
              slotGames,
              '243 Ways to Win',
              'slots'
            )}

            {/* 11. SCRATCH */}
            {renderSection(
              'scratch',
              'Instant Scratch Cards',
              <Coins className="w-5 h-5 text-amber-500" />,
              scratchGames,
              'Instant Cash',
              'scratch'
            )}

            {/* 12. LOTTO */}
            {renderSection(
              'lotto',
              'Quick Draw Lottery',
              <Ticket className="w-5 h-5 text-sky-400" />,
              lottoGames,
              'Daily ₹1 Crore Draw',
              'lotto'
            )}

            {/* 13. COLOUR */}
            {renderSection(
              'colour',
              'Colour Prediction',
              <Palette className="w-5 h-5 text-emerald-400" />,
              colourGames,
              '1-Min Rapid Rounds',
              'colour'
            )}

            {/* 14. LIVE/SIMULATED TABLES */}
            {renderSection(
              'live-tables',
              'Live & Simulated Tables',
              <Radio className="w-5 h-5 text-red-500" />,
              liveTableGames,
              'Live HD Stream'
            )}

            {/* 15. SPORTS */}
            {renderSection(
              'sports',
              'Sportsbook & Cricket',
              <Trophy className="w-5 h-5 text-emerald-500" />,
              sportsGames,
              'Live Cricket Odds',
              'sports'
            )}
          </div>
        )}
      </div>
    </div>
  );
}

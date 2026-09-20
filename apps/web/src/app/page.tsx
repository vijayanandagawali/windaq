'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, TrendingUp, Search, Star, Info } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';

export default function GameHubPage() {
  const [catalog, setCatalog] = useState<{ categories: any[]; hero: any; favorites: string[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Global wallet and modal states could be accessed if needed, keeping simple here
  const { balance, userId } = useWalletStore();
  const activeUserId = userId || 'sbx-usr-normal-001';

  useEffect(() => {
    fetch(getApiUrl('/api/catalog'), { headers: { 'x-user-id': activeUserId } })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCatalog(data.data);
        }
      })
      .catch(err => console.error(err))
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
      if (!isCurrentlyFav) toast.success("Added to Favorites!");
    } catch (err) {
      // Revert if error (simplified here)
    }
  };

  if (loading || !catalog) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-neon-mint border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Flatten all games to apply filters easily
  let allGames = catalog.categories.flatMap(c => c.games);
  
  // Deduplicate
  const seen = new Set();
  allGames = allGames.filter(g => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });

  // Apply filters
  let displayGames = allGames;

  if (activeCategory === 'favorites') {
    displayGames = displayGames.filter(g => catalog.favorites.includes(g.id));
  } else if (activeCategory !== 'all') {
    const targetCat = catalog.categories.find(c => c.slug === activeCategory);
    if (targetCat) {
      displayGames = targetCat.games;
    }
  }

  if (searchQuery.trim()) {
    displayGames = displayGames.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  const { hero } = catalog;

  return (
    <div className="space-y-8 pb-24">
      {/* Live Winners Marquee Ticker */}
      <div id="live-winners-marquee" className="bg-ocean-card/90 border-b border-neon-mint/20 py-2 px-4 overflow-hidden relative shadow-[0_0_15px_rgba(0,255,163,0.1)]">
        <div className="flex items-center gap-6 text-xs font-bold whitespace-nowrap overflow-x-auto hide-scrollbar">
          <span className="flex items-center gap-1.5 text-neon-mint font-extrabold uppercase tracking-wider bg-neon-mint/10 px-2 py-0.5 rounded-full border border-neon-mint/30">
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
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="sticky top-[58px] z-30 bg-deep-ocean/90 backdrop-blur-md border-b border-white/5 py-4 px-6 md:px-8 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search games, providers..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-full py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-neon-mint transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
          <button 
            onClick={() => setActiveCategory('all')}
            className={`cat-pill whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${activeCategory === 'all' ? 'bg-white text-deep-ocean' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            All Games
          </button>
          <button 
            onClick={() => setActiveCategory('favorites')}
            className={`cat-pill whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1 ${activeCategory === 'favorites' ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            <Star className="w-4 h-4" /> Favorites
          </button>
          {catalog.categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setActiveCategory(cat.slug)}
              className={`cat-pill whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${activeCategory === cat.slug ? 'bg-white text-deep-ocean' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 space-y-12">
        {/* HERO SECTION */}
        {hero && activeCategory === 'all' && !searchQuery && (
          <div className="banner-card relative rounded-[2.5rem] overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-deep-ocean via-deep-ocean/80 to-transparent z-10" />
            <img 
              src={hero.thumbnailUrl} 
              alt={hero.name} 
              className="w-full h-[450px] object-cover group-hover:scale-105 transition-transform duration-1000" 
            />
            
            <div className="absolute inset-0 z-20 flex flex-col justify-center p-12 md:p-16 max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                {hero.isLive && (
                  <span className="flex items-center gap-1.5 text-xs font-black bg-red-600 px-2.5 py-1 rounded-sm text-white tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
                {hero.isNew && (
                  <span className="text-xs font-black bg-neon-mint px-2.5 py-1 rounded-sm text-deep-ocean tracking-widest shadow-[0_0_15px_rgba(0,255,163,0.3)]">
                    NEW
                  </span>
                )}
                <span className="text-xs font-black bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-sm text-white tracking-widest uppercase">
                  {hero.provider}
                </span>
              </div>

              <h1 className="text-5xl md:text-7xl font-black text-white mb-6 uppercase tracking-tighter leading-[0.9]">
                {hero.name}
              </h1>
              
              <div className="flex gap-4">
                <Link href={`/games/${hero.slug}`}>
                  <button className="bg-neon-mint hover:bg-white text-deep-ocean px-8 py-4 rounded-xl font-black text-lg flex items-center gap-2 transition-all hover:scale-105 shadow-[0_0_30px_rgba(0,255,163,0.3)]">
                    <Play fill="currentColor" size={20} />
                    PLAY NOW
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* GAMES GRID */}
        <div>
          <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="text-neon-mint" /> 
            {searchQuery ? 'Search Results' : activeCategory === 'favorites' ? 'My Favorites' : activeCategory !== 'all' ? catalog.categories.find(c => c.slug === activeCategory)?.name : 'All Games'}
          </h2>
          
          {displayGames.length === 0 ? (
            <div className="py-20 text-center bg-slate-900/50 rounded-3xl border border-slate-800">
              <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white">No games found</h3>
              <p className="text-slate-500 mt-2">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
              {displayGames.map((game: any) => {
                const isFav = catalog.favorites.includes(game.id);
                return (
                  <Link 
                    href={`/games/${game.slug}`} 
                    key={game.id}
                    data-slug={game.slug}
                    className="game-card group relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 hover:border-neon-mint/50 transition-all hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(0,255,163,0.15)] block"
                  >
                    <div className="aspect-[4/5] relative overflow-hidden">
                      <img 
                        src={game.thumbnailUrl} 
                        alt={game.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100" 
                      />
                      
                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                        {game.isLive && (
                          <span className="flex items-center gap-1 text-[10px] font-black bg-red-600/90 backdrop-blur-sm px-2 py-0.5 rounded-sm text-white tracking-wider shadow-sm">
                            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                            LIVE
                          </span>
                        )}
                        {game.isNew && (
                          <span className="text-[10px] font-black bg-neon-mint/90 backdrop-blur-sm px-2 py-0.5 rounded-sm text-deep-ocean tracking-wider shadow-sm">
                            NEW
                          </span>
                        )}
                      </div>

                      {/* Favorite Toggle */}
                      <button 
                        onClick={(e) => toggleFavorite(e, game.id)}
                        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-black/60 transition-colors"
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-yellow-500 text-yellow-500' : 'text-white'}`} />
                      </button>
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-deep-ocean via-deep-ocean/50 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 scale-90 group-hover:scale-100 duration-300">
                        <div className="w-14 h-14 rounded-full bg-neon-mint flex items-center justify-center text-deep-ocean shadow-[0_0_20px_rgba(0,255,163,0.4)]">
                          <Play fill="currentColor" className="ml-1" />
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
                        <span className="text-[10px] font-bold text-neon-mint uppercase tracking-widest block mb-1">
                          {game.provider} {game.variant ? `• ${game.variant}` : ''}
                        </span>
                        <h3 className="text-white font-black text-lg leading-tight truncate">
                          {game.name}
                        </h3>
                        {game.rgInfo && (
                          <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400 font-medium">
                            <Info size={10} /> 
                            <span>Min: ₹{game.limits?.min / 100 || 10} | RTP: {game.rgInfo?.RTP || 95}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

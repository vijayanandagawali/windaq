'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Star, Sparkles, ShieldCheck, Activity } from 'lucide-react';
import { getGameArtwork, GameArtworkMetadata } from '@/lib/gameArtwork';

export interface GameCardProps {
  game: {
    id: string;
    slug: string;
    name: string;
    provider?: string;
    variant?: string;
    thumbnailUrl?: string;
    isLive?: boolean;
    isNew?: boolean;
    minStake?: number;
    limits?: { min: number; max: number };
    rgInfo?: { RTP: number; volatility: string };
  };
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent, gameId: string) => void;
  priority?: boolean;
  compact?: boolean;
}

export default function GameCard({
  game,
  isFavorite = false,
  onToggleFavorite,
  priority = false,
  compact = false
}: GameCardProps) {
  const artwork: GameArtworkMetadata = getGameArtwork(game.slug);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Use local original artwork if thumbnailUrl is an external url or empty, or on error
  const initialSrc = (!game.thumbnailUrl || game.thumbnailUrl.includes('unsplash.com'))
    ? artwork.cardImage
    : game.thumbnailUrl;

  const [currentSrc, setCurrentSrc] = useState(initialSrc);

  const handleImageError = () => {
    setHasError(true);
    setCurrentSrc(artwork.fallbackImage);
  };

  const minBetDisplay = game.minStake 
    ? `₹${game.minStake}` 
    : (game.limits?.min ? `₹${game.limits.min / 100}` : artwork.minBet);

  return (
    <div
      className="game-card group relative rounded-2xl overflow-hidden bg-slate-900/95 border border-slate-800/80 hover:border-neon-mint/60 transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] flex flex-col justify-between select-none shadow-lg hover:shadow-2xl"
      style={{
        ['--theme-glow' as any]: artwork.themeColor
      }}
    >
      {/* 1. IMAGE CONTAINER (4:5 Aspect Ratio) */}
      <Link href={`/games/${game.slug}`} data-slug={game.slug} data-testid={`game-card-${game.slug}`} className="block relative aspect-[4/5] overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
        {/* Loading Skeleton */}
        {!imageLoaded && (
          <div className="absolute inset-0 z-10 bg-slate-800/90 animate-pulse flex flex-col justify-between p-4">
            <div className="flex justify-between items-center">
              <div className="h-4 w-16 bg-slate-700 rounded-md" />
              <div className="h-6 w-6 bg-slate-700 rounded-full" />
            </div>
            <div className="w-12 h-12 rounded-full bg-slate-700 mx-auto" />
            <div className="space-y-2">
              <div className="h-3 w-20 bg-slate-700 rounded" />
              <div className="h-4 w-32 bg-slate-700 rounded" />
            </div>
          </div>
        )}

        {/* Responsive Image */}
        <picture>
          <source media="(max-width: 640px)" srcSet={artwork.mobileImage} />
          <img
            src={currentSrc}
            alt={game.name || artwork.name}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={handleImageError}
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out ${
              imageLoaded ? 'opacity-95 group-hover:opacity-100' : 'opacity-0'
            }`}
          />
        </picture>

        {/* Shimmer Light Reflection Sweep */}
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none z-15 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* 2. BADGE BAR (Top-Left) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20 pointer-events-none">
          {game.isLive ? (
            <span className="flex items-center gap-1.5 text-[10px] font-black bg-red-600/95 backdrop-blur-md px-2.5 py-0.5 rounded-md text-white tracking-widest shadow-md">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE
            </span>
          ) : null}
          {game.isNew ? (
            <span className="text-[10px] font-black bg-neon-mint/95 backdrop-blur-md px-2.5 py-0.5 rounded-md text-deep-ocean tracking-widest shadow-md">
              NEW
            </span>
          ) : null}
          <span 
            className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md backdrop-blur-md text-white border border-white/15 shadow-sm"
            style={{ backgroundColor: `${artwork.themeColor}33` }}
          >
            {artwork.tag}
          </span>
        </div>

        {/* 7. FAVORITE BUTTON (Top-Right) */}
        {onToggleFavorite && (
          <button
            type="button"
            aria-label="Toggle Favorite"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(e, game.id);
            }}
            className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center hover:bg-black/90 hover:scale-110 transition-all text-white border border-white/15 cursor-pointer shadow-md"
          >
            <Star
              className={`w-4 h-4 transition-colors ${
                isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 hover:text-white'
              }`}
            />
          </button>
        )}

        {/* Dark Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-deep-ocean via-deep-ocean/50 to-transparent opacity-70 group-hover:opacity-85 transition-opacity z-10" />

        {/* 8. PLAY BUTTON (Center Hover Zoom) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-25 scale-75 group-hover:scale-100 pointer-events-none">
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center text-deep-ocean shadow-2xl transition-transform duration-300 group-hover:scale-110"
            style={{
              backgroundColor: artwork.themeColor,
              boxShadow: `0 0 30px ${artwork.themeColor}88`
            }}
          >
            <Play fill="currentColor" size={24} className="ml-1" />
          </div>
        </div>
      </Link>

      {/* CARD DETAILS FOOTER: title → provider/type → min bet → status → Play */}
      <div className="p-2.5 sm:p-3.5 bg-slate-900/90 border-t border-white/5 flex flex-col justify-between flex-1">
        <div>
          {/* 4. PROVIDER / TYPE */}
          <div className="flex items-center justify-between gap-1 mb-0.5 sm:mb-1">
            <span 
              className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider truncate"
              style={{ color: artwork.themeColor }}
            >
              {game.provider || artwork.provider} • {game.variant || artwork.variant}
            </span>
          </div>

          {/* 3. TITLE */}
          <Link href={`/games/${game.slug}`}>
            <h3 className="text-white font-black text-xs sm:text-sm md:text-base leading-tight truncate group-hover:text-neon-mint transition-colors">
              {game.name || artwork.name}
            </h3>
          </Link>
        </div>

        {/* 5. MIN BET & 6. STATUS */}
        <div className="mt-2 sm:mt-3 pt-1.5 sm:pt-2 border-t border-white/10 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-semibold flex-wrap">
          {/* Min Bet */}
          <div className="flex items-center gap-1 text-slate-300 shrink-0">
            <span className="text-slate-500 font-medium">Min:</span>
            <span className="text-white font-bold">{minBetDisplay}</span>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-1 shrink-0">
            {game.isLive ? (
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-extrabold text-red-400 bg-red-950/60 px-1.5 sm:px-2 py-0.5 rounded border border-red-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-extrabold text-emerald-400 bg-emerald-950/60 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Online
              </span>
            )}
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 bg-black/40 px-1 sm:px-1.5 py-0.5 rounded">
              {artwork.rtp}
            </span>
          </div>
        </div>

        {/* 8. QUICK PLAY ACTION BUTTON */}
        <Link href={`/games/${game.slug}`} className="mt-2 sm:mt-2.5 block">
          <button 
            type="button"
            className="w-full py-2 sm:py-1.5 min-h-[36px] rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer text-deep-ocean shadow-md hover:brightness-110 active:scale-98"
            style={{ backgroundColor: artwork.themeColor }}
          >
            <Play fill="currentColor" size={13} className="ml-0.5" />
            <span>PLAY NOW</span>
          </button>
        </Link>
      </div>
    </div>
  );
}

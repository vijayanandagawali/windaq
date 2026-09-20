'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Star, Info, Sparkles } from 'lucide-react';
import { getGameArtwork, GameArtworkMetadata } from '@/lib/gameArtwork';

interface GameCardProps {
  game: {
    id: string;
    slug: string;
    name: string;
    provider?: string;
    variant?: string;
    thumbnailUrl?: string;
    isLive?: boolean;
    isNew?: boolean;
    limits?: { min: number; max: number };
    rgInfo?: { RTP: number; volatility: string };
  };
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent, gameId: string) => void;
  priority?: boolean;
}

export default function GameCard({
  game,
  isFavorite = false,
  onToggleFavorite,
  priority = false
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
    // Immediately fall back to bulletproof embedded SVG data URI
    setCurrentSrc(artwork.fallbackImage);
  };

  return (
    <Link
      href={`/games/${game.slug}`}
      data-slug={game.slug}
      className="game-card group relative rounded-2xl overflow-hidden bg-slate-900/90 border border-slate-800/80 hover:border-neon-mint/60 transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] block select-none"
      style={{
        // Dynamic glow on hover using the game's theme color
        ['--theme-glow' as any]: artwork.themeColor
      }}
    >
      {/* 4:5 Aspect Ratio Container */}
      <div className="aspect-[4/5] relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
        
        {/* Loading Skeleton */}
        {!imageLoaded && (
          <div className="absolute inset-0 z-10 bg-slate-800/80 animate-pulse flex flex-col justify-between p-4">
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

        {/* Responsive Artwork Image */}
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

        {/* Light Shimmer Sweep on Hover */}
        <div 
          className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none z-15 bg-gradient-to-r from-transparent via-white/10 to-transparent" 
        />

        {/* Top Badges Bar */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
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
            className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md backdrop-blur-md text-white border border-white/10 shadow-sm"
            style={{ backgroundColor: `${artwork.themeColor}33` }}
          >
            {artwork.tag}
          </span>
        </div>

        {/* Favorite Button */}
        {onToggleFavorite && (
          <button
            type="button"
            aria-label="Toggle Favorite"
            onClick={(e) => onToggleFavorite(e, game.id)}
            className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-black/80 hover:scale-110 transition-all text-white border border-white/10"
          >
            <Star
              className={`w-4 h-4 transition-colors ${
                isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 hover:text-white'
              }`}
            />
          </button>
        )}

        {/* Dynamic Dark Gradient Backdrop for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-deep-ocean via-deep-ocean/50 to-transparent opacity-75 group-hover:opacity-85 transition-opacity z-10" />

        {/* Center Hover Play Button with Pulsing Glow */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-25 scale-75 group-hover:scale-100">
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

        {/* Bottom Card Footer Details */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5 z-20">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span 
              className="text-[10px] font-black uppercase tracking-wider truncate"
              style={{ color: artwork.themeColor }}
            >
              {game.provider || artwork.provider}
            </span>
            <span className="text-[10px] font-bold text-slate-400 bg-black/40 px-1.5 py-0.5 rounded">
              {artwork.rtp}
            </span>
          </div>

          <h3 className="text-white font-black text-base md:text-lg leading-tight truncate group-hover:text-neon-mint transition-colors">
            {game.name || artwork.name}
          </h3>

          {/* Min Bet and Max Multiplier Specs */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-300 font-semibold">
            <span className="flex items-center gap-1">
              <span className="text-slate-500">Min:</span>
              <span className="text-white">{artwork.minBet}</span>
            </span>
            <span className="flex items-center gap-1 text-neon-mint">
              <Sparkles size={11} />
              <span>{artwork.maxPayout}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

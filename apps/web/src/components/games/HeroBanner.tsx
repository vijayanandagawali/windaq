'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { Play, Sparkles, Flame, Shield, ArrowRight } from 'lucide-react';
import { getGameArtwork, GameArtworkMetadata } from '@/lib/gameArtwork';

interface HeroBannerProps {
  hero: {
    id: string;
    slug: string;
    name: string;
    provider?: string;
    variant?: string;
    thumbnailUrl?: string;
    isLive?: boolean;
    isNew?: boolean;
    minStake?: number;
    rules?: any;
    limits?: { min: number; max: number };
    rgInfo?: { RTP: number; volatility: string };
  };
}

export default function HeroBanner({ hero }: HeroBannerProps) {
  const artwork: GameArtworkMetadata = getGameArtwork(hero.slug);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Initial source prioritizes local 16:9 hero image
  const initialSrc = (!hero.thumbnailUrl || hero.thumbnailUrl.includes('unsplash.com'))
    ? artwork.heroImage
    : hero.thumbnailUrl;

  const [currentSrc, setCurrentSrc] = useState(initialSrc);

  const handleImageError = () => {
    setHasError(true);
    setCurrentSrc(artwork.fallbackImage);
  };

  return (
    <div className="relative rounded-[2rem] md:rounded-[2.5rem] overflow-hidden group border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      {/* 16:9 Aspect Ratio Container */}
      <div className="relative aspect-[16/9] min-h-[380px] md:min-h-[460px] w-full overflow-hidden bg-slate-950">
        
        {/* Loading Skeleton */}
        {!imageLoaded && (
          <div className="absolute inset-0 z-10 bg-slate-900 animate-pulse flex flex-col justify-center p-12">
            <div className="h-6 w-36 bg-slate-800 rounded-full mb-6" />
            <div className="h-14 w-96 bg-slate-800 rounded-2xl mb-4" />
            <div className="h-6 w-64 bg-slate-800 rounded-lg mb-8" />
            <div className="h-14 w-48 bg-slate-800 rounded-xl" />
          </div>
        )}

        {/* 16:9 Hero Image with Preload Hint */}
        <picture>
          <source media="(max-width: 640px)" srcSet={artwork.mobileImage} />
          <img
            src={currentSrc}
            alt={hero.name || artwork.name}
            loading="eager"
            fetchPriority="high"
            decoding="sync"
            onLoad={() => setImageLoaded(true)}
            onError={handleImageError}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out ${
              imageLoaded ? 'opacity-90 group-hover:opacity-100' : 'opacity-0'
            }`}
          />
        </picture>

        {/* Gradient overlays for cinematic depth and contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-deep-ocean via-deep-ocean/85 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-deep-ocean via-transparent to-black/30 z-10 pointer-events-none" />

        {/* Hero Content Overlay */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center p-8 md:p-14 max-w-2xl">
          {/* Top Badges */}
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            {hero.isLive && (
              <span className="flex items-center gap-1.5 text-xs font-black bg-red-600 px-3 py-1 rounded-full text-white tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.6)]">
                <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                LIVE
              </span>
            )}
            {hero.isNew && (
              <span className="text-xs font-black bg-neon-mint px-3 py-1 rounded-full text-deep-ocean tracking-widest shadow-[0_0_15px_rgba(0,255,163,0.4)]">
                NEW RELEASE
              </span>
            )}
            <span 
              className="text-xs font-black px-3 py-1 rounded-full text-white tracking-widest uppercase border border-white/20 backdrop-blur-md"
              style={{ backgroundColor: `${artwork.themeColor}33` }}
            >
              {artwork.badge}
            </span>
            <span className="text-xs font-bold text-slate-300 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">
              {hero.provider || artwork.provider}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 uppercase tracking-tighter leading-[0.92] drop-shadow-lg">
            {hero.name || artwork.name}
          </h1>

          {/* Subtitle / Specs */}
          <p className="text-slate-300 text-sm md:text-base font-medium mb-6 max-w-lg drop-shadow">
            Experience real-time Provably Fair gaming with certified random number generation, instant payouts, and high RTP.
          </p>

          {/* Quick Specs Pill Row */}
          <div className="flex items-center gap-4 mb-8 text-xs font-bold text-slate-300">
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
              <span className="text-slate-500">RTP:</span>
              <span className="text-neon-mint font-extrabold">{artwork.rtp}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
              <span className="text-slate-500">MIN BET:</span>
              <span className="text-white font-extrabold">{artwork.minBet}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-yellow-400 font-extrabold">{artwork.maxPayout}</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-4">
            <Link href={`/games/${hero.slug}`}>
              <button 
                type="button"
                className="bg-neon-mint hover:bg-white text-deep-ocean px-8 py-4 rounded-xl font-black text-lg flex items-center gap-2.5 transition-all hover:scale-105 shadow-[0_0_30px_rgba(0,255,163,0.4)] cursor-pointer"
              >
                <Play fill="currentColor" size={20} />
                PLAY NOW
              </button>
            </Link>
            <Link href={`/fairness`}>
              <button 
                type="button"
                className="bg-slate-900/80 hover:bg-slate-800 text-white px-6 py-4 rounded-xl font-bold text-sm flex items-center gap-2 border border-slate-700 backdrop-blur-md transition-all hover:scale-105"
              >
                <Shield size={16} className="text-neon-mint" />
                PROVABLY FAIR
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

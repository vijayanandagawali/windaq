import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Heart, Play, ShieldAlert, Wrench } from 'lucide-react';

export interface GameCardProps {
  id: string;
  title: string;
  provider?: string;
  image: string;
  href: string;
  state?: 'default' | 'loading' | 'maintenance' | 'disabled' | 'blocked';
  badges?: ('hot' | 'new' | 'live')[];
  isFavorite?: boolean;
  onFavoriteToggle?: (id: string) => void;
  width?: string; // allow overrides, e.g., 'w-32' or 'w-full'
}

export default function GameCard({
  id,
  title,
  provider = 'WinDaq Original',
  image,
  href,
  state = 'default',
  badges = [],
  isFavorite = false,
  onFavoriteToggle,
  width = 'w-32 md:w-40' // Mobile-first sizing
}: GameCardProps) {
  
  const [isHovered, setIsHovered] = useState(false);
  const isPlayable = state === 'default' || state === 'loading';

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onFavoriteToggle) onFavoriteToggle(id);
  };

  // Skeleton / Loading State
  if (state === 'loading') {
    return (
      <div className={`${width} aspect-[3/4] rounded-xl bg-ocean-card/50 border border-white/5 overflow-hidden relative flex flex-col animate-pulse`}>
        <div className="flex-1 bg-white/5" />
        <div className="h-12 bg-black/40 p-2">
           <div className="h-3 w-3/4 bg-white/10 rounded mb-1" />
           <div className="h-2 w-1/2 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  return (
    <Link href={isPlayable ? href : '#'}>
      <motion.div
        whileTap={isPlayable ? { scale: 0.96 } : {}}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className={`${width} aspect-[3/4] relative rounded-xl overflow-hidden group border border-white/10 bg-ocean-card cursor-pointer transition-all duration-300 ${!isPlayable ? 'opacity-70 grayscale-[50%]' : 'hover:border-neon-mint/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]'}`}
      >
        {/* Background Image */}
        <div className="absolute inset-0 bg-deep-ocean">
          <Image 
            src={image} 
            alt={title} 
            fill 
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 768px) 128px, 160px"
            loading="lazy"
          />
        </div>

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

        {/* Top Badges Area */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-1">
            {badges.includes('live') && (
              <span className="bg-red-600 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1 shadow-lg backdrop-blur">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> Live
              </span>
            )}
            {badges.includes('hot') && (
              <span className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-lg backdrop-blur">
                Hot
              </span>
            )}
            {badges.includes('new') && (
              <span className="bg-neon-mint text-deep-ocean text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-lg backdrop-blur">
                New
              </span>
            )}
          </div>
          
          <button 
            onClick={handleFavorite} 
            className="pointer-events-auto p-1.5 rounded-full bg-black/40 backdrop-blur hover:bg-black/60 transition-colors"
          >
            <Heart size={14} className={isFavorite ? 'fill-pink-500 text-pink-500' : 'text-white'} />
          </button>
        </div>

        {/* Bottom Text Area */}
        <div className="absolute bottom-0 left-0 right-0 p-2 transform transition-transform duration-300">
          <h3 className="text-white font-bold text-xs truncate drop-shadow-md">{title}</h3>
          <p className="text-gray-400 text-[9px] font-semibold uppercase tracking-wider truncate">{provider}</p>
        </div>

        {/* Hover / Status Overlays */}
        <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300 ${isHovered && isPlayable ? 'opacity-100' : 'opacity-0'}`}>
          {state === 'default' && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={isHovered ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-12 h-12 bg-neon-mint rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,255,163,0.5)]"
            >
              <Play size={20} className="text-deep-ocean ml-1" />
            </motion.div>
          )}
        </div>

        {/* Non-Playable State Overlays */}
        {state === 'maintenance' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Wrench size={24} className="text-gray-400 mb-2" />
            <span className="text-[10px] font-bold text-white uppercase tracking-widest text-center px-2">Maintenance</span>
          </div>
        )}
        {state === 'blocked' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <ShieldAlert size={24} className="text-red-500 mb-2" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest text-center px-2">Limit Reached</span>
          </div>
        )}

      </motion.div>
    </Link>
  );
}

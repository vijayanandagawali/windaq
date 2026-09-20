import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Heart, Play, Users } from 'lucide-react';

export interface LiveCardProps {
  id: string;
  title: string;
  dealer: string;
  players?: number;
  image: string;
  href: string;
  isFavorite?: boolean;
  onFavoriteToggle?: (id: string) => void;
  width?: string;
}

export default function LiveCard({
  id,
  title,
  dealer,
  players,
  image,
  href,
  isFavorite = false,
  onFavoriteToggle,
  width = 'w-64 md:w-72' // Landscape layout
}: LiveCardProps) {
  
  const [isHovered, setIsHovered] = useState(false);

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onFavoriteToggle) onFavoriteToggle(id);
  };

  return (
    <Link href={href}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className={`${width} aspect-[16/9] relative rounded-xl overflow-hidden group border border-white/10 bg-ocean-card cursor-pointer hover:border-neon-mint/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-300`}
      >
        {/* Background Image */}
        <div className="absolute inset-0 bg-deep-ocean">
          <Image 
            src={image} 
            alt={title} 
            fill 
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 256px, 288px"
            loading="lazy"
          />
        </div>

        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 pointer-events-none" />
        
        {/* Top Header */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
          <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded flex items-center gap-1.5 shadow-lg backdrop-blur">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> LIVE
          </div>
          
          <button 
            onClick={handleFavorite} 
            className="pointer-events-auto p-2 rounded-full bg-black/40 backdrop-blur hover:bg-black/60 transition-colors"
          >
            <Heart size={16} className={isFavorite ? 'fill-pink-500 text-pink-500' : 'text-white'} />
          </button>
        </div>

        {/* Bottom Details */}
        <div className="absolute bottom-0 left-0 right-0 p-3 transform transition-transform duration-300 flex justify-between items-end">
          <div>
            <h3 className="text-white font-black text-sm md:text-base drop-shadow-md mb-0.5">{title}</h3>
            <p className="text-neon-mint text-[10px] font-bold uppercase tracking-wider">{dealer}</p>
          </div>
          
          {players !== undefined && (
            <div className="flex items-center gap-1 text-gray-300 bg-black/40 px-2 py-1 rounded backdrop-blur text-[10px] font-bold">
              <Users size={12} /> {players}
            </div>
          )}
        </div>

        {/* Hover Play Button Overlay */}
        <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={isHovered ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-14 h-14 bg-neon-mint rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(0,255,163,0.6)]"
          >
            <Play size={24} className="text-deep-ocean ml-1" />
          </motion.div>
        </div>
      </motion.div>
    </Link>
  );
}

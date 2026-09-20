import React from 'react';
import { motion } from 'framer-motion';

export interface CategoryChipProps {
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export default function CategoryChip({ label, isActive = false, onClick, icon }: CategoryChipProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap border
        transition-colors duration-300
        ${isActive 
          ? 'bg-neon-mint text-deep-ocean border-neon-mint shadow-[0_0_15px_rgba(0,255,163,0.3)]' 
          : 'bg-ocean-card/60 text-white border-white/10 hover:bg-white/10 hover:border-white/20'
        }
      `}
    >
      {icon && <span className={isActive ? "text-deep-ocean" : "text-gray-400"}>{icon}</span>}
      {label}
    </motion.button>
  );
}

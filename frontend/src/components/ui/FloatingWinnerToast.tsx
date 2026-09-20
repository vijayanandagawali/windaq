"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';

const WINNERS = [
  { name: 'Ravi K.', city: 'Delhi', game: 'Aviator', amount: '₹18,450', mult: '18.45x' },
  { name: 'Pooja S.', city: 'Mumbai', game: 'Dragon vs Tiger', amount: '₹30,000', mult: '2.0x' },
  { name: 'Amit K.', city: 'Jaipur', game: '777 Slots', amount: '₹88,200', mult: '77.7x' },
  { name: 'Sunil G.', city: 'Patna', game: 'Color Trading', amount: '₹9,800', mult: '9.8x' },
  { name: 'Vikram R.', city: 'Bangalore', game: 'Aviator', amount: '₹24,500', mult: '24.5x' },
  { name: 'Deepak M.', city: 'Lucknow', game: 'Live Roulette', amount: '₹36,000', mult: '36x' },
];

export default function FloatingWinnerToast() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % WINNERS.length);
        setVisible(true);
      }, 400);
    }, 5500);

    return () => clearInterval(interval);
  }, []);

  const winner = WINNERS[index];

  return (
    <div className="fixed bottom-20 left-4 z-40 pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="bg-[#0e1424]/95 backdrop-blur-md border border-neon-mint/30 rounded-full py-1.5 pl-2 pr-3.5 flex items-center gap-2 shadow-[0_8px_25px_rgba(0,0,0,0.7)]"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-600 flex items-center justify-center text-deep-ocean shadow-[0_0_10px_rgba(234,179,8,0.5)]">
              <Trophy size={13} strokeWidth={2.5} />
            </div>
            <div className="text-[11px] leading-tight">
              <span className="font-bold text-gray-200">{winner.name} ({winner.city}) won </span>
              <span className="font-black text-neon-mint">{winner.amount}</span>
              <span className="text-gray-400 text-[10px]"> on {winner.game}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

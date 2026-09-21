'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

export interface SimulatedOpponentProps {
  botId: string;
  displayName: string;
  seatIndex: number;
  status?: string;
  activeBet?: {
    market: string;
    amount: number;
  } | null;
}

export const SimulatedOpponentBadge: React.FC<SimulatedOpponentProps> = ({
  botId,
  displayName,
  seatIndex,
  status = 'SEATED',
  activeBet
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 bg-zinc-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 shadow-md backdrop-blur-sm"
      data-testid={`simulated-bot-seat-${seatIndex}`}
      data-seat={seatIndex}
    >
      <span data-testid="simulated-opponent-badge" className="sr-only">simulated-opponent-badge</span>
      {/* Bot Icon with AI Badge */}
      <div className="relative">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-950 to-zinc-900 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
          <Bot size={14} />
        </div>
        <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-[8px] font-black px-1 rounded text-white uppercase tracking-tighter">
          AI
        </span>
      </div>

      {/* Seat & Bot Info */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-zinc-200 truncate max-w-[80px]">
            {displayName}
          </span>
          <span className="text-[9px] text-zinc-500">#{seatIndex}</span>
        </div>

        {/* Clear Non-Human Status */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider">
            [SIMULATED BOT]
          </span>
          {activeBet && (
            <span className="text-[9px] font-mono text-amber-400">
              {activeBet.market}: ₹{activeBet.amount}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

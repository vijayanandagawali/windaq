"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowDownLeft, ArrowUpRight, Trophy, Gamepad2, Gift } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';

export default function PassbookModal() {
  const { isPassbookOpen, setPassbookOpen, transactions } = useWalletStore();
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAW' | 'BET' | 'WIN'>('ALL');

  if (!isPassbookOpen) return null;

  const filteredTxs = transactions.filter(t => {
    if (activeFilter === 'ALL') return true;
    return t.type === activeFilter;
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setPassbookOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-sm bg-gradient-to-b from-[#131a2e] via-[#0f1422] to-[#0a0d16] border border-blue-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(59,130,246,0.25)] text-left flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📜</span>
              <h3 className="text-white font-black text-base tracking-wide">PASSBOOK & STATEMENTS</h3>
            </div>
            <button 
              onClick={() => setPassbookOpen(false)}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 border-b border-white/5 scrollbar-none">
            {(['ALL', 'DEPOSIT', 'WITHDRAW', 'BET', 'WIN'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wide whitespace-nowrap transition-all ${
                  activeFilter === tab
                    ? 'bg-neon-mint text-deep-ocean shadow-[0_0_10px_rgba(0,255,163,0.4)]'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Transactions List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredTxs.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-xs">
                No transactions in this category.
              </div>
            ) : (
              filteredTxs.map(tx => {
                const isPos = tx.amount > 0;
                return (
                  <div 
                    key={tx.id}
                    className="bg-ocean-card/90 border border-white/5 rounded-2xl p-3 flex items-center justify-between hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        tx.type === 'DEPOSIT' ? 'bg-emerald-500/20 text-emerald-400' :
                        tx.type === 'WITHDRAW' ? 'bg-red-500/20 text-red-400' :
                        tx.type === 'WIN' ? 'bg-yellow-500/20 text-yellow-400' :
                        tx.type === 'SPIN' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {tx.type === 'DEPOSIT' && <ArrowDownLeft size={16} />}
                        {tx.type === 'WITHDRAW' && <ArrowUpRight size={16} />}
                        {tx.type === 'WIN' && <Trophy size={16} />}
                        {tx.type === 'SPIN' && <Gift size={16} />}
                        {tx.type === 'BET' && <Gamepad2 size={16} />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white line-clamp-1">{tx.description}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{tx.date}</div>
                        {tx.utr && <div className="text-[9px] text-neon-mint font-mono mt-0.5">{tx.utr}</div>}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-black ${isPos ? 'text-neon-mint' : 'text-red-400'}`}>
                        {isPos ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <span className="inline-block mt-0.5 bg-green-500/10 text-green-400 text-[8px] font-black px-1.5 py-0.2 rounded border border-green-500/20">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => setPassbookOpen(false)}
            className="w-full mt-3 py-2.5 rounded-xl bg-white/5 text-gray-300 font-bold text-xs hover:bg-white/10 transition-colors"
          >
            CLOSE
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

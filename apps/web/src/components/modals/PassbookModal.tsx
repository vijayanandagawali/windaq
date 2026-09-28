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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-sm bg-gradient-to-b from-white via-white to-slate-50 border border-blue-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(59,130,246,0.25)] text-left flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📜</span>
              <h3 className="text-slate-900 font-black text-base tracking-wide">PASSBOOK & STATEMENTS</h3>
            </div>
            <button 
              onClick={() => setPassbookOpen(false)}
              className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900"
            >
              <X size={18} />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 border-b border-slate-200 scrollbar-none">
            {(['ALL', 'DEPOSIT', 'WITHDRAW', 'BET', 'WIN'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wide whitespace-nowrap transition-all ${
                  activeFilter === tab
                    ? 'bg-neon-mint text-deep-ocean shadow-[0_0_10px_rgba(0,255,163,0.4)]'
                    : 'bg-slate-50 text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Transactions List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredTxs.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No transactions in this category.
              </div>
            ) : (
              filteredTxs.map(tx => {
                const isPos = tx.amount > 0;
                return (
                  <div 
                    key={tx.id}
                    className="bg-white/90 border border-slate-200 rounded-2xl p-3 flex items-center justify-between hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        tx.type === 'DEPOSIT' ? 'bg-emerald-500/20 text-emerald-600' :
                        tx.type === 'WITHDRAW' ? 'bg-red-500/20 text-red-600' :
                        tx.type === 'WIN' ? 'bg-yellow-500/20 text-yellow-600' :
                        tx.type === 'SPIN' ? 'bg-purple-500/20 text-purple-600' :
                        'bg-blue-500/20 text-blue-600'
                      }`}>
                        {tx.type === 'DEPOSIT' && <ArrowDownLeft size={16} />}
                        {tx.type === 'WITHDRAW' && <ArrowUpRight size={16} />}
                        {tx.type === 'WIN' && <Trophy size={16} />}
                        {tx.type === 'SPIN' && <Gift size={16} />}
                        {tx.type === 'BET' && <Gamepad2 size={16} />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 line-clamp-1">{tx.description}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{tx.date}</div>
                        {tx.utr && <div className="text-[9px] text-neon-mint font-mono mt-0.5">{tx.utr}</div>}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-black ${isPos ? 'text-neon-mint' : 'text-red-600'}`}>
                        {isPos ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <span className="inline-block mt-0.5 bg-green-500/10 text-green-600 text-[8px] font-black px-1.5 py-0.2 rounded border border-green-500/20">
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
            className="w-full mt-3 py-2.5 rounded-xl bg-slate-50 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors"
          >
            CLOSE
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

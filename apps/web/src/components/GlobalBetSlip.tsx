"use client";

import React, { useState } from 'react';
import { useBetSlipStore } from '@/store/betSlipStore';
import { useWalletStore } from '@/store/walletStore';
import { X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/config';

export default function GlobalBetSlip() {
  const { 
    selection, stake, isOpen, status, errorMessage, 
    setStake, close, clearSelection, setStatus 
  } = useBetSlipStore();
  
  const { balance, fetchBalance, userId } = useWalletStore();

  if (!isOpen || !selection) return null;

  const handlePlaceBet = async () => {
    if (balance < stake * 100) {
      setStatus('ERROR', 'Insufficient balance');
      return;
    }

    setStatus('LOADING');
    
    try {
      const activeUserId = userId || (typeof window !== 'undefined' ? (localStorage.getItem('windaq_user_id') || 'sbx-usr-normal-001') : 'sbx-usr-normal-001');
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      const res = await fetch(getApiUrl('/api/wager/place'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-user-id': activeUserId
        },
        body: JSON.stringify({
          userId: activeUserId,
          gameType: selection.gameType,
          referenceId: selection.referenceId,
          market: selection.market,
          selection: selection.selection,
          type: selection.type,
          stake: stake, // in INR
          odds: selection.odds
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setStatus('SUCCESS');
        fetchBalance();
        setTimeout(() => clearSelection(), 3000);
      } else {
        setStatus('ERROR', data.message || 'Bet rejected');
      }
    } catch (e) {
      setStatus('ERROR', 'Network error. Try again.');
    }
  };

  const isBack = selection.type === 'BACK';
  const color = isBack ? 'blue' : 'pink';

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }}
        className={`fixed bottom-0 left-0 right-0 md:left-auto md:right-4 md:bottom-4 md:w-96 z-50 rounded-t-3xl md:rounded-3xl border shadow-[0_-10px_30px_rgba(0,0,0,0.8)] md:shadow-2xl overflow-hidden
          ${isBack ? 'bg-[#0f172a] border-blue-500/30' : 'bg-[#1e1115] border-pink-500/30'}
        `}
      >
        {/* Header */}
        <div className={`p-3 flex justify-between items-center border-b ${isBack ? 'border-blue-500/20 bg-blue-900/20' : 'border-pink-500/20 bg-pink-900/20'}`}>
          <h3 className="text-white font-bold tracking-widest text-sm uppercase">Bet Slip</h3>
          <button onClick={close} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {status === 'SUCCESS' ? (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
            <CheckCircle size={48} className="text-green-500" />
            <h4 className="text-white font-black text-xl uppercase tracking-widest">Bet Placed!</h4>
            <p className="text-gray-400 text-sm">Your wager has been confirmed and locked.</p>
          </div>
        ) : (
          <div className="p-4">
            {/* Error Banner */}
            {status === 'ERROR' && (
              <div className="mb-4 bg-red-900/50 border border-red-500/50 rounded p-2 flex items-start gap-2 text-red-200 text-xs">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Selection Info */}
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h4 className="text-white font-black uppercase text-sm mb-1">{selection.market}</h4>
                  <p className="text-gray-400 text-xs font-bold">{selection.type} - {selection.selection}</p>
               </div>
               <div className="text-right">
                  <span className={`font-black text-2xl text-${color}-400`}>{selection.odds.toFixed(2)}</span>
               </div>
            </div>

            {/* Stake Input */}
            <div className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/5 mb-4">
               <button onClick={() => setStake(Math.max(100, stake - 100))} className="w-10 h-10 rounded bg-white/5 text-white font-bold hover:bg-white/10">-</button>
               <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Stake</span>
                  <input 
                    type="number" 
                    value={stake} 
                    onChange={e => setStake(Number(e.target.value))}
                    disabled={status === 'LOADING'}
                    className="w-24 bg-transparent text-white font-black text-xl text-center focus:outline-none disabled:opacity-50" 
                  />
               </div>
               <button onClick={() => setStake(stake + 100)} className="w-10 h-10 rounded bg-white/5 text-white font-bold hover:bg-white/10">+</button>
            </div>

            {/* Quick Stakes */}
            <div className="flex gap-2 mb-4">
              {[100, 500, 1000, 5000].map(amt => (
                <button 
                  key={amt} 
                  onClick={() => setStake(amt)}
                  disabled={status === 'LOADING'}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-2 rounded transition-colors disabled:opacity-50"
                >
                  +{amt}
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="flex justify-between items-center mb-4 px-2">
               <span className="text-gray-400 text-xs font-bold uppercase">Potential Return</span>
               <span className="text-green-400 font-black text-lg">₹{(stake * selection.odds).toFixed(2)}</span>
            </div>

            {/* Action */}
            <button 
              onClick={handlePlaceBet}
              disabled={status === 'LOADING' || stake < 10}
              className={`w-full py-4 rounded-xl font-black text-white uppercase text-sm tracking-widest shadow-lg flex justify-center items-center gap-2
                ${isBack ? 'bg-blue-600 hover:bg-blue-500' : 'bg-pink-600 hover:bg-pink-500'}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {status === 'LOADING' ? <Loader2 className="animate-spin" size={18} /> : 'Place Wager'}
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

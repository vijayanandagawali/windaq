"use client";

import React, { useState, useEffect } from 'react';
import UniversalBetPanel from '@/components/games/UniversalBetPanel';
import Header from '@/components/layout/Header';
import { Sparkles, ShieldCheck, Dices, Rocket, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWalletStore } from '@/store/walletStore';

export default function BetPanelDemoPage() {
  const [testState, setTestState] = useState<'IDLE' | 'LOADING' | 'ACCEPTED' | 'REJECTED' | 'SETTLED'>('IDLE');
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [crashMultiplier, setCrashMultiplier] = useState<number>(2.45);
  const [settlement, setSettlement] = useState<{ status: 'WON' | 'LOST' | 'REFUNDED'; payout: number; profit: number } | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  const { balance, setBalance } = useWalletStore();

  useEffect(() => {
    setMounted(true);
    if (balance < 1000) {
      setBalance(10000);
    }
  }, [balance, setBalance]);

  const handleSimulatedBet = async (amount: number, metadata: any) => {
    return new Promise<{ success: boolean; betId?: string; message?: string }>((resolve) => {
      setTimeout(() => {
        if (amount > 50000) {
          resolve({ success: false, message: 'Server risk limit exceeded' });
        } else {
          resolve({ success: true, betId: `bet_${Date.now().toString(36)}` });
        }
      }, 600);
    });
  };

  return (
    <div data-hydrated={mounted ? "true" : "false"} className="min-h-screen bg-[#070b12] text-white flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        
        {/* Title Header */}
        <div className="mb-6 pb-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">UNIVERSAL BET PANEL</h1>
              <span className="text-xs bg-neon-mint/20 text-neon-mint font-bold px-2.5 py-0.5 rounded-full border border-neon-mint/30 flex items-center gap-1">
                <Sparkles size={12} /> Standardized Across All Games
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Consistent betting controls, real-time potential payout calculations, min/max limit enforcement, and double-entry integration.
            </p>
          </div>

          {/* Test State Modifiers */}
          <div className="flex flex-wrap items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
            <span className="text-[10px] text-white/40 font-bold uppercase px-1">Test State:</span>
            <button
              onClick={() => { setTestState('IDLE'); setSettlement(null); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                testState === 'IDLE' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Idle
            </button>
            <button
              onClick={() => setTestState('LOADING')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                testState === 'LOADING' ? 'bg-blue-500/30 text-blue-300' : 'text-white/60 hover:text-white'
              }`}
            >
              Loading
            </button>
            <button
              onClick={() => setTestState('ACCEPTED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                testState === 'ACCEPTED' ? 'bg-emerald-500/30 text-emerald-300' : 'text-white/60 hover:text-white'
              }`}
            >
              Accepted
            </button>
            <button
              onClick={() => setTestState('REJECTED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                testState === 'REJECTED' ? 'bg-red-500/30 text-red-300' : 'text-white/60 hover:text-white'
              }`}
            >
              Rejected
            </button>
            <button
              onClick={() => {
                setSettlement({ status: 'WON', payout: 200, profit: 100 });
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-all cursor-pointer"
            >
              Won
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isOpen ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
              }`}
            >
              {isOpen ? 'Open' : 'Locked'}
            </button>
          </div>
        </div>

        {/* 3 Grid Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* 1. Standard Mode (Dice, Table, Colour) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
              <Dices size={16} className="text-neon-mint" />
              <span>Standard Game Panel (Dice / Colour / Table)</span>
            </div>
            <UniversalBetPanel
              title="Classic Dice"
              marketName="OVER 7"
              odds={2.35}
              minBet={10}
              maxBet={50000}
              isOpen={isOpen}
              betState={testState}
              settlement={settlement}
              onPlaceBet={handleSimulatedBet}
            />
          </div>

          {/* 2. Crash Mode (Aviator) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
              <Rocket size={16} className="text-amber-400" />
              <span>Crash Game Panel (Aviator)</span>
            </div>
            <UniversalBetPanel
              title="WinDaq Aviator"
              marketName="PLANE #1"
              variant="crash"
              odds={crashMultiplier}
              currentMultiplier={crashMultiplier}
              minBet={50}
              maxBet={100000}
              isOpen={isOpen}
              betState={testState}
              onPlaceBet={handleSimulatedBet}
              onCancelBet={() => toast.success(`Cashed out at ${crashMultiplier}x!`)}
            />
          </div>

          {/* 3. Compact Mode */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
              <Layers size={16} className="text-cyan-400" />
              <span>Compact Mobile Panel</span>
            </div>
            <UniversalBetPanel
              title="Dragon vs Tiger"
              marketName="DRAGON"
              odds={2.0}
              minBet={100}
              maxBet={20000}
              quickChips={[100, 500, 1000, 5000]}
              isOpen={isOpen}
              onPlaceBet={handleSimulatedBet}
            />
          </div>

        </div>

      </main>
    </div>
  );
}

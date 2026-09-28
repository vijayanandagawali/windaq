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
    <div data-hydrated={mounted ? "true" : "false"} className="min-h-screen bg-white text-slate-900 flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        
        {/* Title Header */}
        <div className="mb-6 pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">UNIVERSAL BET PANEL</h1>
              <span className="text-xs bg-neon-mint/20 text-neon-mint font-bold px-2.5 py-0.5 rounded-full border border-neon-mint/30 flex items-center gap-1">
                <Sparkles size={12} /> Standardized Across All Games
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Consistent betting controls, real-time potential payout calculations, min/max limit enforcement, and double-entry integration.
            </p>
          </div>

          {/* Test State Modifiers */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold uppercase px-1">Test State:</span>
            <button
              onClick={() => { setTestState('IDLE'); setSettlement(null); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                testState === 'IDLE' ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Idle
            </button>
            <button
              onClick={() => setTestState('LOADING')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                testState === 'LOADING' ? 'bg-blue-500/30 text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Loading
            </button>
            <button
              onClick={() => setTestState('ACCEPTED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                testState === 'ACCEPTED' ? 'bg-emerald-500/30 text-emerald-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Accepted
            </button>
            <button
              onClick={() => setTestState('REJECTED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                testState === 'REJECTED' ? 'bg-red-500/30 text-red-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rejected
            </button>
            <button
              onClick={() => {
                setSettlement({ status: 'WON', payout: 200, profit: 100 });
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 transition-all cursor-pointer"
            >
              Won
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isOpen ? 'bg-emerald-500/20 text-emerald-700' : 'bg-red-500/20 text-red-700'
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
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
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
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Rocket size={16} className="text-amber-600" />
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
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Layers size={16} className="text-cyan-600" />
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

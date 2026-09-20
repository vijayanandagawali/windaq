"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import SimulatedLiveTable, { SimulatedLiveState } from '@/components/games/SimulatedLiveTable';

export default function DragonTigerGamePage() {
  const { balance, fetchBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);

  // Simulated Live Dealer State
  const [tableState, setTableState] = useState<SimulatedLiveState>({
    roundId: '',
    phase: 'BETTING_OPEN',
    phaseTimeLeft: 15,
    totalPhaseDuration: 15,
    phaseEndsAt: Date.now() + 15000,
    dealer: {
      name: 'Maya',
      title: 'Virtual Live Dealer',
      tableId: 'DT-LIVETABLE-01',
      avatar: 'maya',
      speech: 'Welcome! Place your bets on Dragon, Tiger, or Tie.',
      action: 'INVITING_BETS'
    },
    result: null,
    dealingStep: null,
    history: []
  });

  useEffect(() => {
    // Initial balance fetch
    fetchBalance();

    const s = io('http://localhost:4000', { 
      transports: ['websocket', 'polling'],
      auth: { token: null } 
    });
    setSocket(s);

    s.on('connect', () => {
      console.log('[DragonTiger] Connected to realtime live table engine');
      s.emit('tg:join', { gameId: 'dragon-tiger', room: 'Standard' });
    });

    s.on('tg:tick', (data: any) => {
      setTableState(prev => ({
        ...prev,
        roundId: data.roundId,
        phase: data.phase,
        phaseTimeLeft: data.phaseTimeLeft,
        totalPhaseDuration: data.totalPhaseDuration,
        phaseEndsAt: data.phaseEndsAt,
        dealer: data.dealer || prev.dealer,
        result: data.result,
        dealingStep: data.dealingStep,
        serverSeedHash: data.serverSeedHash,
        serverSeed: data.serverSeed,
        clientSeed: data.clientSeed,
        history: data.history || prev.history
      }));
    });

    s.on('tg:phase_change', (data: any) => {
      setTableState(prev => ({
        ...prev,
        roundId: data.roundId || prev.roundId,
        phase: data.phase,
        totalPhaseDuration: data.duration,
        phaseTimeLeft: data.duration,
        dealer: data.dealer || prev.dealer,
        result: data.result !== undefined ? data.result : prev.result,
        dealingStep: data.dealingStep
      }));
    });

    s.on('tg:dealing_step', (data: any) => {
      setTableState(prev => ({
        ...prev,
        dealingStep: { step: data.step, totalSteps: 2, name: data.target },
        result: prev.result ? {
          ...prev.result,
          [data.target.toLowerCase()]: data.card
        } : null
      }));
    });

    s.on('tg:result', (data: any) => {
      setTableState(prev => ({
        ...prev,
        phase: 'RESULT',
        result: data.result,
        dealer: data.dealer || prev.dealer
      }));
    });

    s.on('tg:settled', (data: any) => {
      fetchBalance();
    });

    s.on('tg:locked', () => {
      setTableState(prev => ({
        ...prev,
        phase: 'BETTING_CLOSED',
        phaseTimeLeft: 2
      }));
    });

    return () => {
      s.emit('tg:leave', { gameId: 'dragon-tiger', room: 'Standard' });
      s.disconnect();
    };
  }, [fetchBalance]);

  // Handle Bet placement
  const handlePlaceBet = useCallback(async (market: 'DRAGON' | 'TIGER' | 'TIE', amount: number): Promise<boolean> => {
    if (!socket || !socket.connected) {
      toast.error('Connecting to simulated live table...');
      return false;
    }

    if (tableState.phase !== 'BETTING_OPEN') {
      toast.error('Betting is closed for this round!');
      return false;
    }

    return new Promise((resolve) => {
      const userId = 'guest'; // Standard guest/session user
      socket.emit('tg:bet', {
        userId,
        gameId: 'dragon-tiger',
        room: 'Standard',
        market,
        amount
      }, (res: any) => {
        if (res && res.success) {
          toast.success(`Placed ₹${amount} on ${market}`);
          fetchBalance();
          resolve(true);
        } else {
          toast.error(res?.message || 'Failed to place bet');
          resolve(false);
        }
      });
    });
  }, [socket, tableState.phase, fetchBalance]);

  return (
    <main className="h-screen w-full bg-[#070b12] text-white flex flex-col overflow-hidden">
      
      {/* Top Navigation */}
      <header className="bg-black/60 border-b border-white/10 px-4 py-2 flex items-center justify-between z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link 
            href="/" 
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Back to Game Hub"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-widest uppercase">Dragon Tiger</h1>
              <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                SIMULATED LIVE
              </span>
            </div>
            <span className="text-[10px] text-white/40">Continuously Running Server-Authoritative Table</span>
          </div>
        </div>

        {/* Balance Badge */}
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
          <span className="text-xs text-emerald-400 font-bold">₹ {balance.toFixed(2)}</span>
        </div>
      </header>

      {/* Simulated Live Table Component */}
      <div className="flex-1 overflow-hidden relative">
        <SimulatedLiveTable
          state={tableState}
          balance={balance}
          onPlaceBet={handlePlaceBet}
          gameTitle="Dragon Tiger"
          roomName="VIP Simulated Live Suite #1"
        />
      </div>

    </main>
  );
}

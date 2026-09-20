"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import toast from 'react-hot-toast';
import { io, Socket } from '@/lib/gameSocket';
import SimulatedLiveTable, { SimulatedLiveState } from '@/components/games/SimulatedLiveTable';
import { stateRecovery } from '@/lib/stateRecovery';

export default function DragonTigerGamePage() {
  const { balance, fetchBalance, userId } = useWalletStore();
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
      const activeUserId = userId || (typeof window !== 'undefined' ? (localStorage.getItem('windaq_user_id') || 'guest') : 'guest');
      s.emit('tg:join', { gameId: 'dragon-tiger', room: 'Standard', userId: activeUserId });
    });

    // Handle complete state snapshot on connect or page refresh
    const handleSnapshot = (data: any) => {
      setTableState(prev => ({
        ...prev,
        roundId: data.roundId || prev.roundId,
        phase: data.phase || prev.phase,
        phaseTimeLeft: data.phaseTimeLeft ?? prev.phaseTimeLeft,
        totalPhaseDuration: data.totalPhaseDuration ?? prev.totalPhaseDuration,
        phaseEndsAt: data.phaseEndsAt || prev.phaseEndsAt,
        dealer: data.dealer || prev.dealer,
        result: data.result !== undefined ? data.result : prev.result,
        dealingStep: data.dealingStep !== undefined ? data.dealingStep : prev.dealingStep,
        serverSeedHash: data.serverSeedHash || prev.serverSeedHash,
        serverSeed: data.serverSeed || prev.serverSeed,
        clientSeed: data.clientSeed || prev.clientSeed,
        history: data.history || prev.history,
        myBets: data.myBets || prev.myBets,
        isMaintenance: data.isMaintenance !== undefined ? data.isMaintenance : prev.isMaintenance,
        maintenanceMessage: data.maintenanceMessage !== undefined ? data.maintenanceMessage : prev.maintenanceMessage,
        minBet: data.minBet || prev.minBet,
        maxBet: data.maxBet || prev.maxBet,
        payoutVersion: data.payoutVersion || prev.payoutVersion,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isEnabled
      }));
    };

    s.on('tg:snapshot', handleSnapshot);
    s.on('round:snapshot', handleSnapshot);

    s.on('game:status', (data: any) => {
      if (data && data.operational === false) {
        setTableState(prev => ({
          ...prev,
          isMaintenance: data.reason === 'MAINTENANCE_MODE',
          maintenanceMessage: data.message,
          isEnabled: data.reason !== 'GAME_DISABLED'
        }));
      }
    });

    s.on('round:status_update', (data: any) => {
      if (data) {
        setTableState(prev => ({
          ...prev,
          isMaintenance: data.isMaintenance !== undefined ? data.isMaintenance : prev.isMaintenance,
          maintenanceMessage: data.maintenanceMessage !== undefined ? data.maintenanceMessage : prev.maintenanceMessage,
          minBet: data.minBet || prev.minBet,
          maxBet: data.maxBet || prev.maxBet,
          isEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isEnabled
        }));
      }
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
        history: data.history || prev.history,
        myBets: data.myBets !== undefined ? data.myBets : prev.myBets,
        isMaintenance: data.isMaintenance !== undefined ? data.isMaintenance : prev.isMaintenance,
        maintenanceMessage: data.maintenanceMessage !== undefined ? data.maintenanceMessage : prev.maintenanceMessage,
        minBet: data.minBet || prev.minBet,
        maxBet: data.maxBet || prev.maxBet,
        payoutVersion: data.payoutVersion || prev.payoutVersion,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isEnabled
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

    // Mobile background/foreground and network restoration sync
    const handleSync = () => {
      console.log('[DragonTiger] Resuming state after background or reconnect');
      if (s.disconnected) {
        s.connect();
      } else {
        const activeUserId = userId || (typeof window !== 'undefined' ? (localStorage.getItem('windaq_user_id') || 'guest') : 'guest');
        s.emit('tg:join', { gameId: 'dragon-tiger', room: 'Standard', userId: activeUserId });
      }
      fetchBalance();
    };

    window.addEventListener('windaq:foreground_resume', handleSync);
    window.addEventListener('windaq:online_resume', handleSync);

    return () => {
      window.removeEventListener('windaq:foreground_resume', handleSync);
      window.removeEventListener('windaq:online_resume', handleSync);
      s.emit('tg:leave', { gameId: 'dragon-tiger', room: 'Standard' });
      s.disconnect();
    };
  }, [fetchBalance, userId]);

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
      const activeUserId = userId || (typeof window !== 'undefined' ? (localStorage.getItem('windaq_user_id') || 'guest') : 'guest');
      const idempotencyKey = stateRecovery.generateIdempotencyKey('dt');

      socket.emit('tg:bet', {
        userId: activeUserId,
        gameId: 'dragon-tiger',
        room: 'Standard',
        market,
        amount,
        idempotencyKey
      }, (res: any) => {
        if (res && res.success) {
          toast.success(`Placed ₹${amount} on ${market}`);
          fetchBalance();
          stateRecovery.broadcast({
            type: 'BET_PLACED',
            gameId: 'dragon-tiger',
            market,
            amount,
            idempotencyKey
          });
          resolve(true);
        } else {
          toast.error(res?.message || 'Failed to place bet');
          resolve(false);
        }
      });
    });
  }, [socket, tableState.phase, fetchBalance, userId]);

  return (
    <div className="h-[calc(100dvh-58px)] w-full bg-[#070b12] text-white flex flex-col overflow-hidden">


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

    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { stateRecovery } from '@/lib/stateRecovery';
import { useWalletStore } from '@/store/walletStore';

export type UniversalPhase = 
  | 'CREATED'
  | 'BETTING_OPEN'
  | 'BETTING_CLOSED'
  | 'PLAYING'
  | 'RESULT'
  | 'SETTLEMENT'
  | 'COMPLETED'
  | 'NEXT_ROUND';

export interface UniversalRoundData {
  roundId: string;
  gameId: string;
  room: string;
  phase: UniversalPhase;
  serverTime: number;
  phaseEndsAt: number;
  phaseTimeLeft: number;
  totalPhaseDuration: number;
  serverSeedHash?: string;
  serverSeed?: string | null;
  clientSeed?: string | null;
  result?: any;
  history?: any[];
  myBets?: Record<string, number>;
}

export function useUniversalRound(gameId: string, room = 'Standard') {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { userId, fetchBalance } = useWalletStore();
  const [roundData, setRoundData] = useState<UniversalRoundData>({
    roundId: '',
    gameId,
    room,
    phase: 'BETTING_OPEN',
    serverTime: Date.now(),
    phaseEndsAt: Date.now() + 15000,
    phaseTimeLeft: 15,
    totalPhaseDuration: 15,
    history: [],
    myBets: {}
  });

  // Authoritative server clock offset: (serverTime - clientLocalTime)
  const serverOffsetRef = useRef<number>(0);
  const [visualTimeLeft, setVisualTimeLeft] = useState<number>(15);

  const requestSync = useCallback((s: Socket | null) => {
    if (!s || !s.connected) return;
    const activeUser = userId || (typeof window !== 'undefined' ? (localStorage.getItem('windaq_user_id') || 'guest') : 'guest');
    s.emit('round:join', { gameId, room, userId: activeUser });
    s.emit('tg:join', { gameId, room, userId: activeUser });
  }, [gameId, room, userId]);

  useEffect(() => {
    const s = io('http://localhost:4000', {
      transports: ['websocket', 'polling'],
      auth: { token: null }
    });
    setSocket(s);

    s.on('connect', () => {
      console.log(`[UniversalRound] Connected for ${gameId}:${room}`);
      requestSync(s);
    });

    // Authoritative snapshot listener (fired on join, refresh, and reconnect)
    const handleSnapshot = (data: any) => {
      if (data.serverTime) {
        serverOffsetRef.current = data.serverTime - Date.now();
      }
      setRoundData(prev => ({
        ...prev,
        ...data,
        myBets: data.myBets !== undefined ? data.myBets : prev.myBets
      }));
    };

    s.on('round:snapshot', handleSnapshot);
    s.on('tg:snapshot', handleSnapshot);

    // Universal tick listener
    const handleTick = (data: any) => {
      if (data.serverTime) {
        serverOffsetRef.current = data.serverTime - Date.now();
      }
      setRoundData(prev => ({
        ...prev,
        ...data,
        myBets: data.myBets !== undefined ? data.myBets : prev.myBets
      }));
    };

    s.on('round:tick', handleTick);
    s.on('tg:tick', handleTick);

    s.on('round:phase_change', (data: any) => {
      if (data.serverTime) {
        serverOffsetRef.current = data.serverTime - Date.now();
      }
      setRoundData(prev => ({
        ...prev,
        ...data,
        // When transitioning to NEXT_ROUND or CREATED, clear local placed bets for new round
        myBets: data.phase === 'NEXT_ROUND' || data.phase === 'CREATED' ? {} : prev.myBets
      }));
    });

    s.on('round:bet_accepted', (data: any) => {
      if (data.myBets) {
        setRoundData(prev => ({ ...prev, myBets: data.myBets }));
      }
      fetchBalance();
    });

    // Mobile background/foreground and network recovery handlers
    const handleForegroundResume = () => {
      console.log(`[UniversalRound] Foreground resume triggered for ${gameId}`);
      if (s.disconnected) {
        s.connect();
      } else {
        requestSync(s);
      }
    };

    const handleOnlineResume = () => {
      console.log(`[UniversalRound] Online restoration triggered for ${gameId}`);
      if (s.disconnected) {
        s.connect();
      } else {
        requestSync(s);
      }
    };

    window.addEventListener('windaq:foreground_resume', handleForegroundResume);
    window.addEventListener('windaq:online_resume', handleOnlineResume);

    return () => {
      window.removeEventListener('windaq:foreground_resume', handleForegroundResume);
      window.removeEventListener('windaq:online_resume', handleOnlineResume);
      s.emit('round:leave', { gameId, room });
      s.emit('tg:leave', { gameId, room });
      s.disconnect();
    };
  }, [gameId, room, requestSync, fetchBalance]);

  // Visual countdown timer strictly driven by authoritative server timestamp
  useEffect(() => {
    const updateVisualTimer = () => {
      const clientNow = Date.now() + serverOffsetRef.current;
      const remainingMs = roundData.phaseEndsAt - clientNow;
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      setVisualTimeLeft(remainingSeconds);
    };

    updateVisualTimer();
    const interval = setInterval(updateVisualTimer, 200); // High-cadence visual update
    return () => clearInterval(interval);
  }, [roundData.phaseEndsAt]);

  const isBettingOpen = useMemo(() => {
    return roundData.phase === 'BETTING_OPEN' && visualTimeLeft > 0;
  }, [roundData.phase, visualTimeLeft]);

  return {
    socket,
    roundId: roundData.roundId,
    phase: roundData.phase,
    isBettingOpen,
    visualTimeLeft,
    totalPhaseDuration: roundData.totalPhaseDuration,
    serverSeedHash: roundData.serverSeedHash,
    serverSeed: roundData.serverSeed,
    clientSeed: roundData.clientSeed,
    result: roundData.result,
    history: roundData.history || [],
    myBets: roundData.myBets || {},
    serverOffset: serverOffsetRef.current
  };
}

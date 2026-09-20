"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

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
}

export function useUniversalRound(gameId: string, room = 'Standard') {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roundData, setRoundData] = useState<UniversalRoundData>({
    roundId: '',
    gameId,
    room,
    phase: 'BETTING_OPEN',
    serverTime: Date.now(),
    phaseEndsAt: Date.now() + 15000,
    phaseTimeLeft: 15,
    totalPhaseDuration: 15,
    history: []
  });

  // Authoritative server clock offset: (serverTime - clientLocalTime)
  const serverOffsetRef = useRef<number>(0);
  const [visualTimeLeft, setVisualTimeLeft] = useState<number>(15);

  useEffect(() => {
    const s = io('http://localhost:4000', {
      transports: ['websocket', 'polling'],
      auth: { token: null }
    });
    setSocket(s);

    s.on('connect', () => {
      console.log(`[UniversalRound] Connected for ${gameId}:${room}`);
      // Join universal room and game-specific room
      s.emit('round:join', { gameId, room });
      s.emit('tg:join', { gameId, room });
    });

    // Universal tick listener
    const handleTick = (data: any) => {
      if (data.serverTime) {
        serverOffsetRef.current = data.serverTime - Date.now();
      }
      setRoundData(prev => ({
        ...prev,
        ...data
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
        ...data
      }));
    });

    return () => {
      s.emit('round:leave', { gameId, room });
      s.emit('tg:leave', { gameId, room });
      s.disconnect();
    };
  }, [gameId, room]);

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
    serverOffset: serverOffsetRef.current
  };
}

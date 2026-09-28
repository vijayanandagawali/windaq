"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, History } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Socket } from '@/lib/gameSocket';
import { createGameSocket } from '@/lib/config';
import { useBetSettlements, type SettlementSummary } from '@/hooks/useBetSettlements';
import RouletteWheel from '@/components/games/RouletteWheel';
import { audioEngine } from '@/lib/audioEngine';
import WinLossCelebration from '@/components/games/WinLossCelebration';
import ResultHistoryDrawer from '@/components/games/ResultHistoryDrawer';
import RoundDetailModal from '@/components/games/history/RoundDetailModal';
import type { HistoryItem } from '@/components/games/history/GameRoadmapStrip';
import AnimatedChipFlight from '@/components/games/animation/AnimatedChipFlight';

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const isRed = (n: number) => RED_NUMBERS.includes(n);
const PHASE_LABELS: Record<string, string> = {
  LOCKED: 'Wheel Spinning',
  BETTING_LOCKED: 'Bets Locked',
  PLAYING: 'Wheel Spinning',
  RESULT_REVEAL: 'Result',
  SETTLEMENT: 'Paying Winners',
  COMPLETED: 'Round Complete',
  NEXT_ROUND: 'Next Round',
  CREATED: 'Preparing Round',
  WAITING: 'Connecting'
};

export default function RouletteGame() {
  const { balance, fetchBalance, setBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);

  // Game State
  const [gameState, setGameState] = useState<any>({
    status: 'WAITING',
    lockTime: 0,
    resultTime: 0,
    now: Date.now()
  });
  
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  // Lets the once-registered socket handlers know a result is showing without reconnecting.
  const hasResultRef = useRef(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [selectedRoundDetail, setSelectedRoundDetail] = useState<HistoryItem | null>(null);

  // Betting State
  const [selectedChips, setSelectedChips] = useState<number>(10);
  const CHIP_VALUES = [10, 50, 100, 500, 1000];
  const [myBets, setMyBets] = useState<Record<string, number>>({});
  
  // Realtime Live Bets
  const [liveBets, setLiveBets] = useState<any[]>([]);

  // Chip Flights
  const [chipFlights, setChipFlights] = useState<any[]>([]);

  // Win / Loss Celebration
  const [celebration, setCelebration] = useState<{
    status: 'IDLE' | 'WON' | 'LOST';
    amount: number;
    multiplier?: number;
    message?: string;
  }>({ status: 'IDLE', amount: 0 });

  // The banner waits for both the wheel to stop and the server's settlement, whichever comes last.
  // Amounts come only from the server (`bet:settled`), never from client-side payout maths.
  const pendingSummaryRef = useRef<SettlementSummary | null>(null);
  const settledNumberRef = useRef<number | null>(null);

  const showOutcome = (summary: SettlementSummary, settledWinNumber: number) => {
    pendingSummaryRef.current = null;
    if (summary.paid > 0) {
      audioEngine.play('win');
      setCelebration({
        status: 'WON',
        amount: summary.paid,
        multiplier: summary.bestMultiplier,
        message: `Number ${settledWinNumber} Hit!`
      });

      // Fly winning chips from center table to player wallet
      setChipFlights(prev => [
        ...prev,
        {
          id: `win-${Date.now()}`,
          amount: summary.paid,
          type: 'WIN',
          startX: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
          startY: 220,
          endX: 60,
          endY: typeof window !== 'undefined' ? window.innerHeight - 50 : 600,
          color: 'from-amber-400 to-yellow-600',
          borderColor: 'border-yellow-200'
        }
      ]);
    } else if (summary.staked > 0) {
      audioEngine.play('loss');
      setCelebration({
        status: 'LOST',
        amount: summary.staked,
        message: `Ball Landed on ${settledWinNumber}`
      });
    }
    fetchBalance();
  };

  useBetSettlements(socket, 'roulette', (summary) => {
    if (settledNumberRef.current !== null) showOutcome(summary, settledNumberRef.current);
    else pendingSummaryRef.current = summary;
  });

  // Handle wheel settle completion (triggered only after deceleration into server pocket)
  const handleSettleComplete = (settledWinNumber: number) => {
    settledNumberRef.current = settledWinNumber;
    if (pendingSummaryRef.current) showOutcome(pendingSummaryRef.current, settledWinNumber);
    setTimeout(() => fetchBalance(), 1500);
  };

  useEffect(() => {
    const s = createGameSocket();
    setSocket(s);
    
    s.on('connect', () => {
      s.emit('roulette:join', { room: 'Auto' });
      s.emit('roulette:history', { room: 'Auto' }, (res: any) => {
        if (res.success) setHistory(res.data);
      });
    });

    s.on('roulette:tick', (data: any) => {
      setGameState(data);
      const diff = Math.max(0, Math.floor((data.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
      
      if (data.status === 'OPEN' && hasResultRef.current) {
        hasResultRef.current = false;
        settledNumberRef.current = null;
        pendingSummaryRef.current = null;
        setResultNumber(null);
        setMyBets({}); // Clear bets for new round
        setLiveBets([]);
      }
    });

    s.on('roulette:locked', () => {
      audioEngine.play('roundStart');
      audioEngine.play('rouletteWheel');
      setGameState((p: any) => ({ ...p, status: 'LOCKED' }));
      setTimeLeft(0);
      toast('Bets Locked! Wheel spinning...', { icon: '🎡' });
    });

    s.on('roulette:result', (data: any) => {
      // Server-authoritative result arrives -> Wheel targets and decelerates into this exact pocket
      setGameState((p: any) => ({ ...p, status: 'RESULT' }));
      hasResultRef.current = true;
      setResultNumber(data.resultNumber);
      setHistory(prev => [{ resultNumber: data.resultNumber, resultTime: new Date() }, ...prev].slice(0, 25));
    });

    s.on('RESULT_HISTORY_UPDATED', (data: any) => {
      if (!data || !data.roundId) return;
      const num = data.resultMetadata?.winningNumber !== undefined ? data.resultMetadata.winningNumber : parseInt(data.resultValue.match(/\d+/)?.[0] || '0');
      setHistory(prev => {
        const exists = prev.some(h => h.roundId === data.roundId || (h.resultId && h.resultId === data.resultId));
        if (exists) return prev;
        return [{
          resultId: data.resultId,
          roundId: data.roundId,
          resultNumber: num,
          resultValue: data.resultValue,
          color: data.resultMetadata?.winningColor || (num === 0 ? 'green' : (RED_NUMBERS.includes(num) ? 'red' : 'black')),
          commitmentHash: data.commitmentHash,
          serverSeed: data.serverSeed,
          clientSeed: data.clientSeed,
          resultTime: data.resultTimestamp || new Date()
        }, ...prev].slice(0, 30);
      });
    });
    
    s.on('roulette:live_bet', (data: any) => {
      setLiveBets(prev => [data, ...prev].slice(0, 5));
    });

    return () => { 
      s.emit('roulette:leave', { room: 'Auto' });
      s.disconnect(); 
    };
  }, [fetchBalance]);

  useEffect(() => {
    if (gameState.status !== 'OPEN') return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((gameState.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  const placeBet = (market: string, targets: number[]) => {
    if (gameState.status !== 'OPEN') {
      toast.error("Bets are currently locked!");
      return;
    }
    
    if (!socket) return;
    
    audioEngine.play('bet');
    socket.emit('roulette:bet', { room: 'Auto', market, targets, amount: selectedChips }, (res: any) => {
      if (res.success) {
        if (typeof res.data?.newBalance === 'number') setBalance(res.data.newBalance);
        audioEngine.play('accepted');
        // use a unique key for the grid to stack chips visually
        const betKey = targets.length === 1 ? `STRAIGHT_${targets[0]}` : (market === 'DOZEN' || market === 'COLUMN') ? `${market}_${targets[0]}` : market;
        setMyBets(prev => ({
          ...prev,
          [betKey]: (prev[betKey] || 0) + selectedChips
        }));

        setChipFlights(prev => [
          ...prev,
          {
            id: `bet-${Date.now()}-${Math.random()}`,
            amount: selectedChips,
            type: 'BET',
            startX: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
            startY: typeof window !== 'undefined' ? window.innerHeight - 80 : 600,
            endX: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
            endY: 340,
            color: selectedChips >= 500 ? 'from-purple-600 to-indigo-800' : 'from-amber-500 to-amber-700',
            borderColor: 'border-yellow-200'
          }
        ]);

        toast.success(`Placed ₹${selectedChips} on ${market}`);
        fetchBalance(); 
      } else {
        audioEngine.play('loss');
        toast.error(res.message);
      }
    });
  };

  const getNumberColorClass = (n: number) => {
    if (n === 0) return "bg-green-600 hover:bg-green-500 border-green-400 text-white";
    if (isRed(n)) return "bg-red-700 hover:bg-red-600 border-red-500 text-white";
    return "bg-white hover:bg-slate-100 border-slate-300 text-slate-900";
  };

  const renderNumberCell = (n: number) => {
    const betKey = `STRAIGHT_${n}`;
    const isWinner = resultNumber === n;
    return (
      <button 
        key={n}
        onClick={() => placeBet('STRAIGHT', [n])}
        className={`relative flex items-center justify-center border-t border-l border-slate-200 transition-all font-bold text-lg sm:text-xl py-3 ${getNumberColorClass(n)} ${
          isWinner ? 'ring-4 ring-yellow-400 scale-105 z-20 shadow-[0_0_25px_rgba(250,204,21,0.9)] animate-pulse' : ''
        }`}
      >
        {n}
        {myBets[betKey] && (
          <motion.div 
            initial={{ scale: 0, y: -15 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="absolute inset-0 bg-slate-100 flex items-center justify-center backdrop-blur-[1px]"
          >
            <div className="bg-gradient-to-br from-yellow-400 to-amber-600 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-lg border border-yellow-200">
              ₹{myBets[betKey]}
            </div>
          </motion.div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-[calc(100dvh-58px)] w-full bg-gradient-to-b from-orange-50/60 via-white to-emerald-50/60 text-slate-900 font-sans flex flex-col">
      {/* Top HUD Bar */}
      <div className="bg-white/80 border-b border-slate-200 px-4 py-2 flex items-center justify-between z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600">
              EUROPEAN ROULETTE
            </span>
          </div>
          {gameState.roundId && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full text-[11px] font-mono text-amber-700">
              <span className="text-slate-500">ROUND:</span>
              <span className="font-bold">{gameState.roundId}</span>
            </div>
          )}
          <span className="hidden md:inline-block text-xs text-slate-500 border-l border-slate-200 pl-3">
            Auto Wheel • Server-Authoritative 37 Pockets (0-36)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistoryDrawer(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-900 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <History size={14} className="text-emerald-600" />
            <span>Official History</span>
          </button>
        </div>
      </div>

      {/* Game Stage Area */}
      <div className="w-full min-h-[220px] py-4 bg-gradient-to-b from-white to-slate-50 relative flex flex-col items-center justify-center overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/30 via-transparent to-transparent opacity-60" />
        
        {/* Timer / Status */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/80 border border-slate-200 px-5 py-1.5 rounded-full flex items-center gap-3 backdrop-blur-md z-20 shadow-lg">
           {gameState.status === 'OPEN' ? (
             <>
               <div className="w-2 h-2 rounded-full bg-neon-mint animate-pulse" />
               <span className="font-bold tracking-widest uppercase text-xs">Betting Open</span>
               <span className={`font-mono font-black text-lg ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-neon-mint'}`}>
                 00:{timeLeft.toString().padStart(2, '0')}
               </span>
             </>
           ) : (
             <>
               <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
               <span className="font-bold tracking-widest uppercase text-xs text-yellow-600">{PHASE_LABELS[gameState.status] || 'Please wait'}</span>
             </>
           )}
        </div>

        {/* Central Display: Realistic European Roulette Wheel */}
        <div className="z-10 relative flex flex-col items-center mt-6">
          <RouletteWheel 
            isSpinning={['LOCKED', 'BETTING_LOCKED', 'PLAYING'].includes(gameState.status)}
            winningNumber={resultNumber} 
            size={190}
            onSettleComplete={handleSettleComplete}
          />
          {resultNumber !== null && (
            <motion.div
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="mt-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black px-4 py-1 rounded-full font-black text-sm tracking-widest shadow-[0_0_20px_rgba(234,179,8,0.7)] flex items-center gap-2"
            >
              <span>WINNER:</span>
              <span className={`text-base font-black px-2 py-0.5 rounded-md ${isRed(resultNumber) ? 'bg-red-600 text-white' : resultNumber === 0 ? 'bg-emerald-600 text-white' : 'bg-white text-slate-900'}`}>
                {resultNumber} {resultNumber === 0 ? '(GREEN)' : isRed(resultNumber) ? '(RED)' : '(BLACK)'}
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Reusable Chip Flights */}
      <AnimatedChipFlight 
        flights={chipFlights} 
        onFlightComplete={(id) => setChipFlights(prev => prev.filter(f => f.id !== id))} 
      />

      {/* History Ribbon */}
      <div className="bg-slate-100 border-b border-slate-200 py-2 px-4 flex gap-2 overflow-x-auto scrollbar-hide items-center h-12 justify-between">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-slate-500 font-bold uppercase mr-1 whitespace-nowrap">History:</span>
          {history.length === 0 ? (
            <span className="text-xs text-slate-500 italic">No completed spins yet...</span>
          ) : (
            history.map((h, i) => {
              const num = h.resultNumber !== undefined ? h.resultNumber : (parseInt(h.resultValue?.match(/\d+/)?.[0] || '0'));
              const col = h.color || (num === 0 ? 'green' : (RED_NUMBERS.includes(num) ? 'red' : 'black'));
              return (
                <button 
                  key={h.resultId || i} 
                  onClick={() => setSelectedRoundDetail({
                    resultId: h.resultId || `RES-ROU-${i}`,
                    roundId: h.roundId || `ROU-${Date.now()}-${i}`,
                    gameId: 'roulette',
                    variantId: 'Auto',
                    tableId: 'roulette-Auto',
                    resultType: 'ROULETTE',
                    resultValue: `${num} ${col.toUpperCase()}`,
                    resultSummary: `${num}`,
                    resultTimestamp: h.resultTime || new Date(),
                    commitmentHash: h.commitmentHash,
                    serverSeed: h.serverSeed,
                    clientSeed: h.clientSeed,
                    settlementStatus: 'SETTLED'
                  })}
                  className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-transform hover:scale-110 active:scale-95 cursor-pointer ${getNumberColorClass(num)}`}
                  title={`Result: ${num} ${col.toUpperCase()} — Click for Provably Fair Verification`}
                >
                  {num}
                </button>
              );
            })
          )}
        </div>
        <button
          onClick={() => setShowHistoryDrawer(true)}
          className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold flex items-center gap-1 border border-slate-200 whitespace-nowrap"
        >
          <History size={12} className="text-emerald-600" />
          Official History
        </button>
      </div>

      {/* Non-Predictive Disclaimer */}
      <div className="bg-white/80 border-b border-slate-200 px-4 py-1 flex items-center justify-between text-[10px] text-slate-500">
        <span>Historical outcomes only • Independent random trials • Not a predictive system</span>
        <span className="hidden sm:inline font-mono text-[10px] text-emerald-600">Click any spin for cryptographic proof</span>
      </div>

      {/* Betting Grid */}
      <div className="flex-1 p-2 sm:p-4">
        {/* On phones the table keeps a readable width and scrolls sideways instead of squashing. */}
        <div className="max-w-4xl mx-auto overflow-x-auto pb-2">
        <div className="min-w-[600px] sm:min-w-0">
          
          {/* Main Grid Wrapper */}
          <div className="flex border-b border-r border-slate-200 bg-slate-100 rounded-xl overflow-hidden shadow-2xl">
            
            {/* Zero Cell */}
            <button 
              onClick={() => placeBet('STRAIGHT', [0])}
              className="w-12 sm:w-16 relative flex items-center justify-center border-t border-l border-slate-200 hover:bg-green-500 bg-green-600 transition-colors"
            >
               <span className="font-black text-2xl rotate-90 text-slate-900">0</span>
               {myBets['STRAIGHT_0'] && (
                 <div className="absolute inset-0 bg-slate-100 flex items-center justify-center backdrop-blur-[1px]">
                   <div className="bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded-full shadow border border-slate-200 rotate-90">
                     {myBets['STRAIGHT_0']}
                   </div>
                 </div>
               )}
            </button>
            
            {/* Numbers Grid */}
            <div className="flex-1 grid grid-cols-12 grid-rows-3">
              {/* Row 1: 3,6,9...36 */}
              {[3,6,9,12,15,18,21,24,27,30,33,36].map(n => renderNumberCell(n))}
              
              {/* Row 2: 2,5,8...35 */}
              {[2,5,8,11,14,17,20,23,26,29,32,35].map(n => renderNumberCell(n))}
              
              {/* Row 3: 1,4,7...34 */}
              {[1,4,7,10,13,16,19,22,25,28,31,34].map(n => renderNumberCell(n))}
            </div>

            {/* Column Bets */}
            <div className="w-12 sm:w-16 flex flex-col font-bold text-xs tracking-widest border-t border-l border-slate-200 text-slate-500">
               <button onClick={() => placeBet('COLUMN', [3,6,9,12,15,18,21,24,27,30,33,36])} className="flex-1 border-b border-slate-200 hover:bg-slate-100 flex items-center justify-center relative">
                 <span className="-rotate-90">2:1</span>
                 {myBets['COLUMN_3'] && <div className="absolute top-1 right-1 bg-yellow-500 text-black text-[9px] px-1 rounded-full">{myBets['COLUMN_3']}</div>}
               </button>
               <button onClick={() => placeBet('COLUMN', [2,5,8,11,14,17,20,23,26,29,32,35])} className="flex-1 border-b border-slate-200 hover:bg-slate-100 flex items-center justify-center relative">
                 <span className="-rotate-90">2:1</span>
                 {/* Needs unique key if distinguishing which column, but for simplicity we just pass same market type "COLUMN". Our engine doesn't distinguish which column for payouts as long as targets are met. Wait, if multiple COLUMN bets are placed, they overwrite the local UI state key `COLUMN`. Let's fix that by sending unique keys for UI only. */}
               </button>
               <button onClick={() => placeBet('COLUMN', [1,4,7,10,13,16,19,22,25,28,31,34])} className="flex-1 border-b border-slate-200 hover:bg-slate-100 flex items-center justify-center">
                 <span className="-rotate-90">2:1</span>
               </button>
            </div>
          </div>

          {/* Outside Bets Row 1: Dozens */}
          <div className="flex ml-12 sm:ml-16 mr-12 sm:mr-16 border-l border-r border-b border-slate-200">
            <button onClick={() => placeBet('DOZEN', Array.from({length:12}, (_,i)=>i+1))} className="flex-1 py-3 text-center border-r border-slate-200 hover:bg-slate-100 font-bold text-slate-600 text-xs sm:text-sm tracking-widest relative">
              1ST 12
              {myBets['DOZEN_1'] && <div className="absolute top-1 right-1 bg-yellow-500 text-black text-[9px] px-1 rounded-full">{myBets['DOZEN_1']}</div>}
            </button>
            <button onClick={() => placeBet('DOZEN', Array.from({length:12}, (_,i)=>i+13))} className="flex-1 py-3 text-center border-r border-slate-200 hover:bg-slate-100 font-bold text-slate-600 text-xs sm:text-sm tracking-widest relative">
              2ND 12
            </button>
            <button onClick={() => placeBet('DOZEN', Array.from({length:12}, (_,i)=>i+25))} className="flex-1 py-3 text-center hover:bg-slate-100 font-bold text-slate-600 text-xs sm:text-sm tracking-widest relative">
              3RD 12
            </button>
          </div>

          {/* Outside Bets Row 2: 1-18, EVEN, RED, BLACK, ODD, 19-36 */}
          <div className="flex ml-12 sm:ml-16 mr-12 sm:mr-16 border-l border-r border-b border-slate-200">
            <button onClick={() => placeBet('LOW', Array.from({length:18}, (_,i)=>i+1))} className="flex-1 py-3 border-r border-slate-200 hover:bg-slate-100 font-bold text-slate-600 text-[10px] sm:text-xs">1 TO 18</button>
            <button onClick={() => placeBet('EVEN', Array.from({length:18}, (_,i)=>(i+1)*2))} className="flex-1 py-3 border-r border-slate-200 hover:bg-slate-100 font-bold text-slate-600 text-[10px] sm:text-xs">EVEN</button>
            <button onClick={() => placeBet('RED', RED_NUMBERS)} className="flex-1 py-3 border-r border-slate-200 hover:bg-red-900/50 bg-red-950/30 flex items-center justify-center">
               <div className="w-6 h-4 bg-red-600 rounded" />
            </button>
            <button onClick={() => placeBet('BLACK', Array.from({length:36}, (_,i)=>i+1).filter(x => !isRed(x)))} className="flex-1 py-3 border-r border-slate-200 hover:bg-slate-100 bg-white/90 flex items-center justify-center">
               <div className="w-6 h-4 bg-slate-100 rounded border border-slate-300" />
            </button>
            <button onClick={() => placeBet('ODD', Array.from({length:18}, (_,i)=>(i*2)+1))} className="flex-1 py-3 border-r border-slate-200 hover:bg-slate-100 font-bold text-slate-600 text-[10px] sm:text-xs">ODD</button>
            <button onClick={() => placeBet('HIGH', Array.from({length:18}, (_,i)=>i+19))} className="flex-1 py-3 hover:bg-slate-100 font-bold text-slate-600 text-[10px] sm:text-xs">19 TO 36</button>
          </div>
          
        </div>
      </div>
        </div>

      {/* Chip Selector Footer */}
      <div className="bg-white/80 border-t border-slate-200 p-4 sticky bottom-0 z-40 backdrop-blur-md">
         <div className="max-w-3xl mx-auto flex gap-2 justify-center overflow-x-auto pb-2 scrollbar-hide">
            {CHIP_VALUES.map(val => (
              <button 
                key={val}
                onClick={() => setSelectedChips(val)}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex-shrink-0 flex items-center justify-center border-4 shadow-[0_4px_10px_rgba(15,23,42,0.13)] transition-transform ${selectedChips === val ? 'scale-110 -translate-y-2 border-neon-mint bg-neon-mint/20' : 'border-gray-500 bg-slate-100 opacity-80 hover:opacity-100'}`}
              >
                 <div className="absolute inset-1 border border-slate-200 rounded-full border-dashed" />
                 <span className={`font-black text-sm ${selectedChips === val ? 'text-neon-mint drop-shadow-[0_0_5px_#10b981]' : 'text-slate-600'}`}>{val >= 1000 ? `${val/1000}k` : val}</span>
              </button>
            ))}
         </div>
      </div>

      {/* Win & Loss Animation Overlay */}
      <WinLossCelebration
        status={celebration.status}
        amount={celebration.amount}
        multiplier={celebration.multiplier}
        message={celebration.message}
        onDismiss={() => setCelebration({ status: 'IDLE', amount: 0 })}
      />
      <ResultHistoryDrawer
        gameId="roulette"
        variantId="Auto"
        isOpen={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
      />
      <RoundDetailModal
        round={selectedRoundDetail}
        isOpen={!!selectedRoundDetail}
        onClose={() => setSelectedRoundDetail(null)}
      />
    </div>
  );
}

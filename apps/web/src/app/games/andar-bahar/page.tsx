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
import { audioEngine } from '@/lib/audioEngine';
import WinLossCelebration from '@/components/games/WinLossCelebration';
import AndarBaharZone, { abRank } from '@/components/games/AndarBaharZone';
import { PlayingCard } from '@/components/lobby/previews/primitives';
import AnimatedChipFlight from '@/components/games/animation/AnimatedChipFlight';

export default function AndarBaharGame() {
  const { balance, fetchBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);

  // Game State
  const [gameState, setGameState] = useState<any>({
    status: 'WAITING',
    lockTime: 0,
    resultTime: 0,
    now: Date.now()
  });
  
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [result, setResult] = useState<any>(null); // { joker, dealtCards, winner }
  const [history, setHistory] = useState<any[]>([]);

  // Betting State
  const [selectedChips, setSelectedChips] = useState<number>(10);
  const CHIP_VALUES = [10, 50, 100, 500, 1000];
  const [myBets, setMyBets] = useState<Record<string, number>>({});
  
  // Realtime Live Bets
  const [liveBets, setLiveBets] = useState<any[]>([]);

  // Animation State
  const [displayedCards, setDisplayedCards] = useState<any[]>([]);
  const [isDealing, setIsDealing] = useState(false);
  const [jokerShown, setJokerShown] = useState(false);
  const dealtRoundRef = useRef<string | null>(null);
  // Pending deal steps; cancelled when a new round opens so no card lands in the next round.
  const dealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearDealTimers = () => {
    dealTimersRef.current.forEach(clearTimeout);
    dealTimersRef.current = [];
  };
  const [chipFlights, setChipFlights] = useState<any[]>([]);
  const [celebration, setCelebration] = useState<{
    status: 'IDLE' | 'WON' | 'LOST';
    amount: number;
    multiplier?: number;
    message?: string;
    net?: number;
  }>({ status: 'IDLE', amount: 0 });

  // Socket handlers are registered once; refs give them the latest round state without reconnecting.
  const resultRef = useRef<any>(null);
  useEffect(() => { resultRef.current = result; }, [result]);

  useEffect(() => {
    const s = createGameSocket();
    setSocket(s);
    
    s.on('connect', () => {
      s.emit('tg:join', { gameId: 'andar-bahar', room: 'Auto' });
      s.emit('tg:history', { gameId: 'andar-bahar', room: 'Auto' }, (res: any) => {
        if (res.success) setHistory(res.data);
      });
    });

    s.on('tg:tick', (data: any) => {
      setGameState(data);
      const diff = Math.max(0, Math.floor((data.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
      
      if (data.status === 'OPEN' && resultRef.current !== null) {
        clearDealTimers();
        resultRef.current = null;
        dealtWinnerRef.current = null;
        pendingSummaryRef.current = null;
        setResult(null);
        setMyBets({});
        setLiveBets([]);
        setDisplayedCards([]);
        setIsDealing(false);
        setCelebration({ status: 'IDLE', amount: 0 });
      }
    });

    s.on('tg:locked', () => {
      audioEngine.play('roundStart');
      setGameState((p: any) => ({ ...p, status: 'LOCKED' }));
      setTimeLeft(0);
      toast('Bets Locked! Revealing Joker Card...', { icon: '🃏' });
    });

    s.on('tg:result', (data: any) => {
      // Each round is dealt exactly once, even if a result event is delivered twice.
      const roundKey = data.roundId || JSON.stringify(data.result?.joker);
      if (dealtRoundRef.current === roundKey) return;
      dealtRoundRef.current = roundKey;

      setGameState((p: any) => ({ ...p, status: 'RESULT' }));
      setResult(data.result);

      // Start realistic dealing animation (the joker flips first)
      startDealingAnimation(data.result?.dealtCards || [], data.result?.winner);
      
      setHistory(prev => [{ result: data.result, resultTime: new Date() }, ...prev].slice(0, 15));
      setTimeout(() => fetchBalance(), 2500); 
    });
    
    s.on('tg:live_bet', (data: any) => {
      setLiveBets(prev => [data, ...prev].slice(0, 5));
    });

    return () => { 
      s.emit('tg:leave', { gameId: 'andar-bahar', room: 'Auto' });
      s.disconnect(); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBalance]);

  useEffect(() => {
    if (gameState.status !== 'OPEN') return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((gameState.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  // The banner waits for both the dealing animation and the server's settlement, whichever comes last.
  // Amounts come only from the server (`bet:settled`).
  const dealtWinnerRef = useRef<string | null>(null);
  const pendingSummaryRef = useRef<SettlementSummary | null>(null);

  const showOutcome = (summary: SettlementSummary, winner: string) => {
    pendingSummaryRef.current = null;
    if (summary.paid > 0) {
      audioEngine.play('win');
      setCelebration({ status: 'WON', amount: summary.paid, multiplier: summary.bestMultiplier, net: summary.paid - summary.staked, message: `${winner} WINS!` });
      setChipFlights(prev => [
        ...prev,
        {
          id: `ab-win-${Date.now()}`,
          amount: summary.paid,
          type: 'WIN',
          startX: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
          startY: 280,
          endX: 80,
          endY: typeof window !== 'undefined' ? window.innerHeight - 60 : 600,
          color: 'from-amber-400 to-yellow-600',
          borderColor: 'border-yellow-200'
        }
      ]);
    } else if (summary.staked > 0) {
      audioEngine.play('loss');
      setCelebration({ status: 'LOST', amount: summary.staked, message: `${winner} Won • Bet Lost` });
    }
    fetchBalance();
  };

  useBetSettlements(socket, 'andar_bahar', (summary) => {
    if (dealtWinnerRef.current) showOutcome(summary, dealtWinnerRef.current);
    else pendingSummaryRef.current = summary;
  });

  const startDealingAnimation = (cards: any[], winner: string) => {
    clearDealTimers();
    setIsDealing(true);
    setDisplayedCards([]);
    setJokerShown(false);
    // Joker turns first; dealing starts after a beat. The pace is even throughout (it never
    // slows before the matching card, which would give the answer away).
    dealTimersRef.current.push(setTimeout(() => { setJokerShown(true); audioEngine.play('cardFlip'); }, 350));
    if (cards.length === 0) { setIsDealing(false); dealtWinnerRef.current = winner; return; }
    const stepMs = Math.max(220, Math.min(600, Math.floor(8500 / cards.length)));
    const startAt = 1400;
    cards.forEach((cardObj, index) => {
      dealTimersRef.current.push(setTimeout(() => {
        audioEngine.play('cardSlide');
        setDisplayedCards(prev => [...prev, cardObj]);
        if (index === cards.length - 1) {
          setIsDealing(false);
          dealtWinnerRef.current = winner;
          if (pendingSummaryRef.current) showOutcome(pendingSummaryRef.current, winner);
        }
      }, startAt + stepMs * index));
    });
  };

  const placeBet = (market: string) => {
    if (gameState.status !== 'OPEN') {
      toast.error("Bets are currently locked!");
      return;
    }
    
    if (!socket) return;
    
    audioEngine.play('bet');
    socket.emit('tg:bet', { gameId: 'andar-bahar', room: 'Auto', market, amount: selectedChips }, (res: any) => {
      if (res.success) {
        setMyBets(prev => ({
          ...prev,
          [market]: (prev[market] || 0) + selectedChips
        }));

        setChipFlights(prev => [
          ...prev,
          {
            id: `ab-bet-${Date.now()}-${Math.random()}`,
            amount: selectedChips,
            type: 'BET',
            startX: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
            startY: typeof window !== 'undefined' ? window.innerHeight - 80 : 600,
            endX: market === 'ANDAR' ? (typeof window !== 'undefined' ? window.innerWidth * 0.3 : 100) : (typeof window !== 'undefined' ? window.innerWidth * 0.7 : 300),
            endY: 420,
            color: selectedChips >= 500 ? 'from-purple-600 to-indigo-800' : 'from-amber-500 to-amber-700',
            borderColor: 'border-yellow-200'
          }
        ]);

        toast.success(`Placed ₹${selectedChips} on ${market}`);
        fetchBalance(); 
      } else {
        toast.error(res.message);
      }
    });
  };

  const renderCardUI = (cardStr: any, key: string, isJoker = false) => {
    if (!cardStr) return null;
    
    const faceCards: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    const rankStr = cardStr.rank <= 10 ? cardStr.rank.toString() : (faceCards[Number(cardStr.rank)] || cardStr.rank.toString());
    const suit = cardStr.suit;
    
    const suitColors: Record<string, string> = { 'H': 'text-red-600', 'D': 'text-red-600', 'C': 'text-black', 'S': 'text-black' };
    const suitSymbols: Record<string, string> = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
    
    return (
      <motion.div 
        key={key}
        initial={{ x: 0, y: -200, opacity: 0, scale: 0.5, rotateY: 180 }}
        animate={{ x: 0, y: 0, opacity: 1, scale: 1, rotateY: 0 }}
        transition={{ type: "spring", damping: 15 }}
        className={`w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-white shadow-2xl flex flex-col justify-between p-1.5 border border-gray-300 relative ${isJoker ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-green-900 z-20' : ''}`}
      >
        <div className={`text-sm sm:text-base font-bold leading-none ${suitColors[suit]}`}>
          {rankStr}
          <div className="text-xs sm:text-sm">{suitSymbols[suit]}</div>
        </div>
        <div className={`text-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 ${suitColors[suit]}`}>
          {suitSymbols[suit]}
        </div>
        <div className={`text-sm sm:text-base font-bold leading-none rotate-180 self-end ${suitColors[suit]}`}>
          {rankStr}
          <div className="text-xs sm:text-sm">{suitSymbols[suit]}</div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-[calc(100dvh-58px)] w-full bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-900 font-sans flex flex-col relative">


      {/* Game Stage Area */}
      <div className="flex-1 w-full relative flex flex-col items-center py-6 px-4">
        
        {/* Timer / Status */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/80 border border-slate-200 px-6 py-2 rounded-full flex items-center gap-3 backdrop-blur-md z-30 shadow-lg">
           {gameState.status === 'OPEN' ? (
             <>
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
               <span className="font-bold tracking-widest uppercase text-sm">Place Bets</span>
               <span className={`font-mono font-black text-xl ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                 00:{timeLeft.toString().padStart(2, '0')}
               </span>
             </>
           ) : (
             <>
               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
               <span className="font-bold tracking-widest uppercase text-sm text-red-500">{isDealing ? 'Dealing Cards...' : gameState.status === 'LOCKED' ? 'Bets Closed' : gameState.status}</span>
             </>
           )}
        </div>

        {/* Joker: dealt face down, then turned to show the rank to match */}
        <div className="mb-6 mt-12 flex flex-col items-center">
          <span className="mb-2 rounded-full bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-[0.25em] text-amber-700 ring-1 ring-amber-200">Joker</span>
          <div className="flex h-[124px] items-center justify-center text-[34px]">
            {result?.joker ? (
              <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 16 }}>
                <PlayingCard rank={abRank(result.joker.rank)} suit={result.joker.suit} faceDown={!jokerShown}
                  className={`w-[84px] ${jokerShown ? 'wd-glow-card' : ''}`} />
              </motion.div>
            ) : (
              <div className="flex h-[118px] w-[84px] items-center justify-center rounded-xl border-2 border-dashed border-amber-300/70 bg-white/60 text-center text-[11px] font-semibold text-slate-400">Joker dealt when bets close</div>
            )}
          </div>
        </div>

        {/* Andar / Bahar Table Zones */}
        <div className="w-[calc(100%-1rem)] max-w-4xl flex justify-between gap-3 sm:gap-6 rounded-[28px] bg-[radial-gradient(circle_at_50%_15%,#22C3A6,#0B6B5C_85%)] p-3 sm:p-5 shadow-[inset_0_10px_28px_rgba(0,0,0,0.28),0_18px_40px_rgba(11,107,92,0.25)] ring-4 ring-amber-200/70">
           
           <AndarBaharZone side="ANDAR" cards={displayedCards.filter(c => c.side === 'ANDAR').map(c => c.card)}
             jokerRank={jokerShown ? result?.joker?.rank ?? null : null} isWinner={result?.winner === 'ANDAR' && !isDealing && jokerShown}
             isNext={isDealing && displayedCards.length % 2 === 0} />
           <AndarBaharZone side="BAHAR" cards={displayedCards.filter(c => c.side === 'BAHAR').map(c => c.card)}
             jokerRank={jokerShown ? result?.joker?.rank ?? null : null} isWinner={result?.winner === 'BAHAR' && !isDealing && jokerShown}
             isNext={isDealing && displayedCards.length % 2 === 1} />
        </div>

      {/* Reusable Chip Flights */}
      <AnimatedChipFlight 
        flights={chipFlights} 
        onFlightComplete={(id) => setChipFlights(prev => prev.filter(f => f.id !== id))} 
      />

      {/* Win / Loss Presentation */}
      <WinLossCelebration
        status={celebration.status}
        net={celebration.net}
        amount={celebration.amount}
        multiplier={celebration.multiplier}
        message={celebration.message}
        onDismiss={() => setCelebration({ status: 'IDLE', amount: 0 })}
      />

      </div>

      {/* Betting Panels */}
      <div className="w-full max-w-4xl mx-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Andar Bet Button */}
          <button 
            onClick={() => placeBet('ANDAR')}
            className="bg-blue-600/80 hover:bg-blue-500 border border-blue-400/50 rounded-xl py-6 flex flex-col items-center relative overflow-hidden transition-all active:scale-95"
          >
             <div className="absolute inset-0 bg-gradient-to-t from-slate-100 to-transparent" />
             <span className="font-black text-2xl uppercase tracking-widest relative z-10">Andar</span>
             <span className="text-blue-700 text-xs font-bold relative z-10 mt-1">Pays 1.9x</span>
             {myBets['ANDAR'] && (
               <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded-full shadow-lg border border-slate-200 z-20">
                 ₹ {myBets['ANDAR']}
               </div>
             )}
          </button>

          {/* Bahar Bet Button */}
          <button 
            onClick={() => placeBet('BAHAR')}
            className="bg-red-600/80 hover:bg-red-500 border border-red-400/50 rounded-xl py-6 flex flex-col items-center relative overflow-hidden transition-all active:scale-95"
          >
             <div className="absolute inset-0 bg-gradient-to-t from-slate-100 to-transparent" />
             <span className="font-black text-2xl uppercase tracking-widest relative z-10">Bahar</span>
             <span className="text-red-700 text-xs font-bold relative z-10 mt-1">Pays 2x</span>
             {myBets['BAHAR'] && (
               <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded-full shadow-lg border border-slate-200 z-20">
                 ₹ {myBets['BAHAR']}
               </div>
             )}
          </button>
        </div>
      </div>

      {/* History Ribbon */}
      <div className="bg-slate-100 border-t border-slate-200 py-1.5 px-4 flex gap-1 overflow-x-auto scrollbar-hide items-center h-10 w-full justify-center">
        {(history || []).map((h, i) => {
          const winner = h?.result?.winner || h?.winner || (i % 2 === 0 ? 'ANDAR' : 'BAHAR');
          return (
            <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${winner === 'ANDAR' ? 'bg-blue-600' : 'bg-red-600'} border border-slate-200`}>
              {winner === 'ANDAR' ? 'A' : 'B'}
            </div>
          );
        })}
      </div>

      {/* Chip Selector Footer */}
      <div className="bg-white/80 border-t border-slate-200 p-4 sticky bottom-0 z-40 backdrop-blur-md">
         <div className="max-w-3xl mx-auto flex gap-3 justify-center overflow-x-auto pb-1 scrollbar-hide">
            {CHIP_VALUES.map(val => (
              <button 
                key={val}
                onClick={() => setSelectedChips(val)}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex-shrink-0 flex items-center justify-center border-4 shadow-[0_4px_10px_rgba(15,23,42,0.13)] transition-transform ${selectedChips === val ? 'scale-110 -translate-y-2 border-yellow-400 bg-yellow-400/20' : 'border-gray-500 bg-slate-100 opacity-80 hover:opacity-100'}`}
              >
                 <div className="absolute inset-1 border border-slate-200 rounded-full border-dashed" />
                 <span className={`font-black text-sm ${selectedChips === val ? 'text-yellow-600 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'text-slate-600'}`}>{val >= 1000 ? `${val/1000}k` : val}</span>
              </button>
            ))}
         </div>
      </div>
    </div>
  );
}

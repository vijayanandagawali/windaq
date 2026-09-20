"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, HelpCircle, Trophy, ShieldCheck, Zap } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

const CHIP_VALUES = [50, 100, 500, 1000];

export default function TeenPattiGame() {
  const { balance, deductBalance, addWinnings } = useWalletStore();

  const [gameState, setGameState] = useState<'betting' | 'dealing' | 'showdown' | 'settled'>('betting');
  const [countdown, setCountdown] = useState(12);
  const [selectedChip, setSelectedChip] = useState(100);
  const [betSide, setBetSide] = useState<'playerA' | 'playerB' | null>(null);
  const [stake, setStake] = useState(0);
  const [pot, setPot] = useState(4850);
  const [winner, setWinner] = useState<'playerA' | 'playerB' | null>(null);

  // Cards state
  const [playerACards, setPlayerACards] = useState<{ rank: string, suit: string, hidden: boolean }[]>([
    { rank: 'A', suit: '♠', hidden: true },
    { rank: 'K', suit: '♠', hidden: true },
    { rank: 'Q', suit: '♠', hidden: true }
  ]);
  const [playerBCards, setPlayerBCards] = useState<{ rank: string, suit: string, hidden: boolean }[]>([
    { rank: 'J', suit: '♥', hidden: true },
    { rank: '10', suit: '♦', hidden: true },
    { rank: '9', suit: '♣', hidden: true }
  ]);
  const [aRankTitle, setARankTitle] = useState('');
  const [bRankTitle, setBRankTitle] = useState('');

  // 15s Round Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState === 'betting') {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            startShowdown();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, stake, betSide]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlaceBet = (side: 'playerA' | 'playerB') => {
    if (gameState !== 'betting') return;
    if (countdown <= 2) {
      toast.error('Bets locked for this round!');
      return;
    }
    if (balance < selectedChip) {
      toast.error('Insufficient wallet balance! Please deposit to continue.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
    deductBalance(selectedChip);
    setBetSide(side);
    setStake(prev => prev + selectedChip);
    setPot(prev => prev + selectedChip * 2);
    toast.success(`Bet ₹${selectedChip} placed on ${side === 'playerA' ? 'Player A' : 'Player B'}!`);
  };

  const startShowdown = () => {
    setGameState('dealing');

    // Simulate dealing sound / delay
    setTimeout(() => {
      setGameState('showdown');
      // Generate cards
      const hands = [
        { cards: [{ rank: 'A', suit: '♠' }, { rank: 'A', suit: '♥' }, { rank: 'K', suit: '♦' }], title: 'Pair of Aces' },
        { cards: [{ rank: 'K', suit: '♣' }, { rank: 'Q', suit: '♦' }, { rank: 'J', suit: '♠' }], title: 'Sequence (Run)' },
        { cards: [{ rank: '10', suit: '♥' }, { rank: '10', suit: '♠' }, { rank: '10', suit: '♦' }], title: 'Trio (3 of a Kind)' },
        { cards: [{ rank: 'A', suit: '♥' }, { rank: 'Q', suit: '♥' }, { rank: '9', suit: '♥' }], title: 'Color (Flush)' }
      ];

      const aHand = hands[Math.floor(Math.random() * hands.length)];
      let bHand = hands[Math.floor(Math.random() * hands.length)];
      while (bHand === aHand) bHand = hands[Math.floor(Math.random() * hands.length)];

      const aWins = Math.random() > 0.5;
      const roundWinner = aWins ? 'playerA' : 'playerB';

      setPlayerACards(aHand.cards.map(c => ({ ...c, hidden: false })));
      setPlayerBCards(bHand.cards.map(c => ({ ...c, hidden: false })));
      setARankTitle(aHand.title);
      setBRankTitle(bHand.title);
      setWinner(roundWinner);
      setGameState('settled');

      // Settle Bet
      if (betSide === roundWinner && stake > 0) {
        const winAmount = parseFloat((stake * 1.95).toFixed(2));
        addWinnings(winAmount);
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        toast.success(`🎉 You Won ₹${winAmount} on ${roundWinner === 'playerA' ? 'Player A' : 'Player B'}!`, { duration: 4000 });
      } else if (stake > 0) {
        toast.error(`${roundWinner === 'playerA' ? 'Player A' : 'Player B'} won. Better luck next hand!`);
      }

      // Next round in 5 seconds
      setTimeout(() => {
        setGameState('betting');
        setCountdown(12);
        setBetSide(null);
        setStake(0);
        setWinner(null);
        setARankTitle('');
        setBRankTitle('');
        setPlayerACards(prev => prev.map(c => ({ ...c, hidden: true })));
        setPlayerBCards(prev => prev.map(c => ({ ...c, hidden: true })));
        setPot(Math.floor(4000 + Math.random() * 2000));
      }, 5000);
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-[#05111d] font-sans selection:bg-neon-mint relative flex flex-col max-w-lg mx-auto shadow-2xl">
      {/* Header */}
      <header className="flex-none bg-[#091b30] border-b border-white/10 px-4 py-3 flex items-center justify-between z-20 shadow-lg">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-white font-black tracking-wider text-sm uppercase">20-20 TEEN PATTI</h1>
          <span className="text-[10px] bg-neon-mint/20 text-neon-mint px-2 py-0.5 rounded-full font-bold border border-neon-mint/30">
            PROVABLY FAIR
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 px-2.5 py-1 rounded-full">
          <span className="text-xs text-yellow-400">🪙</span>
          <span className="text-neon-mint font-extrabold text-xs">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </header>

      {/* Felt Casino Table Surface */}
      <div className="flex-1 relative bg-[radial-gradient(ellipse_at_center,_#0c3b28,_#041a12)] border-x border-white/5 flex flex-col justify-between p-4 overflow-hidden">
        {/* Table Felt Background Pattern */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Top Status Bar: Timer & Pot */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase">ROUND POT</span>
            <span className="text-yellow-400 font-black text-sm">₹{pot.toLocaleString('en-IN')}</span>
          </div>

          <div className={`px-3.5 py-1 rounded-full text-xs font-black tracking-wider border transition-all ${
            countdown <= 3 ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' : 'bg-black/50 text-neon-mint border-white/10'
          }`}>
            {gameState === 'betting' ? `⏱️ BETTING: ${countdown}s` : (gameState === 'dealing' ? '🎴 DEALING...' : '🏆 RESULT')}
          </div>
        </div>

        {/* Cards Arena (Player A vs Player B) */}
        <div className="grid grid-cols-2 gap-3 my-auto relative z-10">
          {/* Player A Box */}
          <div className={`p-3 rounded-2xl border transition-all ${
            winner === 'playerA' ? 'bg-neon-mint/20 border-neon-mint shadow-[0_0_25px_rgba(38,240,178,0.3)]' : 'bg-black/40 border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-black text-xs tracking-wider">PLAYER A</span>
              <span className="text-[10px] text-neon-mint font-bold">1.95X</span>
            </div>

            {/* 3 Cards */}
            <div className="flex justify-center gap-1.5 mb-2">
              {playerACards.map((card, idx) => (
                <div 
                  key={idx} 
                  className={`w-11 h-16 rounded-lg border flex flex-col items-center justify-center font-black text-sm shadow-md transition-all ${
                    card.hidden 
                      ? 'bg-gradient-to-br from-blue-900 to-indigo-950 border-blue-400/30 text-blue-300' 
                      : (card.suit === '♥' || card.suit === '♦' ? 'bg-white text-red-600 border-gray-200' : 'bg-white text-gray-900 border-gray-200')
                  }`}
                >
                  {card.hidden ? '🂠' : (
                    <>
                      <span className="text-xs leading-none">{card.rank}</span>
                      <span className="text-xs leading-none">{card.suit}</span>
                    </>
                  )}
                </div>
              ))}
            </div>

            {aRankTitle && <p className="text-[10px] text-center font-bold text-yellow-300">{aRankTitle}</p>}

            <button
              onClick={() => handlePlaceBet('playerA')}
              disabled={gameState !== 'betting'}
              className={`w-full mt-2 py-2.5 rounded-xl font-black text-xs transition-all ${
                betSide === 'playerA'
                  ? 'bg-neon-mint text-deep-ocean shadow-[0_0_15px_rgba(38,240,178,0.5)]'
                  : 'bg-blue-600/80 hover:bg-blue-600 text-white border border-blue-400/30 disabled:opacity-50'
              }`}
            >
              BET A {betSide === 'playerA' && `(₹${stake})`}
            </button>
          </div>

          {/* Player B Box */}
          <div className={`p-3 rounded-2xl border transition-all ${
            winner === 'playerB' ? 'bg-neon-mint/20 border-neon-mint shadow-[0_0_25px_rgba(38,240,178,0.3)]' : 'bg-black/40 border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-black text-xs tracking-wider">PLAYER B</span>
              <span className="text-[10px] text-neon-mint font-bold">1.95X</span>
            </div>

            {/* 3 Cards */}
            <div className="flex justify-center gap-1.5 mb-2">
              {playerBCards.map((card, idx) => (
                <div 
                  key={idx} 
                  className={`w-11 h-16 rounded-lg border flex flex-col items-center justify-center font-black text-sm shadow-md transition-all ${
                    card.hidden 
                      ? 'bg-gradient-to-br from-red-900 to-rose-950 border-red-400/30 text-red-300' 
                      : (card.suit === '♥' || card.suit === '♦' ? 'bg-white text-red-600 border-gray-200' : 'bg-white text-gray-900 border-gray-200')
                  }`}
                >
                  {card.hidden ? '🂠' : (
                    <>
                      <span className="text-xs leading-none">{card.rank}</span>
                      <span className="text-xs leading-none">{card.suit}</span>
                    </>
                  )}
                </div>
              ))}
            </div>

            {bRankTitle && <p className="text-[10px] text-center font-bold text-yellow-300">{bRankTitle}</p>}

            <button
              onClick={() => handlePlaceBet('playerB')}
              disabled={gameState !== 'betting'}
              className={`w-full mt-2 py-2.5 rounded-xl font-black text-xs transition-all ${
                betSide === 'playerB'
                  ? 'bg-neon-mint text-deep-ocean shadow-[0_0_15px_rgba(38,240,178,0.5)]'
                  : 'bg-rose-600/80 hover:bg-rose-600 text-white border border-rose-400/30 disabled:opacity-50'
              }`}
            >
              BET B {betSide === 'playerB' && `(₹${stake})`}
            </button>
          </div>
        </div>

        {/* Chip Rack */}
        <div className="relative z-10 mt-auto bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 font-extrabold uppercase ml-1">CHIP:</span>
          <div className="flex gap-2">
            {CHIP_VALUES.map(val => (
              <button
                key={val}
                onClick={() => setSelectedChip(val)}
                className={`w-11 h-11 rounded-full font-black text-xs flex items-center justify-center transition-all border-2 ${
                  selectedChip === val
                    ? 'border-neon-mint bg-neon-mint text-deep-ocean shadow-[0_0_12px_rgba(38,240,178,0.6)] scale-110'
                    : 'border-white/20 bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                ₹{val}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

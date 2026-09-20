"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Coins } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const CHIPS = [10, 50, 100, 1000];

export default function AndarBaharGame() {
  const { balance, deductBalance } = useWalletStore();
  
  const [gameState, setGameState] = useState<'betting' | 'dealing' | 'result'>('betting');
  const [countdown, setCountdown] = useState(15);
  const [selectedChip, setSelectedChip] = useState(10);
  
  // Bets
  const [bets, setBets] = useState({ andar: 0, bahar: 0 });
  const [jokerCard, setJokerCard] = useState<string | null>(null);
  
  // Dealing state
  const [dealtCards, setDealtCards] = useState<{side: 'andar' | 'bahar', card: string}[]>([]);
  const [winner, setWinner] = useState<'andar' | 'bahar' | null>(null);

  // Mock game loop
  useEffect(() => {
    if (gameState === 'betting') {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            startDealing();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState]);

  const startDealing = () => {
    setGameState('dealing');
    setJokerCard('7♠'); // Mock joker
    
    // Mock dealing logic
    let step = 0;
    const dealingInterval = setInterval(() => {
      step++;
      const side = step % 2 === 1 ? 'andar' : 'bahar';
      
      // We mock that Bahar wins on the 4th card
      const isWinner = step === 4;
      const card = isWinner ? '7♥' : `${Math.floor(Math.random() * 9) + 2}♣`;
      
      setDealtCards(prev => [...prev, { side, card }]);
      
      // Haptic sound/feel for card deal
      if (navigator.vibrate) navigator.vibrate(20);
      
      if (isWinner) {
        clearInterval(dealingInterval);
        setTimeout(() => {
          setWinner(side);
          setGameState('result');
        }, 1000);
      }
    }, 800); // Deal every 800ms
  };

  const handlePlaceBet = (side: 'andar' | 'bahar') => {
    if (gameState !== 'betting') {
       toast.error("Bets are closed!");
       return;
    }
    if (balance < selectedChip) {
      toast.error("Insufficient balance!");
      return;
    }
    
    if (navigator.vibrate) navigator.vibrate(50);
    deductBalance(selectedChip);
    setBets(prev => ({ ...prev, [side]: prev[side] + selectedChip }));
    toast.success(`Placed ₹${selectedChip} on ${side.toUpperCase()}`);
  };

  const resetGame = () => {
    setGameState('betting');
    setCountdown(15);
    setBets({ andar: 0, bahar: 0 });
    setJokerCard(null);
    setDealtCards([]);
    setWinner(null);
  };

  return (
    <main className="min-h-screen bg-deep-ocean font-sans selection:bg-neon-mint relative flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-none bg-deep-ocean border-b border-white/5 px-4 py-3 flex items-center justify-between z-20 shadow-lg">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <h1 className="text-white font-bold tracking-widest text-sm uppercase">Andar Bahar</h1>
        <Info size={20} className="text-gray-400" />
      </header>

      {/* Virtual Felt Table Area */}
      <div className="flex-1 relative bg-[radial-gradient(ellipse_at_center,_#0A2A5A,_#050814)] shadow-inner">
         <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/black-felt.png')]" />
         
         {/* Timer / Status */}
         <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
           {gameState === 'betting' && (
             <div className="bg-black/50 backdrop-blur border border-neon-mint/30 px-6 py-2 rounded-full flex flex-col items-center shadow-[0_0_15px_rgba(0,255,163,0.2)]">
               <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold mb-0.5">Place Your Bets</span>
               <span className={`text-xl font-black ${countdown <= 5 ? 'text-red-500 animate-ping' : 'text-neon-mint'}`}>
                 00:{countdown.toString().padStart(2, '0')}
               </span>
             </div>
           )}
           {gameState === 'dealing' && (
             <div className="bg-black/50 backdrop-blur border border-blue-500/30 px-6 py-2 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.2)]">
               <span className="text-sm text-blue-400 uppercase tracking-widest font-bold animate-pulse">Dealing Cards...</span>
             </div>
           )}
           {gameState === 'result' && winner && (
             <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-neon-mint text-deep-ocean border-2 border-white px-8 py-3 rounded-full shadow-[0_0_30px_rgba(0,255,163,0.8)]"
             >
               <span className="text-lg uppercase tracking-widest font-black">{winner} WINS!</span>
             </motion.div>
           )}
         </div>

         {/* Joker Card */}
         <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">Joker Card</span>
            <div className="w-16 h-24 bg-white rounded-lg border-2 border-gray-300 shadow-2xl flex items-center justify-center relative">
               {jokerCard ? (
                 <span className={`text-3xl font-bold ${jokerCard.includes('♥') || jokerCard.includes('♦') ? 'text-red-600' : 'text-black'}`}>{jokerCard}</span>
               ) : (
                 <div className="w-full h-full bg-[radial-gradient(circle,_#1e3a8a,_#172554)] rounded flex items-center justify-center opacity-80" />
               )}
            </div>
         </div>

         {/* Dealing Areas */}
         <div className="absolute bottom-6 left-0 right-0 flex justify-between px-6 z-10">
            {/* Andar */}
            <div className="flex flex-col items-center">
              <span className="text-blue-400 font-bold uppercase tracking-widest mb-2 text-xs">Andar</span>
              <div className="flex flex-wrap gap-[-10px] justify-center w-24 h-24">
                <AnimatePresence>
                  {dealtCards.filter(c => c.side === 'andar').map((card, i) => (
                    <motion.div 
                      key={`andar-${i}`}
                      initial={{ x: 100, y: -150, rotateY: 180, scale: 0.5 }}
                      animate={{ x: 0, y: 0, rotateY: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 150, damping: 20 }}
                      className="w-12 h-16 bg-white rounded border border-gray-300 flex items-center justify-center shadow-lg -ml-6 first:ml-0 mt-2"
                      style={{ zIndex: i }}
                    >
                      <span className={`font-bold ${card.card.includes('♥') || card.card.includes('♦') ? 'text-red-600' : 'text-black'}`}>{card.card}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Bahar */}
            <div className="flex flex-col items-center">
              <span className="text-red-400 font-bold uppercase tracking-widest mb-2 text-xs">Bahar</span>
              <div className="flex flex-wrap gap-[-10px] justify-center w-24 h-24">
                <AnimatePresence>
                  {dealtCards.filter(c => c.side === 'bahar').map((card, i) => (
                    <motion.div 
                      key={`bahar-${i}`}
                      initial={{ x: -100, y: -150, rotateY: 180, scale: 0.5 }}
                      animate={{ x: 0, y: 0, rotateY: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 150, damping: 20 }}
                      className="w-12 h-16 bg-white rounded border border-gray-300 flex items-center justify-center shadow-lg -ml-6 first:ml-0 mt-2"
                      style={{ zIndex: i }}
                    >
                      <span className={`font-bold ${card.card.includes('♥') || card.card.includes('♦') ? 'text-red-600' : 'text-black'}`}>{card.card}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
         </div>
      </div>

      {/* Betting Controls */}
      <div className="flex-none bg-deep-ocean p-4 pb-safe rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-20">
        
        {/* Play Again (If result) */}
        {gameState === 'result' && (
          <div className="absolute bottom-[200px] left-0 right-0 flex justify-center z-30">
             <button onClick={resetGame} className="btn-neon px-8 py-3 rounded-full text-lg shadow-2xl">
               Next Round
             </button>
          </div>
        )}

        {/* Betting Grid */}
        <div className="flex gap-4 mb-4">
          <button 
            onClick={() => handlePlaceBet('andar')}
            className="flex-1 glass-card border border-blue-500/30 p-4 flex flex-col items-center justify-center relative overflow-hidden group active:scale-95 transition-transform"
          >
            <span className="text-blue-400 font-black text-xl mb-1 uppercase tracking-wider">A</span>
            <span className="text-white text-xs font-bold">1.90x</span>
            {bets.andar > 0 && (
              <div className="absolute top-2 right-2 bg-neon-mint text-deep-ocean text-[10px] font-bold px-2 py-0.5 rounded-full">
                ₹{bets.andar}
              </div>
            )}
            {gameState !== 'betting' && <div className="absolute inset-0 bg-black/50 z-10" />}
          </button>
          
          <button 
            onClick={() => handlePlaceBet('bahar')}
            className="flex-1 glass-card border border-red-500/30 p-4 flex flex-col items-center justify-center relative overflow-hidden group active:scale-95 transition-transform"
          >
            <span className="text-red-400 font-black text-xl mb-1 uppercase tracking-wider">B</span>
            <span className="text-white text-xs font-bold">2.00x</span>
            {bets.bahar > 0 && (
              <div className="absolute top-2 right-2 bg-neon-mint text-deep-ocean text-[10px] font-bold px-2 py-0.5 rounded-full">
                ₹{bets.bahar}
              </div>
            )}
            {gameState !== 'betting' && <div className="absolute inset-0 bg-black/50 z-10" />}
          </button>
        </div>

        {/* Chip Selector */}
        <div className="flex items-center justify-between px-2 mb-2">
          {CHIPS.map(chip => (
            <button 
              key={chip}
              onClick={() => setSelectedChip(chip)}
              className={`w-12 h-12 rounded-full flex flex-col items-center justify-center transition-all ${
                selectedChip === chip 
                  ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 border-2 border-white shadow-[0_0_15px_rgba(253,224,71,0.6)] scale-110 z-10' 
                  : 'bg-gradient-to-br from-gray-600 to-gray-800 border border-gray-400 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="w-8 h-8 rounded-full border border-black/20 flex items-center justify-center">
                 <span className={`text-[10px] font-black ${selectedChip === chip ? 'text-black' : 'text-white'}`}>{chip}</span>
              </div>
            </button>
          ))}
        </div>
        
        <div className="text-center pt-2 border-t border-white/5 mt-4">
          <span className="text-gray-400 text-xs font-bold">Balance: <span className="text-neon-mint">₹{balance.toFixed(2)}</span></span>
        </div>
      </div>
    </main>
  );
}

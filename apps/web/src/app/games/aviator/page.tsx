"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, HelpCircle, ShieldCheck } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { io, Socket } from '@/lib/gameSocket';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { createGameSocket } from '@/lib/config';
import { audioEngine } from '@/lib/audioEngine';
import { useAuthStore } from '@/store/authStore';

export default function AviatorGame() {
  const { balance, deductBalance, addWinnings, userId } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Game State
  const [gameState, setGameState] = useState<'waiting' | 'flying' | 'crashed'>('waiting');
  const [multiplier, setMultiplier] = useState<string>('1.00');
  const [countdown, setCountdown] = useState(0);
  const [provablyFairHash, setProvablyFairHash] = useState('');
  
  // Betting Panels State (Dual Panels)
  const [bet1, setBet1] = useState<{ amount: number, placed: boolean, cashedOut: boolean, won: number, autoCashout: number }>({ amount: 100, placed: false, cashedOut: false, won: 0, autoCashout: 0 });
  const [bet2, setBet2] = useState<{ amount: number, placed: boolean, cashedOut: boolean, won: number, autoCashout: number }>({ amount: 0, placed: false, cashedOut: false, won: 0, autoCashout: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize WebSockets
  useEffect(() => {
    const newSocket = createGameSocket();
    setSocket(newSocket);

    newSocket.emit('join_room', 'aviator');

    newSocket.on('aviator:waiting', (data) => {
      setGameState('waiting');
      setCountdown(data.countdown);
      if (data.hash) setProvablyFairHash(data.hash);
      if (data.countdown <= 3 && data.countdown > 0) {
        audioEngine.play('countdown', { urgent: true });
      }
      
      // Reset bets for new round if they were not placed for *next* round
      setBet1(prev => ({ ...prev, cashedOut: false, won: 0, placed: prev.placed && !prev.cashedOut ? true : false }));
      setBet2(prev => ({ ...prev, cashedOut: false, won: 0, placed: prev.placed && !prev.cashedOut ? true : false }));
    });

    newSocket.on('aviator:tick', (data) => {
      setGameState(prev => {
        if (prev !== 'flying') {
          audioEngine.play('roundStart');
        }
        return 'flying';
      });
      setMultiplier(data.multiplier);
      drawCurve(parseFloat(data.multiplier));
    });

    newSocket.on('aviator:crashed', (data) => {
      setGameState('crashed');
      setMultiplier(data.multiplier);
      drawCrashed(parseFloat(data.multiplier));
      audioEngine.play('loss');
      
      // Reset placed status for next round
      setBet1(prev => ({ ...prev, placed: false }));
      setBet2(prev => ({ ...prev, placed: false }));
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Auto Cashout Logic check on every tick
  useEffect(() => {
    if (gameState === 'flying') {
      const currentMulti = parseFloat(multiplier);
      
      if (bet1.placed && !bet1.cashedOut && bet1.autoCashout > 1 && currentMulti >= bet1.autoCashout) {
        handleCashout(1, currentMulti);
      }
      if (bet2.placed && !bet2.cashedOut && bet2.autoCashout > 1 && currentMulti >= bet2.autoCashout) {
        handleCashout(2, currentMulti);
      }
    }
  }, [multiplier, gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas Drawing Logic
  const drawCurve = (currentMulti: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Parabolic Curve math
    const progress = Math.min(1, Math.log10(currentMulti) / 2); // 0 to 1
    const x = progress * (canvas.width - 60);
    const y = canvas.height - (progress * (canvas.height - 60));

    // Under-curve glowing neon fill
    const fillGrad = ctx.createLinearGradient(0, y, 0, canvas.height);
    fillGrad.addColorStop(0, 'rgba(0, 255, 163, 0.35)');
    fillGrad.addColorStop(0.5, 'rgba(0, 255, 163, 0.1)');
    fillGrad.addColorStop(1, 'rgba(0, 255, 163, 0.0)');
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.quadraticCurveTo(x * 0.5, canvas.height, x, y);
    ctx.lineTo(x, canvas.height);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // The Stroke Curve
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.quadraticCurveTo(x * 0.5, canvas.height, x, y);
    ctx.strokeStyle = '#00FFA3';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00FFA3';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Aerodynamic Jet Plane Sprite
    ctx.save();
    ctx.translate(x, y);
    
    // Flight angle tangent
    const angle = -Math.PI / 6 * (1 - progress * 0.3); // Smooth upward angle
    ctx.rotate(angle);

    // Jet Engine Exhaust Flame
    const flameLen = 14 + Math.random() * 10;
    const flameGrad = ctx.createLinearGradient(-15 - flameLen, 0, -15, 0);
    flameGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
    flameGrad.addColorStop(0.5, '#f59e0b');
    flameGrad.addColorStop(1, '#fde047');

    ctx.beginPath();
    ctx.moveTo(-15, -3);
    ctx.lineTo(-15 - flameLen, 0);
    ctx.lineTo(-15, 3);
    ctx.closePath();
    ctx.fillStyle = flameGrad;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Aircraft Fuselage (Sleek Red Jet)
    ctx.beginPath();
    ctx.moveTo(22, 0); // Nose tip
    ctx.quadraticCurveTo(8, -6, -14, -5); // Top curve
    ctx.lineTo(-16, 0); // Tail
    ctx.lineTo(-14, 5); // Bottom curve
    ctx.quadraticCurveTo(8, 6, 22, 0);
    ctx.closePath();
    ctx.fillStyle = '#dc2626'; // Deep Red
    ctx.fill();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Swept Wing
    ctx.beginPath();
    ctx.moveTo(2, -4);
    ctx.lineTo(-8, -18);
    ctx.lineTo(-14, -16);
    ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.fillStyle = '#b91c1c';
    ctx.fill();

    // Cockpit Window Glass
    ctx.beginPath();
    ctx.ellipse(8, -2, 6, 2.5, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#67e8f9'; // Cyan glass
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  };

  const drawCrashed = (finalMulti: number) => {
    drawCurve(finalMulti);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      const progress = Math.min(1, Math.log10(finalMulti) / 2);
      const x = progress * (canvas.width - 60);
      const y = canvas.height - (progress * (canvas.height - 60));

      // Explosion Radial Shockwave
      const explGrad = ctx.createRadialGradient(x, y, 5, x, y, 90);
      explGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      explGrad.addColorStop(0.2, 'rgba(250, 204, 21, 0.8)');
      explGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.6)');
      explGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      
      ctx.beginPath();
      ctx.arc(x, y, 90, 0, Math.PI * 2);
      ctx.fillStyle = explGrad;
      ctx.fill();

      // Screen Flash
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Actions
  const handlePlaceBet = (panel: 1 | 2, amount: number) => {
    const authState = useAuthStore.getState();
    if (!authState.isAuthenticated || !authState.user) {
      toast.error("Please login to place bets!");
      authState.openAuthModal('LOGIN');
      return;
    }

    if (balance < amount) {
      toast.error("Insufficient balance!");
      return;
    }
    
    audioEngine.play('bet');
    
    deductBalance(amount);
    if (socket) {
      socket.emit('place_bet', { amount, userId: authState.user.id });
    }
    toast.success(`Bet placed: ₹${amount}`);
    
    if (panel === 1) setBet1(prev => ({ ...prev, amount, placed: true }));
    else setBet2(prev => ({ ...prev, amount, placed: true }));
  };

  const handleCashout = (panel: 1 | 2, currentMulti: number) => {
    const authUser = useAuthStore.getState().user;
    audioEngine.play('win');
    
    // Confetti
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#00FFA3', '#FFFFFF']
    });

    const targetBet = panel === 1 ? bet1 : bet2;
    const winAmount = targetBet.amount * currentMulti;
    addWinnings(winAmount);

    if (socket && authUser) {
      socket.emit('aviator:cashout', { 
        amount: targetBet.amount, 
        multiplier: currentMulti, 
        winAmount, 
        userId: authUser.id 
      });
    }

    if (panel === 1) setBet1(prev => ({ ...prev, cashedOut: true, won: winAmount }));
    else setBet2(prev => ({ ...prev, cashedOut: true, won: winAmount }));
    
    toast.success(`Cashed Out! You won ₹${winAmount.toFixed(2)}`);
  };

  return (
    <div className="min-h-[calc(100dvh-58px)] bg-obsidian font-sans selection:bg-neon-mint selection:text-deep-ocean relative flex flex-col overflow-y-auto">


      {/* Game Area (The Canvas & Multiplier) */}
      <div className={`relative flex-1 flex flex-col justify-center items-center overflow-hidden transition-colors duration-300 ${gameState === 'crashed' ? 'bg-red-950/20' : 'bg-ocean-card/30'}`}>
        {/* Provably fair hash display */}
        <div className="absolute top-2 left-4 text-[10px] text-gray-500 flex items-center gap-1 font-mono">
           <ShieldCheck size={10} className="text-green-500" />
           {provablyFairHash ? `Hash: ${provablyFairHash.substring(0, 12)}...` : 'Connecting RNG...'}
        </div>

        <canvas 
          ref={canvasRef} 
          width={800} 
          height={400} 
          className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-60"
        />
        
        {/* Multiplier Display */}
        <div className="relative z-10 flex flex-col items-center">
          <AnimatePresence mode="wait">
            {gameState === 'waiting' ? (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <div className="w-16 h-16 relative flex items-center justify-center mb-4">
                  <svg className="animate-spin text-neon-mint w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="absolute font-bold text-xl text-white">{countdown}</span>
                </div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Waiting for next round</p>
              </motion.div>
            ) : (
              <motion.div 
                key="multiplier"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <h1 className={`text-7xl md:text-9xl font-black tracking-tighter transition-colors duration-300 ${
                  gameState === 'crashed' 
                    ? 'text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.9)] animate-pulse' 
                    : parseFloat(multiplier) >= 10.0
                    ? 'text-purple-400 drop-shadow-[0_0_25px_rgba(192,132,252,0.8)]'
                    : parseFloat(multiplier) >= 2.0
                    ? 'text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.7)]'
                    : 'text-neon-mint drop-shadow-[0_0_20px_rgba(0,255,163,0.6)]'
                }`}>
                  {multiplier}x
                </h1>
                {gameState === 'crashed' && (
                  <motion.p 
                    initial={{ scale: 0.5 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="text-red-400 font-black text-xl uppercase tracking-widest mt-3 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                  >
                    💥 FLEW AWAY!
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Betting Panels (Dual) */}
      <div className="flex-none bg-deep-ocean p-2 pb-safe rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-20">
        <div className="flex justify-between items-center px-4 py-2 border-b border-white/5 mb-2">
           <span className="text-gray-400 text-xs font-bold">Balance: <span className="text-neon-mint">₹{balance.toFixed(2)}</span></span>
        </div>
        
        <div className="flex gap-2 p-2">
          <BetPanel 
            panelNum={1}
            betState={bet1}
            setBetState={setBet1}
            gameState={gameState}
            currentMulti={parseFloat(multiplier)}
            onPlaceBet={() => handlePlaceBet(1, bet1.amount)}
            onCashout={() => handleCashout(1, parseFloat(multiplier))}
          />
          <BetPanel 
            panelNum={2}
            betState={bet2}
            setBetState={setBet2}
            gameState={gameState}
            currentMulti={parseFloat(multiplier)}
            onPlaceBet={() => handlePlaceBet(2, bet2.amount)}
            onCashout={() => handleCashout(2, parseFloat(multiplier))}
          />
        </div>
      </div>
    </div>
  );
}

// Subcomponent for each betting panel
function BetPanel({ panelNum, betState, setBetState, gameState, currentMulti, onPlaceBet, onCashout }: any) {
  
  const incrementAmount = (val: number) => setBetState({ ...betState, amount: betState.amount + val });

  return (
    <div className="flex-1 glass-card bg-ocean-card/80 border border-white/10 rounded-xl p-2 relative overflow-hidden">
      {/* Won Overlay */}
      {betState.cashedOut && (
        <div className="absolute inset-0 bg-green-500/20 backdrop-blur-sm z-10 flex flex-col items-center justify-center border border-green-500/50 rounded-xl">
           <p className="text-green-400 font-bold text-xs uppercase tracking-wider mb-1">Cashed Out</p>
           <h3 className="text-white font-black text-xl">₹{betState.won.toFixed(2)}</h3>
        </div>
      )}

      {/* Top row: Auto cashout toggle (simplified) */}
      <div className="flex justify-between items-center mb-2 px-1">
        <label className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
          Auto:
          <input 
            type="number" 
            step="0.1" 
            placeholder="Off" 
            value={betState.autoCashout || ''} 
            onChange={(e) => setBetState({...betState, autoCashout: parseFloat(e.target.value) || 0})}
            className="w-12 bg-black/40 border border-white/10 rounded px-1 text-white text-xs text-center"
            disabled={betState.placed}
          />
          x
        </label>
      </div>

      {/* Input amount */}
      <div className="bg-black/40 rounded-lg p-2 flex items-center justify-between mb-2 border border-white/5">
        <button onClick={() => setBetState({...betState, amount: Math.max(10, betState.amount - 10)})} disabled={betState.placed} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">-</button>
        <span className="text-white font-bold text-lg">₹{betState.amount}</span>
        <button onClick={() => setBetState({...betState, amount: betState.amount + 10})} disabled={betState.placed} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">+</button>
      </div>

      {/* Quick chips */}
      <div className="grid grid-cols-2 gap-1 mb-2">
        <button onClick={() => incrementAmount(100)} disabled={betState.placed} className="bg-white/5 hover:bg-white/10 rounded py-1 text-gray-300 text-xs font-bold disabled:opacity-50">+100</button>
        <button onClick={() => incrementAmount(500)} disabled={betState.placed} className="bg-white/5 hover:bg-white/10 rounded py-1 text-gray-300 text-xs font-bold disabled:opacity-50">+500</button>
      </div>

      {/* Big Action Button */}
      {!betState.placed ? (
        <button 
          data-testid={`aviator-bet-btn-${panelNum}`}
          onClick={onPlaceBet}
          disabled={gameState === 'flying'}
          className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wide transition-all ${gameState === 'flying' ? 'bg-gray-700 text-gray-400' : 'btn-neon'}`}
        >
          {gameState === 'waiting' ? 'BET' : 'Waiting...'}
        </button>
      ) : (
        <button 
          data-testid={`aviator-cashout-btn-${panelNum}`}
          onClick={onCashout}
          disabled={gameState === 'crashed' || gameState === 'waiting'}
          className={`w-full py-3 rounded-lg font-black text-sm uppercase tracking-wide transition-all shadow-[0_0_15px_rgba(255,165,0,0.5)] bg-gradient-to-r from-yellow-500 to-orange-500 text-white ${gameState === 'crashed' || gameState === 'waiting' ? 'opacity-50' : ''}`}
        >
          CASH OUT <br/>
          <span className="text-xs font-bold opacity-90">₹{(betState.amount * currentMulti).toFixed(2)}</span>
        </button>
      )}
    </div>
  );
}

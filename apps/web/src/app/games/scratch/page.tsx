"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Eraser } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import WinLossCelebration from '@/components/games/WinLossCelebration';

const TIERS = [
  { id: 'Silver', name: 'Silver Ticket', price: 50, color: 'from-gray-300 to-gray-500', maxWin: '5,000' },
  { id: 'Gold', name: 'Gold Ticket', price: 200, color: 'from-yellow-300 to-yellow-600', maxWin: '20,000' },
  { id: 'Diamond', name: 'Diamond Ticket', price: 1000, color: 'from-cyan-300 to-blue-600', maxWin: '100,000' }
];

export default function ScratchGame() {
  const { balance, deductBalance, setBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [grid, setGrid] = useState<string[]>([]);
  const [payout, setPayout] = useState<number>(0); // Store payout from buy, but don't add to balance yet
  const [isRevealed, setIsRevealed] = useState(false);
  const [buying, setBuying] = useState(false);
  const [celebration, setCelebration] = useState<{ type: 'win' | 'loss'; amount: number; multiplier?: string } | null>(null);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scratchedPercentage, setScratchedPercentage] = useState(0);
  const isDrawing = useRef(false);

  // Init Socket
  useEffect(() => {
    const s = io('http://localhost:4000', { auth: { token: null } });
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  // Initialize Canvas Scratch Layer
  useEffect(() => {
    if (activeTier && ticketId && !isRevealed && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const tierData = TIERS.find(t => t.id === activeTier);
      
      // Fill with metallic gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      if (activeTier === 'Silver') {
        gradient.addColorStop(0, '#e5e7eb'); gradient.addColorStop(1, '#9ca3af');
      } else if (activeTier === 'Gold') {
        gradient.addColorStop(0, '#fde047'); gradient.addColorStop(1, '#ca8a04');
      } else {
        gradient.addColorStop(0, '#67e8f9'); gradient.addColorStop(1, '#2563eb');
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add text
      ctx.fillStyle = '#00000040';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCRATCH TO REVEAL', canvas.width / 2, canvas.height / 2);
    }
  }, [activeTier, ticketId, isRevealed]);

  const handleBuy = (tierId: string) => {
    const tier = TIERS.find(t => t.id === tierId);
    if (!tier || balance < tier.price || !socket) return;

    setBuying(true);
    deductBalance(tier.price);

    socket.emit('scratch:buy', { userId: 'guest', tierId }, (res: any) => {
      setBuying(false);
      if (res.success) {
        setTicketId(res.data.ticketId);
        setGrid(res.data.grid);
        setPayout(res.data.payout);
        setActiveTier(tierId);
        setIsRevealed(false);
        setScratchedPercentage(0);
        setBalance(Number(res.data.newBalance) / 100); // Sync balance
      } else {
        toast.error(res.message);
        setBalance(balance); // Revert
      }
    });
  };

  const handleRevealAll = () => {
    if (isRevealed || !ticketId || !socket) return;
    
    // Clear canvas visually
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    confetti({
      particleCount: 50,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#fde047', '#e5e7eb', '#38bdf8']
    });
    
    finalizeReveal();
  };

  const finalizeReveal = () => {
    setIsRevealed(true);
    
    socket?.emit('scratch:reveal', { userId: 'guest', ticketId }, (res: any) => {
      if (res.success) {
        setBalance(Number(res.data.newBalance) / 100);
        const currentTierObj = TIERS.find(t => t.id === activeTier);
        const tierCost = currentTierObj ? currentTierObj.price : 50;
        if (res.data.payout > 0) {
          triggerWin(res.data.payout);
          setCelebration({
            type: 'win',
            amount: res.data.payout,
            multiplier: `${(res.data.payout / tierCost).toFixed(1)}x`
          });
        } else {
          setCelebration({
            type: 'loss',
            amount: tierCost
          });
        }
      }
    });
  };

  const triggerWin = (amount: number) => {
    toast.success(`You won ₹${amount}!`, { icon: '🎉' });
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
  };

  // Canvas Drawing Handlers
  const handlePointerDown = () => { isDrawing.current = true; };
  const handlePointerUp = () => { isDrawing.current = false; checkScratchedArea(); };
  
  const lastSparkleTime = useRef(0);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || isRevealed || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    // Scratch with realistic coin-edge jitter
    ctx.beginPath();
    ctx.arc(x + (Math.random() * 4 - 2), y + (Math.random() * 4 - 2), 24, 0, Math.PI * 2);
    ctx.fill();

    // Glitter sparkle throttle (every 120ms)
    const now = Date.now();
    if (now - lastSparkleTime.current > 120) {
      lastSparkleTime.current = now;
      confetti({
        particleCount: 3,
        spread: 30,
        origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight },
        colors: ['#fde047', '#e5e7eb', '#93c5fd'],
        scalar: 0.5,
        ticks: 40
      });
    }
  };

  const checkScratchedArea = () => {
    if (isRevealed || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    
    // Check every 4th pixel (alpha channel)
    for (let i = 3; i < pixels.length; i += 16) {
      if (pixels[i] === 0) transparent++;
    }
    
    const percent = (transparent / (pixels.length / 16)) * 100;
    setScratchedPercentage(percent);

    if (percent > 60) {
      handleRevealAll();
    }
  };

  const formatSymbol = (sym: string) => {
    if (!sym) return '❌';
    if (sym.includes('k')) return `₹${sym}`;
    return `₹${sym}`;
  };

  return (
    <main className="min-h-screen bg-[#0a0f1a] font-sans selection:bg-neon-mint flex flex-col pb-safe">
      <header className="flex-none bg-black/40 border-b border-white/5 px-4 py-3 flex items-center justify-between z-20">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <h1 className="text-white font-bold tracking-widest text-sm uppercase">Scratch Cards</h1>
        <button className="p-2 rounded-full hover:bg-white/10 text-white">
          <Info size={20}/>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center pb-24 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-deep-ocean to-[#0a0f1a] pointer-events-none" />

        {/* Balance Display */}
        <div className="bg-black/50 border border-white/10 rounded-full px-6 py-2 mb-8 z-10">
          <span className="text-gray-400 text-sm mr-2">Balance:</span>
          <span className="text-neon-mint font-bold text-lg">₹{balance.toFixed(2)}</span>
        </div>

        {!activeTier ? (
          /* Lobby / Store */
          <div className="w-full max-w-md space-y-6 z-10">
            {TIERS.map(tier => (
              <motion.div 
                key={tier.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-[2px] rounded-2xl bg-gradient-to-br ${tier.color} shadow-lg`}
              >
                <div className="bg-black/90 p-5 rounded-[14px] flex justify-between items-center h-full">
                  <div>
                    <h3 className={`text-xl font-black uppercase bg-gradient-to-r ${tier.color} text-transparent bg-clip-text`}>
                      {tier.name}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">Win up to ₹{tier.maxWin}!</p>
                  </div>
                  <button 
                    disabled={buying || balance < tier.price}
                    onClick={() => handleBuy(tier.id)}
                    className={`px-6 py-3 rounded-xl font-black bg-gradient-to-r ${tier.color} text-black disabled:opacity-50`}
                  >
                    ₹{tier.price}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Active Ticket */
          <motion.div 
            initial={{ opacity: 0, y: 50, rotateX: 20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            className="w-full max-w-sm z-10 flex flex-col items-center"
          >
            <div className={`w-full p-[3px] rounded-2xl bg-gradient-to-br ${TIERS.find(t=>t.id===activeTier)?.color} shadow-2xl mb-6 relative`}>
              
              {/* The Ticket Itself */}
              <div className="bg-gradient-to-b from-gray-900 to-black p-4 rounded-xl min-h-[300px] flex flex-col relative overflow-hidden">
                <div className="text-center mb-4">
                  <h2 className={`text-2xl font-black uppercase tracking-widest bg-gradient-to-r ${TIERS.find(t=>t.id===activeTier)?.color} text-transparent bg-clip-text`}>
                    {activeTier} TICKET
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">Match 3 amounts to win!</p>
                </div>

                {/* 3x3 Grid Area */}
                <div className="relative flex-1 bg-white/5 rounded-xl border border-white/10 p-2">
                  
                  {/* Hidden Result Grid */}
                  <div className="grid grid-cols-3 grid-rows-3 gap-2 h-full absolute inset-2">
                    {grid.map((sym, i) => (
                       <div key={i} className="bg-black rounded-lg flex items-center justify-center border border-white/5 shadow-inner">
                         <span className="text-lg font-black text-white">{formatSymbol(sym)}</span>
                       </div>
                    ))}
                  </div>

                  {/* Scratchable Canvas Overlay */}
                  {!isRevealed && (
                    <canvas
                      ref={canvasRef}
                      width={280}
                      height={200}
                      className="absolute inset-0 w-full h-full rounded-xl touch-none cursor-crosshair z-20"
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            {!isRevealed ? (
              <button 
                onClick={handleRevealAll}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
              >
                <Eraser size={20} />
                Reveal All
              </button>
            ) : (
              <button 
                onClick={() => setActiveTier(null)}
                className="px-8 py-3 rounded-full bg-neon-mint text-black font-black uppercase tracking-widest"
              >
                Play Again
              </button>
            )}
          </motion.div>
        )}
      </div>

      <WinLossCelebration
        celebration={celebration}
        onComplete={() => setCelebration(null)}
      />
    </main>
  );
}

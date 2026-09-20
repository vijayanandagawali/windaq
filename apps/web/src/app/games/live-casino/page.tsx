"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Maximize2, Volume2, ShieldCheck, History, Clock } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import UniversalBetPanel from '@/components/games/UniversalBetPanel';

export default function LiveCasino() {
  const { balance, fetchBalance, userId } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [selectedChip, setSelectedChip] = useState(100);
  const [bets, setBets] = useState<{ [key: string]: number }>({});
  const [gameState, setGameState] = useState<any>({
    status: 'BETTING_OPEN',
    roundId: 'live_init',
    timeLeft: 15
  });

  const [selectedMarket, setSelectedMarket] = useState<string>('RED');
  const [selectedOdds, setSelectedOdds] = useState<number>(2.0);

  useEffect(() => {
    fetchBalance();

    const s = io('http://localhost:4000', { 
      transports: ['websocket', 'polling'],
      auth: { token: null } 
    });
    setSocket(s);

    s.on('connect', () => {
      s.emit('live:join', { tableId: 'live-roulette-1' }, (res: any) => {
        if (res && res.success && res.state) {
          setGameState(res.state);
        }
      });
    });

    s.on('live:state', (data: any) => {
      setGameState(data);
      if (data.status === 'SETTLED') {
        setTimeout(() => fetchBalance(), 1000);
        if (data.result?.number !== undefined) {
          toast.success(`Result: ${data.result.number}`, { icon: '🎯' });
        }
        setTimeout(() => setBets({}), 3000);
      }
      if (data.status === 'BETTING_OPEN') {
        setBets({});
      }
    });

    return () => {
      s.disconnect();
    };
  }, [fetchBalance]);

  const handlePlaceBet = (spot: string, targets: number[] = [1]) => {
    if (balance < selectedChip) {
      toast.error("Insufficient balance!");
      return;
    }
    
    if (navigator.vibrate) navigator.vibrate(50);
    setBets(prev => ({
      ...prev,
      [spot]: (prev[spot] || 0) + selectedChip
    }));

    if (socket) {
      const activeUser = userId || (typeof window !== 'undefined' ? (localStorage.getItem('windaq_user_id') || 'guest') : 'guest');
      socket.emit('live:bet', {
        tableId: 'live-roulette-1',
        userId: activeUser,
        market: spot,
        targets,
        amount: selectedChip
      }, (res: any) => {
        if (res && !res.success) {
          toast.error(res.message || 'Bet rejected');
        } else {
          toast.success(`₹${selectedChip} placed on ${spot}`);
          fetchBalance();
        }
      });
    }
  };

  const isBettingOpen = gameState?.status === 'BETTING_OPEN';

  return (
    <main className="min-h-screen bg-black font-sans selection:bg-neon-mint flex flex-col">
      {/* Video Stream Area (Top Half) */}
      <div className="relative w-full h-[40vh] md:h-[45vh] bg-gray-900 border-b-2 border-neon-mint/50 overflow-hidden">
        <video 
          className="w-full h-full object-cover opacity-70 mix-blend-screen"
          autoPlay 
          muted 
          loop 
          playsInline
          poster="https://images.unsplash.com/photo-1596838132731-3301c3fd4317?q=80&w=1000&auto=format&fit=crop"
        >
          <source src="https://assets.mixkit.co/videos/preview/mixkit-playing-roulette-in-a-casino-8987-large.mp4" type="video/mp4" />
        </video>
        
        {/* Stream Overlay UI */}
        <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/80 via-transparent to-black/60">
           <header className="flex items-center justify-between z-20">
              <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 bg-black/40 backdrop-blur">
                <ChevronLeft size={24} className="text-white" />
              </Link>
              <div className="flex items-center gap-2">
                 <div className="bg-red-600 px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-1 animate-pulse">
                   <div className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE DEALER STUDIO
                 </div>
                 <div className="bg-black/40 backdrop-blur p-2 rounded-full"><Volume2 size={16} className="text-white" /></div>
                 <div className="bg-black/40 backdrop-blur p-2 rounded-full"><Maximize2 size={16} className="text-white" /></div>
              </div>
           </header>
           
           <div className="text-center pb-2">
              <h2 className="text-white font-black text-2xl tracking-widest drop-shadow-lg shadow-black">VIP LIVE ROULETTE</h2>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Clock size={14} className={isBettingOpen ? "text-neon-mint animate-pulse" : "text-red-400"} />
                <span className={`text-xs font-bold uppercase tracking-wider ${isBettingOpen ? "text-neon-mint" : "text-red-400"}`}>
                  {isBettingOpen ? "Betting Open" : (gameState?.status || "In Progress")}
                </span>
              </div>
           </div>
        </div>
      </div>

      {/* Betting Grid Area (Bottom Half) */}
      <div className="flex-1 bg-deep-ocean flex flex-col justify-between p-4 pb-safe relative">
        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono mb-2">
           <span className="flex items-center gap-1">
             <ShieldCheck size={11} className="text-green-500" /> Server-Authoritative Studio Table
           </span>
           <span className="text-neon-mint font-bold">Balance: ₹{balance.toFixed(2)}</span>
        </div>

        {/* Simplified Roulette Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-3 gap-1 mb-1">
             <button onClick={() => { setSelectedMarket('1-12'); setSelectedOdds(3.0); handlePlaceBet('1-12', [1,2,3,4,5,6,7,8,9,10,11,12]); }} className="bet-spot bg-green-900/40 border border-green-500/30 p-2 text-white">1st 12 (3x)</button>
             <button onClick={() => { setSelectedMarket('13-24'); setSelectedOdds(3.0); handlePlaceBet('13-24', [13,14,15,16,17,18,19,20,21,22,23,24]); }} className="bet-spot bg-green-900/40 border border-green-500/30 p-2 text-white">2nd 12 (3x)</button>
             <button onClick={() => { setSelectedMarket('25-36'); setSelectedOdds(3.0); handlePlaceBet('25-36', [25,26,27,28,29,30,31,32,33,34,35,36]); }} className="bet-spot bg-green-900/40 border border-green-500/30 p-2 text-white">3rd 12 (3x)</button>
          </div>
          <div className="grid grid-cols-6 gap-1 h-28 my-1">
             {[...Array(18)].map((_, i) => {
               const num = i + 1;
               const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num);
               return (
                 <button 
                   key={num}
                   onClick={() => { setSelectedMarket(`NUM_${num}`); setSelectedOdds(36.0); handlePlaceBet(num.toString(), [num]); }}
                   className={`bet-spot relative flex items-center justify-center font-bold text-white border border-white/20
                     ${isRed ? 'bg-red-600 hover:bg-red-500' : 'bg-black hover:bg-gray-900'}
                   `}
                 >
                   {num}
                   {bets[num.toString()] && (
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-yellow-400 rounded-full border border-black flex items-center justify-center text-black text-[8px] font-black z-10 pointer-events-none">
                       {bets[num.toString()]}
                     </div>
                   )}
                 </button>
               )
             })}
          </div>
          <div className="grid grid-cols-2 gap-1 mt-1">
             <button onClick={() => { setSelectedMarket('RED'); setSelectedOdds(2.0); handlePlaceBet('RED', [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]); }} className="bet-spot bg-red-600 border border-red-400 p-2 text-white font-black">RED (2x)</button>
             <button onClick={() => { setSelectedMarket('BLACK'); setSelectedOdds(2.0); handlePlaceBet('BLACK', [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]); }} className="bet-spot bg-black border border-gray-600 p-2 text-white font-black">BLACK (2x)</button>
          </div>
        </div>

        {/* Universal Bet Panel Footer */}
        <div className="mt-3">
          <UniversalBetPanel
            title="Live Dealer Bet Engine"
            marketName={selectedMarket}
            odds={selectedOdds}
            minBet={10}
            maxBet={100000}
            isOpen={isBettingOpen}
            lockedMessage="Dealer Spinning - Bets Closed"
            onPlaceBet={async (amount) => {
              return new Promise((resolve) => {
                if (!socket) return resolve({ success: false, message: 'Socket not connected' });
                const activeUser = userId || (typeof window !== 'undefined' ? (localStorage.getItem('windaq_user_id') || 'guest') : 'guest');
                socket.emit('live:bet', {
                  tableId: 'live-roulette-1',
                  userId: activeUser,
                  market: selectedMarket,
                  targets: [1],
                  amount
                }, (res: any) => {
                  if (res && res.success) {
                    fetchBalance();
                    resolve({ success: true, betId: res.data?.betId });
                  } else {
                    resolve({ success: false, message: res?.message || 'Bet failed' });
                  }
                });
              });
            }}
          />
        </div>
      </div>
      
      <style jsx>{`
        .bet-spot {
          border-radius: 6px;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: bold;
          transition: all 0.2s;
          cursor: pointer;
        }
        .bet-spot:active {
          transform: scale(0.96);
        }
      `}</style>
    </main>
  );
}

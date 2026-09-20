"use client";

import React, { useState } from 'react';
import AndroidStatusBar from '@/components/layout/AndroidStatusBar';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import AndroidApkBanner from '@/components/ui/AndroidApkBanner';
import QuickHub from '@/components/ui/QuickHub';
import FloatingWinnerToast from '@/components/ui/FloatingWinnerToast';
import DailySpinModal from '@/components/modals/DailySpinModal';
import VipClubModal from '@/components/modals/VipClubModal';
import ReferralModal from '@/components/modals/ReferralModal';
import PassbookModal from '@/components/modals/PassbookModal';
import DepositModal from '@/components/modals/DepositModal';
import WithdrawModal from '@/components/modals/WithdrawModal';
import NotifDrawer from '@/components/modals/NotifDrawer';
import { ShieldCheck, Zap, Trophy, TrendingUp, Clock, Flame, Users } from 'lucide-react';
import Link from 'next/link';
import { useWalletStore } from '@/store/walletStore';

const GAMES = [
  {
    id: 'aviator',
    title: 'WinDaq Aviator',
    category: 'Crash Game',
    tag: 'crash',
    players: '4,892 playing',
    image: 'https://images.unsplash.com/photo-1559291001-693fb9166cba?q=80&w=400&auto=format&fit=crop',
    href: '/games/aviator',
    hot: true,
    multiplier: '45.2X HIGHEST'
  },
  {
    id: 'color-prediction',
    title: 'Color Prediction',
    category: 'Color Trading',
    tag: 'trending',
    players: '3,120 playing',
    image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=400&auto=format&fit=crop',
    href: '/games/color-prediction',
    hot: true,
    multiplier: '1-MIN FAST'
  },
  {
    id: 'live-casino',
    title: 'Live Roulette',
    category: 'Live Casino',
    tag: 'casino',
    players: '1,780 playing',
    image: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?q=80&w=400&auto=format&fit=crop',
    href: '/games/live-casino',
    hot: false,
    multiplier: '36X PAYOUT'
  },
  {
    id: 'teen-patti',
    title: '20-20 Teen Patti',
    category: 'Desi Cards',
    tag: 'cards',
    players: '2,450 playing',
    image: 'https://images.unsplash.com/photo-1541178735493-479c1a27ed24?q=80&w=400&auto=format&fit=crop',
    href: '/games/teen-patti',
    hot: false,
    multiplier: 'SPEED DEAL'
  },
  {
    id: 'andar-bahar',
    title: 'Andar Bahar',
    category: 'Desi Cards',
    tag: 'cards',
    players: '1,920 playing',
    image: 'https://images.unsplash.com/photo-1517594422361-5eeb8ae275a9?q=80&w=400&auto=format&fit=crop',
    href: '/games/andar-bahar',
    hot: false,
    multiplier: 'CLASSIC'
  },
  {
    id: 'sportsbook',
    title: 'Cricket Exchange',
    category: 'Sports Betting',
    tag: 'sports',
    players: '6,340 playing',
    image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=400&auto=format&fit=crop',
    href: '/games/sportsbook',
    hot: true,
    multiplier: 'LIVE IN-PLAY'
  },
  {
    id: 'dragon-tiger',
    title: 'Dragon vs Tiger',
    category: 'Live Casino',
    tag: 'casino',
    players: '2,890 playing',
    image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=400&auto=format&fit=crop',
    href: '/games/live-casino',
    hot: true,
    multiplier: '2X INSTANT'
  },
  {
    id: 'mines',
    title: 'Mines',
    category: 'Crash Game',
    tag: 'crash',
    players: '3,450 playing',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
    href: '/games/aviator',
    hot: false,
    multiplier: 'UP TO 500X'
  },
  {
    id: 'vegas-slots',
    title: 'Vegas 777 Slots',
    category: 'Slots & Jackpot',
    tag: 'trending',
    players: '1,980 playing',
    image: 'https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?q=80&w=400&auto=format&fit=crop',
    href: '/games/live-casino',
    hot: true,
    multiplier: '777X JACKPOT'
  }
];

export default function Home() {
  const { setDepositing } = useWalletStore();
  const [activeCategory, setActiveCategory] = useState<'all' | 'crash' | 'trending' | 'casino' | 'cards' | 'sports'>('all');

  const filteredGames = GAMES.filter(g => activeCategory === 'all' || g.tag === activeCategory);

  return (
    <main className="min-h-screen bg-deep-ocean pb-24 font-sans selection:bg-neon-mint selection:text-deep-ocean max-w-lg mx-auto shadow-2xl relative">
      {/* 1. Android Top Status Bar */}
      <AndroidStatusBar />

      {/* 2. Sticky WinDaq Top App Bar */}
      <Header />

      {/* 3. Real-Time Marquee Ticker */}
      <div className="bg-[#0b101c] border-b border-white/5 py-1.5 px-3 flex items-center gap-2 text-xs overflow-hidden">
        <span className="text-neon-mint font-black flex items-center gap-1 flex-shrink-0">
          <Flame size={14} className="text-yellow-400" /> LIVE:
        </span>
        <div id="live-winners-marquee" className="whitespace-nowrap animate-[marquee_20s_linear_infinite] flex items-center gap-6 text-gray-300 text-[11px]">
          <span>🔥 Suraj V. won <b className="text-neon-mint">₹18,400</b> on WinDaq Aviator!</span>
          <span>🎉 Rahul G. won <b className="text-neon-mint">₹25,000</b> on Color Prediction!</span>
          <span>⚡ Vikram R. hit <b className="text-yellow-400">18.5X</b> on Aviator!</span>
          <span>💰 Amit T. won <b className="text-neon-mint">₹36,000</b> on Live Roulette!</span>
        </div>
      </div>

      {/* 4. Android APK Install Bar */}
      <AndroidApkBanner />

      {/* 5. Addictive Quick Hub (Spin, VIP, Refer, Passbook) */}
      <QuickHub />

      {/* 6. Promotional Banners Carousel */}
      <div className="px-4 mb-4">
        <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar snap-x snap-mandatory">
          <HeroBanner 
            title="CLAIM 200% MATCH" 
            subtitle="T20 Cricket & Aviator Bonus"
            tag="OFFICIAL WINDAQ BONUS"
            image="https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=600&auto=format&fit=crop"
            onAction={() => setDepositing(true)}
          />
          <HeroBanner 
            title="WIN ₹2,500 FREE" 
            subtitle="Daily Lucky Neon Wheel"
            tag="DAILY FREE CASH"
            image="https://images.unsplash.com/photo-1605870445919-838d190e8e1b?q=80&w=600&auto=format&fit=crop"
            onAction={() => useWalletStore.getState().setSpinOpen(true)}
          />
        </div>
      </div>

      {/* 7. Category Filter Tabs */}
      <div className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Games' },
            { id: 'crash', label: 'Crash Games' },
            { id: 'trending', label: 'Color Trading' },
            { id: 'casino', label: 'Live Roulette' },
            { id: 'cards', label: 'Teen Patti' },
            { id: 'sports', label: 'Sports' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`cat-pill px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-neon-mint text-deep-ocean shadow-[0_0_12px_rgba(0,255,163,0.4)]'
                  : 'bg-ocean-card/80 text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 8. Games Section */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-white flex items-center gap-2 tracking-wide">
            <Trophy size={18} className="text-yellow-400" />
            TOP GAMES (LIGHTNING FAST)
          </h2>
          <span className="text-neon-mint text-[11px] font-black cursor-pointer">
            {filteredGames.length} GAMES
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {filteredGames.map(game => (
            <GameCard 
              key={game.id}
              title={game.title} 
              category={game.category}
              players={game.players}
              multiplier={game.multiplier}
              image={game.image}
              href={game.href}
              hot={game.hot}
            />
          ))}
        </div>
      </div>

      {/* 9. Fast Action Highlight Card */}
      <div className="px-4 mb-6">
        <div className="bg-gradient-to-r from-purple-950/60 via-ocean-card to-blue-950/60 border border-purple-500/30 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-purple-400 font-black uppercase tracking-widest flex items-center gap-1 mb-1">
                <TrendingUp size={12} /> HIGH-SPEED GAMING
              </span>
              <h3 className="text-white font-black text-base">Aviator & Color Prediction</h3>
              <p className="text-gray-300 text-xs mt-0.5 flex items-center gap-1">
                <Clock size={12} /> 10-Second Rapid Draws • Instant Cashouts
              </p>
            </div>
            <Link 
              href="/games/aviator"
              className="bg-neon-mint hover:bg-emerald-400 text-deep-ocean font-black px-4 py-2 rounded-xl text-xs shadow-[0_0_15px_rgba(0,255,163,0.4)] active:scale-95 transition-transform"
            >
              PLAY NOW
            </Link>
          </div>
        </div>
      </div>

      {/* 10. Footer Trust Markers & Compliance Navigation */}
      <div className="px-4 mt-8 mb-6 flex flex-col items-center justify-center gap-3">
        <div className="flex flex-wrap justify-center gap-4 text-[10px] text-gray-400 font-bold">
          <div className="flex items-center gap-1">
            <ShieldCheck size={14} className="text-neon-mint" />
            <span>RNG 100% Tested</span>
          </div>
          <div>18+ Responsible Gaming</div>
          <div className="flex items-center gap-1">
            <Zap size={14} className="text-yellow-400" />
            <span>Instant UPI Payouts</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-extrabold text-[#8EA8B8] pt-2 border-t border-white/10 w-full max-w-sm">
          <Link href="/responsible-gaming" className="hover:text-[#26F0B2] transition-colors">Responsible Gaming</Link>
          <Link href="/fairness" className="hover:text-[#26F0B2] transition-colors">Fairness Verifier</Link>
          <Link href="/terms" className="hover:text-[#26F0B2] transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-[#26F0B2] transition-colors">Privacy</Link>
          <Link href="/support" className="hover:text-[#26F0B2] transition-colors">24/7 Support</Link>
          <Link href="/admin" className="text-amber-400/80 hover:text-amber-300 transition-colors">Admin</Link>
        </div>

        <p className="text-[10px] text-gray-500 text-center font-mono">
          WinDaq (विन डैक) • daqwon.in • Official Web & Android Real-Money Gaming Platform
        </p>
      </div>

      {/* 11. Floating Winner Stream Toasts */}
      <FloatingWinnerToast />

      {/* 12. Bottom Navigation */}
      <BottomNav />

      {/* 13. Interactive Modals */}
      <DailySpinModal />
      <VipClubModal />
      <ReferralModal />
      <PassbookModal />
      <DepositModal />
      <WithdrawModal />
      <NotifDrawer />
    </main>
  );
}

function HeroBanner({ title, subtitle, tag, image, onAction }: { title: string, subtitle: string, tag: string, image: string, onAction: () => void }) {
  return (
    <div className="banner-card min-w-[84vw] max-w-[340px] h-36 rounded-2xl relative overflow-hidden snap-center shrink-0 shadow-xl border border-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-deep-ocean/95 via-deep-ocean/50 to-transparent" />
      
      <div className="absolute top-3 left-3 bg-neon-mint/20 text-neon-mint border border-neon-mint/30 text-[9px] font-black px-2 py-0.5 rounded-full">
        {tag}
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
        <div>
          <h3 className="text-lg font-black text-white leading-tight drop-shadow-md">{title}</h3>
          <p className="text-gray-300 text-xs font-semibold drop-shadow-md mt-0.5">{subtitle}</p>
        </div>
        <button 
          onClick={onAction}
          className="bg-neon-mint text-deep-ocean font-black px-3 py-1.5 rounded-lg text-[11px] shadow-[0_0_12px_rgba(0,255,163,0.5)] active:scale-95 transition-transform flex-shrink-0"
        >
          CLAIM
        </button>
      </div>
    </div>
  );
}

function GameCard({ title, category, players, multiplier, image, hot, href }: { title: string, category: string, players: string, multiplier: string, image: string, hot?: boolean, href: string }) {
  return (
    <Link 
      href={href}
      className="game-card bg-ocean-card/90 rounded-2xl overflow-hidden group cursor-pointer border border-white/5 hover:border-neon-mint/50 transition-all relative flex flex-col shadow-lg"
    >
      {hot && (
        <div className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full z-20 shadow-md">
          HOT 🔥
        </div>
      )}
      <div className="h-28 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-ocean-card via-transparent to-transparent" />
        
        <span className="absolute bottom-1.5 left-2 bg-black/60 backdrop-blur-sm text-neon-mint text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-neon-mint/20">
          {multiplier}
        </span>
      </div>

      <div className="p-2.5 pt-1 flex flex-col flex-1 justify-between">
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{category}</p>
          <h4 className="text-white font-black text-sm leading-tight mt-0.5">{title}</h4>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-gray-400 font-semibold mt-2">
          <Users size={11} className="text-neon-mint" />
          <span>{players}</span>
        </div>
      </div>
    </Link>
  );
}

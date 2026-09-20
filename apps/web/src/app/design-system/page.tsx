"use client";

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Flame } from 'lucide-react';
import GameCard from '@/components/ui/cards/GameCard';
import LiveCard from '@/components/ui/cards/LiveCard';
import CategoryChip from '@/components/ui/cards/CategoryChip';
import TrustFooter from '@/components/ui/TrustFooter';

export default function DesignSystem() {
  return (
    <main className="min-h-screen bg-black font-sans selection:bg-neon-mint flex flex-col pb-safe">
      <header className="flex-none bg-deep-ocean border-b border-white/5 px-4 py-3 flex items-center justify-between z-20 shadow-lg sticky top-0">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <h1 className="text-white font-bold tracking-widest text-sm uppercase">Design System</h1>
        <div className="w-8" />
      </header>

      <div className="p-6 space-y-12 max-w-5xl mx-auto w-full">
        
        {/* Colors */}
        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/10 pb-2 mb-6">1. Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-deep-ocean border border-white/10 flex flex-col justify-end h-24">
              <span className="text-white font-bold">Deep Ocean</span>
              <span className="text-gray-400 text-xs">#050814</span>
            </div>
            <div className="p-4 rounded-xl bg-neon-mint flex flex-col justify-end h-24">
              <span className="text-deep-ocean font-bold">Neon Mint</span>
              <span className="text-green-900 text-xs">#00FFA3</span>
            </div>
            <div className="p-4 rounded-xl bg-ocean-card border border-white/10 flex flex-col justify-end h-24">
              <span className="text-white font-bold">Ocean Card</span>
              <span className="text-gray-400 text-xs">rgba(255,255,255,0.03)</span>
            </div>
          </div>
        </section>

        {/* Category Chips */}
        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/10 pb-2 mb-6">2. Category Chips</h2>
          <div className="flex flex-wrap gap-3">
             <CategoryChip label="Hot Games" icon={<Flame size={16} />} isActive />
             <CategoryChip label="Slots" />
             <CategoryChip label="Live Casino" />
             <CategoryChip label="Crash" />
             <CategoryChip label="Table Games" />
          </div>
        </section>

        {/* Game Cards */}
        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/10 pb-2 mb-6">3. Standard Game Cards</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
             <div className="space-y-2">
               <GameCard 
                 id="1" 
                 title="Aviator" 
                 image="https://images.unsplash.com/photo-1559291001-693fb9166cba?q=80&w=400&auto=format&fit=crop" 
                 href="#" 
                 badges={['hot']}
                 width="w-full"
               />
               <p className="text-gray-500 text-xs text-center">State: Default (Hot)</p>
             </div>

             <div className="space-y-2">
               <GameCard 
                 id="2" 
                 title="Teen Patti" 
                 image="https://images.unsplash.com/photo-1541178735493-479c1a27ed24?q=80&w=400&auto=format&fit=crop" 
                 href="#" 
                 badges={['new']}
                 isFavorite
                 width="w-full"
               />
               <p className="text-gray-500 text-xs text-center">State: Default (New, Fav)</p>
             </div>

             <div className="space-y-2">
               <GameCard 
                 id="3" 
                 title="Andar Bahar" 
                 image="https://images.unsplash.com/photo-1517594422361-5eeb8ae275a9?q=80&w=400&auto=format&fit=crop" 
                 href="#" 
                 state="maintenance"
                 width="w-full"
               />
               <p className="text-gray-500 text-xs text-center">State: Maintenance</p>
             </div>

             <div className="space-y-2">
               <GameCard 
                 id="4" 
                 title="Color Prediction" 
                 image="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=400&auto=format&fit=crop" 
                 href="#" 
                 state="blocked"
                 width="w-full"
               />
               <p className="text-gray-500 text-xs text-center">State: Blocked</p>
             </div>

             <div className="space-y-2">
               <GameCard 
                 id="5" 
                 title="Loading..." 
                 image="" 
                 href="#" 
                 state="loading"
                 width="w-full"
               />
               <p className="text-gray-500 text-xs text-center">State: Skeleton</p>
             </div>
          </div>
        </section>

        {/* Live Cards */}
        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/10 pb-2 mb-6">4. Live Casino Cards (Landscape)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             <div className="space-y-2">
               <LiveCard 
                 id="l1" 
                 title="Lightning Roulette" 
                 dealer="Evelyn"
                 players={1452}
                 image="https://images.unsplash.com/photo-1596838132731-3301c3fd4317?q=80&w=600&auto=format&fit=crop" 
                 href="#" 
                 width="w-full"
               />
             </div>
             <div className="space-y-2">
               <LiveCard 
                 id="l2" 
                 title="Dragon Tiger" 
                 dealer="Li Wei"
                 players={890}
                 image="https://images.unsplash.com/photo-1605333190803-db210e7b7f1e?q=80&w=600&auto=format&fit=crop" 
                 href="#" 
                 width="w-full"
                 isFavorite
               />
             </div>
          </div>
        </section>

        {/* Footer */}
        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/10 pb-2 mb-6">5. Trust Footer</h2>
          <div className="border border-white/10 rounded-xl overflow-hidden">
             <TrustFooter />
          </div>
        </section>

      </div>
    </main>
  );
}

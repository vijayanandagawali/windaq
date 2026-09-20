'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Construction } from 'lucide-react';
import Link from 'next/link';

export default function GameFallbackPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter();
  const { slug } = React.use(params);
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const KNOWN_SLUGS: Record<string, string> = {
      'colour-prediction': '/games/colour-prediction',
      'color-prediction': '/games/colour-prediction',
      'lightning-roulette': '/games/lightning-roulette',
      'live-roulette': '/games/live-roulette',
      'european-roulette': '/games/european-roulette',
      'texas-holdem': '/games/texas-holdem',
      'aviator': '/games/aviator',
      'slots': '/games/slots',
      'scratch': '/games/scratch',
      'lotto': '/games/lotto',
      'dice': '/games/dice',
      'blackjack': '/games/blackjack',
      'rummy': '/games/rummy',
      'teen-patti': '/games/teen-patti',
      'dragon-tiger': '/games/dragon-tiger',
      'andar-bahar': '/games/andar-bahar',
      'sportsbook': '/games/sportsbook',
      'live-casino': '/games/live-casino',
    };

    if (KNOWN_SLUGS[slug]) {
      router.replace(KNOWN_SLUGS[slug]);
      return;
    }

    fetch('http://localhost:4000/api/catalog')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const allGames = data.data.categories.flatMap((c: any) => c.games);
          const found = allGames.find((g: any) => g.slug === slug);
          setGame(found);
        }
      })
      .finally(() => setLoading(false));
  }, [slug, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-neon-mint border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-neon-mint font-bold uppercase tracking-widest text-sm">Loading Game Engine...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-20 h-20 text-red-500 mb-6" />
        <h1 className="text-4xl font-black text-white mb-4 uppercase">Game Not Found</h1>
        <p className="text-slate-400 max-w-md mx-auto mb-8">
          We couldn't locate the game you're looking for. It may have been removed or the URL is incorrect.
        </p>
        <button onClick={() => router.push('/')} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> Return to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={game.thumbnailUrl} alt={game.name} className="w-full h-full object-cover opacity-10 blur-xl scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-deep-ocean via-deep-ocean/90 to-transparent" />
      </div>

      <div className="relative z-10">
        <div className="w-24 h-24 bg-slate-900/80 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-700/50 shadow-2xl">
          <Construction className="w-12 h-12 text-orange-400" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-black text-white mb-2 uppercase tracking-tight">{game.name}</h1>
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-sm font-bold text-orange-400 bg-orange-500/10 px-3 py-1 rounded border border-orange-500/20">
            {game.provider}
          </span>
          <span className="text-sm font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded">
            {game.variant || game.type}
          </span>
        </div>

        <p className="text-slate-300 max-w-lg mx-auto mb-8 text-lg">
          This game is currently under maintenance or undergoing certification checks. Please check back later!
        </p>

        <div className="flex gap-4 justify-center">
          <button onClick={() => router.push('/')} className="px-8 py-4 bg-white text-deep-ocean hover:bg-gray-200 font-black rounded-xl flex items-center gap-2 transition-transform active:scale-95 shadow-xl shadow-white/10">
            <ArrowLeft className="w-5 h-5" /> Back to Hub
          </button>
        </div>
      </div>
    </div>
  );
}

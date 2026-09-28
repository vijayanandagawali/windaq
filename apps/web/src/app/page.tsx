'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, ShieldCheck, Wallet, HeartHandshake, Zap, ArrowRight, X } from 'lucide-react';
import GameTile from '@/components/lobby/GameTile';
import { CATEGORIES, COMING_SOON_GAMES, LIVE_GAMES, findGame, type GameCategory, type LobbyGame } from '@/lib/games';
import { useAuthStore } from '@/store/authStore';

type CategoryId = 'all' | GameCategory;

const HERO_STACK = ['european-roulette', 'aviator', 'andar-bahar'];

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: 'Provably fair',
    body: 'Every round is locked to a hashed server seed before bets close, and the seed is revealed afterwards so any result can be checked.'
  },
  {
    icon: Wallet,
    title: 'UPI wallet',
    body: 'Deposit with UPI and track every rupee in your passbook. Winnings are settled by the server the moment a round ends.'
  },
  {
    icon: HeartHandshake,
    title: 'Play responsibly',
    body: '18+ only. Set limits, take breaks and treat games as entertainment — never as a way to earn money.'
  }
];

export default function LobbyPage() {
  const { isAuthenticated, openAuthModal } = useAuthStore();

  const stack = HERO_STACK.map((slug) => findGame(slug)).filter(Boolean) as NonNullable<ReturnType<typeof findGame>>[];

  return (
    <div className="relative overflow-hidden">
      {/* Ambient backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_at_top_right,rgba(38,240,178,0.16),transparent_55%),radial-gradient(ellipse_at_top_left,rgba(91,184,255,0.12),transparent_50%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* HERO */}
        <section className="grid items-center gap-10 pb-10 pt-8 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:pb-16 lg:pt-16">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-neon-mint/30 bg-neon-mint-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-neon-mint">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-mint opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-mint" />
              </span>
              {LIVE_GAMES.length} games running now
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Fair games.
              <br />
              <span className="bg-gradient-to-r from-neon-mint via-emerald-300 to-sky-400 bg-clip-text text-transparent">Instant results.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/65 sm:text-lg">
              Roulette, Andar Bahar, Aviator, Sic Bo and more — every round settled on our server and verifiable, with your wallet updated the moment it ends.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#games"
                className="inline-flex items-center gap-2 rounded-2xl bg-neon-mint px-6 py-3.5 text-sm font-black text-deep-ocean shadow-[0_10px_30px_rgba(38,240,178,0.35)] transition hover:bg-neon-mint-hover active:scale-[0.98]">
                Browse games <ArrowRight size={16} aria-hidden="true" />
              </a>
              {!isAuthenticated && (
                <button type="button" onClick={() => openAuthModal('REGISTER')}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 active:scale-[0.98]">
                  Create account
                </button>
              )}
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-white/45">
              <ShieldCheck size={14} className="text-neon-mint" aria-hidden="true" /> 18+ only. Please play responsibly.
            </p>
          </div>

          {/* Featured stack */}
          <div className="relative mx-auto hidden h-[440px] w-full max-w-[520px] sm:block" aria-hidden="true">
            {stack.map((g, i) => (
              <Link key={g.slug} href={g.href} tabIndex={-1}
                className="lobby-float absolute w-[46%] overflow-hidden rounded-3xl ring-1 ring-white/15 transition duration-300 hover:z-20 hover:scale-[1.04]"
                style={{
                  left: `${[4, 27, 50][i]}%`,
                  top: `${[12, 0, 14][i]}%`,
                  zIndex: i === 1 ? 10 : 5,
                  ['--tilt' as string]: `${[-8, 0, 8][i]}deg`,
                  animationDelay: `${i * 0.8}s`,
                  boxShadow: `0 30px 60px rgba(0,0,0,0.5), 0 0 40px ${g.accent}33`
                }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.cardImage} alt="" width={400} height={500} className="aspect-[4/5] w-full object-cover" />
              </Link>
            ))}
          </div>
        </section>

        <Suspense fallback={<GamesGrid games={LIVE_GAMES} />}>
          <GamesBrowser />
        </Suspense>

        {/* TRUST */}
        <section className="grid gap-4 pb-16 md:grid-cols-3">
          {TRUST_POINTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 ring-1 ring-white/10">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neon-mint-soft text-neon-mint">
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-extrabold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{body}</p>
            </div>
          ))}
        </section>

        <section className="mb-16 flex flex-col items-start justify-between gap-4 rounded-3xl bg-gradient-to-r from-neon-mint/15 via-sky-500/10 to-transparent p-6 ring-1 ring-neon-mint/20 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl">
              <Zap size={20} className="text-neon-mint" aria-hidden="true" /> New here?
            </h2>
            <p className="mt-1 text-sm text-white/60">Start with the minimum bet and learn how each table works before playing bigger.</p>
          </div>
          <Link href="/fairness" className="shrink-0 rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15">
            How fairness works
          </Link>
        </section>
      </div>
    </div>
  );
}

function GamesGrid({ games }: { games: LobbyGame[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 xl:grid-cols-5">
      {games.map((g, i) => <GameTile key={g.slug} game={g} priority={i < 5} />)}
    </div>
  );
}

/** Category tabs, search and grid. The category lives in the URL (?cat=) so header links can deep-link. */
function GamesBrowser() {
  const searchParams = useSearchParams();
  const rawCat = searchParams.get('cat');
  const category: CategoryId = CATEGORIES.some((c) => c.id === rawCat) ? (rawCat as CategoryId) : 'all';
  const [query, setQuery] = useState('');

  const selectCategory = (id: CategoryId) => {
    window.history.replaceState(null, '', id === 'all' ? '/' : `/?cat=${id}`);
  };

  const visibleGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LIVE_GAMES.filter((g) =>
      (category === 'all' || g.category === category) &&
      (!q || g.name.toLowerCase().includes(q) || g.tagline.toLowerCase().includes(q))
    );
  }, [category, query]);

  return (
    <>
  {/* GAMES */}
  <section id="games" className="scroll-mt-20 pb-12">
    <div className="sticky top-[57px] z-20 -mx-4 mb-6 border-b border-white/5 bg-deep-ocean/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Game categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button key={c.id} role="tab" aria-selected={active} type="button" onClick={() => selectCategory(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm ${
                  active
                    ? 'bg-white text-deep-ocean shadow-[0_6px_20px_rgba(255,255,255,0.15)]'
                    : 'bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white'
                }`}>
                {c.label}
              </button>
            );
          })}
        </div>
        <label className="relative block md:w-72">
          <span className="sr-only">Search games</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games"
            className="w-full rounded-full bg-white/5 py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 outline-none transition focus:bg-white/10 focus:ring-neon-mint/50" />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/50 hover:text-white">
              <X size={14} />
            </button>
          )}
        </label>
      </div>
    </div>

    {visibleGames.length > 0 ? (
      <GamesGrid games={visibleGames} />
    ) : (
      <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center">
        <p className="font-bold text-white">No games match “{query}”</p>
        <button type="button" onClick={() => { setQuery(''); selectCategory('all'); }}
          className="mt-3 text-sm font-bold text-neon-mint hover:underline">Show all games</button>
      </div>
    )}
  </section>

  {/* COMING SOON */}
  {category === 'all' && !query && (
    <section className="pb-14">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-black text-white sm:text-2xl">Coming soon</h2>
          <p className="mt-1 text-sm text-white/50">Real-player tables and sports are in development. They will open here when ready.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4">
        {COMING_SOON_GAMES.map((g) => <GameTile key={g.slug} game={g} />)}
      </div>
    </section>
  )}
    </>
  );
}

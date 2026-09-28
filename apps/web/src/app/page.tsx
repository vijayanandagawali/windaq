'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, ShieldCheck, Wallet, HeartHandshake, ArrowRight, X, Smartphone, Gamepad2, BadgeCheck, Sparkles } from 'lucide-react';
import GameTile from '@/components/lobby/GameTile';
import { CATEGORIES, COMING_SOON_GAMES, LIVE_GAMES, findGame, type GameCategory, type LobbyGame } from '@/lib/games';
import { useAuthStore } from '@/store/authStore';
import AshokaChakra from '@/components/ui/AshokaChakra';

type CategoryId = 'all' | GameCategory;

const HERO_STACK = ['european-roulette', 'aviator', 'andar-bahar'];

const HERO_CHIPS = [
  { label: 'Roulette pays up to 35:1', className: 'left-[-4%] top-[8%]', delay: '0s' },
  { label: 'Aviator · cash out any time', className: 'right-[-6%] top-[38%]', delay: '1.2s' },
  { label: 'Andar Bahar · real 52-card deal', className: 'left-[6%] bottom-[2%]', delay: '2.4s' }
];

const STEPS = [
  { icon: Smartphone, title: 'Sign in with your mobile', body: 'A one-time code on SMS. No passwords to remember.' },
  { icon: Wallet, title: 'Add money with UPI', body: 'Scan the QR in any UPI app. Every rupee shows in your passbook.' },
  { icon: Gamepad2, title: 'Play and see it settle', body: 'Results come from the server and your wallet updates as the round ends.' }
];

const TRUST_POINTS = [
  { icon: BadgeCheck, tone: 'bg-emerald-50 text-emerald-600', title: 'Provably fair', body: 'Every round is locked to a hashed server seed before bets close, and the seed is revealed afterwards so any result can be checked.' },
  { icon: ShieldCheck, tone: 'bg-sky-50 text-sky-600', title: 'Money you can trace', body: 'Deposits, bets and payouts are written to a double-entry ledger. Your balance always matches its history.' },
  { icon: HeartHandshake, tone: 'bg-rose-50 text-rose-600', title: 'Play responsibly', body: '18+ only. Set limits, take breaks and treat games as entertainment — never as a way to earn money.' }
];

export default function LobbyPage() {
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const stack = HERO_STACK.map((slug) => findGame(slug)).filter(Boolean) as LobbyGame[];

  return (
    <div className="relative overflow-hidden">
      {/* Ambient colour mesh */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden">
        <div className="bg-mesh animate-mesh absolute -inset-20" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_60%,var(--wd-bg))]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* HERO */}
        <section className="grid items-center gap-12 pb-12 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:pt-20">
          <div className="max-w-xl">
            <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {LIVE_GAMES.length} games running now
            </span>
            <h1 className="animate-rise mt-6 text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-slate-900 sm:text-6xl lg:text-7xl" style={{ animationDelay: '80ms' }}>
              Fair games.
              <br />
              <span className="text-shimmer">Instant results.</span>
            </h1>
            <p className="animate-rise mt-6 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg" style={{ animationDelay: '160ms' }}>
              Roulette, Andar Bahar, Aviator, Sic Bo and more — every round settled on our server and verifiable, with your wallet updated the moment it ends.
            </p>
            <div className="animate-rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: '240ms' }}>
              <a href="#games"
                className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0">
                Browse games <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </a>
              {!isAuthenticated && (
                <button type="button" onClick={() => openAuthModal('REGISTER')}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0">
                  <Sparkles size={16} className="text-emerald-500" aria-hidden="true" /> Create free account
                </button>
              )}
            </div>
            <div className="animate-rise mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500" style={{ animationDelay: '320ms' }}>
              <span className="flex items-center gap-1.5"><BadgeCheck size={16} className="text-emerald-600" aria-hidden="true" /> Provably fair</span>
              <span className="flex items-center gap-1.5"><Smartphone size={16} className="text-sky-600" aria-hidden="true" /> UPI wallet</span>
              <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-rose-500" aria-hidden="true" /> 18+ only</span>
            </div>
          </div>

          {/* Featured stack */}
          <div className="relative mx-auto hidden h-[460px] w-full max-w-[540px] sm:block" aria-hidden="true">
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-orange-300/45 via-white to-green-300/45 blur-3xl" />
            <AshokaChakra className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-[0.07]" />
            {stack.map((g, i) => (
              <Link key={g.slug} href={g.href} tabIndex={-1}
                className="lobby-float absolute w-[46%] overflow-hidden rounded-[28px] border-4 border-white transition duration-300 hover:z-20"
                style={{
                  left: `${[2, 27, 52][i]}%`,
                  top: `${[14, 2, 16][i]}%`,
                  zIndex: i === 1 ? 10 : 5,
                  ['--tilt' as string]: `${[-9, 0, 9][i]}deg`,
                  animationDelay: `${i * 0.8}s`,
                  boxShadow: `0 30px 60px rgba(15,23,42,0.22), 0 10px 40px ${g.accent}40`
                }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.cardImage} alt="" width={400} height={500} className="aspect-[4/5] w-full object-cover" />
              </Link>
            ))}
            {HERO_CHIPS.map((c) => (
              <span key={c.label} className={`lobby-float absolute z-20 rounded-full border border-white bg-white/90 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur ${c.className}`}
                style={{ animationDelay: c.delay, animationDuration: '7s' }}>
                {c.label}
              </span>
            ))}
          </div>
        </section>

        <Suspense fallback={<GamesGrid games={LIVE_GAMES} />}>
          <GamesBrowser />
        </Suspense>

        {/* HOW IT WORKS */}
        <section className="pb-16">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="surface-card group relative overflow-hidden p-6 transition hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.10)]">
                <span className="absolute right-5 top-4 text-5xl font-extrabold text-slate-100 transition group-hover:text-emerald-50">{i + 1}</span>
                <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 via-amber-400 to-green-600 text-white shadow-[0_8px_20px_rgba(249,115,22,0.25)]">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3 className="relative mt-4 text-lg font-bold text-slate-900">{title}</h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TRUST */}
        <section className="grid gap-4 pb-16 md:grid-cols-3">
          {TRUST_POINTS.map(({ icon: Icon, tone, title, body }) => (
            <div key={title} className="rounded-3xl bg-white/70 p-6 ring-1 ring-slate-200 backdrop-blur">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </section>

        <section className="relative mb-16 overflow-hidden rounded-[32px] bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 sm:p-12">
          <div aria-hidden="true" className="tiranga-strip absolute inset-x-0 top-0 h-1.5" />
          <AshokaChakra className="absolute -right-16 -top-16 h-72 w-72 opacity-[0.06]" />
          <div aria-hidden="true" className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-orange-200/40 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-lg">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">New here? Start small.</h2>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">Most games start at ₹10. Learn how a game works before playing bigger, and see exactly how each result was decided.</p>
            </div>
            <Link href="/fairness" className="shrink-0 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(22,163,74,0.3)] transition hover:-translate-y-0.5">
              How fairness works
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function GamesGrid({ games }: { games: LobbyGame[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 xl:grid-cols-5">
      {games.map((g, i) => (
        <div key={g.slug} className="animate-rise" style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
          <GameTile game={g} priority={i < 5} />
        </div>
      ))}
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
      <section id="games" className="scroll-mt-20 pb-14">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Play now</h2>
          <span className="text-sm font-semibold text-slate-500">{visibleGames.length} games</span>
        </div>
        <div className="sticky top-[57px] z-20 -mx-4 mb-6 border-b border-slate-200/70 bg-deep-ocean/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div role="tablist" aria-label="Game categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
              {CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <button key={c.id} role="tab" aria-selected={active} type="button" onClick={() => selectCategory(c.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm ${
                      active
                        ? 'bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)]'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900 hover:ring-slate-300'
                    }`}>
                    {c.label}
                  </button>
                );
              })}
            </div>
            <label className="relative block md:w-72">
              <span className="sr-only">Search games</span>
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games"
                className="w-full rounded-full bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 ring-1 ring-slate-200 outline-none transition focus:ring-2 focus:ring-emerald-400" />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-700">
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
        </div>

        {visibleGames.length > 0 ? (
          <GamesGrid games={visibleGames} />
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="font-bold text-slate-900">No games match “{query}”</p>
            <button type="button" onClick={() => { setQuery(''); selectCategory('all'); }}
              className="mt-3 text-sm font-bold text-emerald-600 hover:underline">Show all games</button>
          </div>
        )}
      </section>

      {category === 'all' && !query && (
        <section className="pb-16">
          <div className="mb-5">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Coming soon</h2>
            <p className="mt-1 text-sm text-slate-500">Real-player tables and sports are in development. They will open here when ready.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-5">
            {COMING_SOON_GAMES.map((g) => <GameTile key={g.slug} game={g} />)}
          </div>
        </section>
      )}
    </>
  );
}

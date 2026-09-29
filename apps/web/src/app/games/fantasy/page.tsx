"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Info, Radio, ShieldCheck, Trophy } from 'lucide-react';
import TeamBadge from '@/components/games/fantasy/TeamBadge';
import { countdown, fantasyApi, type FMatch } from '@/lib/fantasy';

function Card({ m, now }: { m: FMatch; now: number }) {
  const left = countdown(m.startsAt, now);
  return (
    <Link href={`/games/fantasy/${m.id}`} className="press block rounded-3xl bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 transition hover:-translate-y-0.5">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
        <span>{m.format} · {m.venue || 'Venue TBA'}</span>
        {m.status === 'LIVE' ? <span className="flex items-center gap-1 text-rose-600"><Radio size={12} className="animate-pulse" /> Live</span>
          : m.status === 'COMPLETED' ? <span className="text-slate-400">Completed</span>
            : <span className="flex items-center gap-1 text-emerald-600"><CalendarClock size={12} /> {left || 'Starting'}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5"><TeamBadge short={m.teamAShort} /><div><p className="text-sm font-black">{m.teamAShort}</p><p className="text-[11px] text-slate-500">{m.teamA}</p></div></div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">VS</span>
        <div className="flex items-center gap-2.5 text-right"><div><p className="text-sm font-black">{m.teamBShort}</p><p className="text-[11px] text-slate-500">{m.teamB}</p></div><TeamBadge short={m.teamBShort} /></div>
      </div>
      <p className="mt-3 text-[11px] font-semibold text-slate-400">{new Date(m.startsAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
    </Link>
  );
}

export default function FantasyLobby() {
  const [matches, setMatches] = useState<FMatch[] | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fantasyApi<FMatch[]>('/matches').then((r) => (r.ok ? setMatches(r.data || []) : setError(r.message || 'Could not load matches')));
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const upcoming = (matches || []).filter((m) => m.status === 'UPCOMING');
  const live = (matches || []).filter((m) => m.status === 'LIVE');
  const done = (matches || []).filter((m) => m.status === 'COMPLETED');

  return (
    <div className="min-h-[calc(100dvh-58px)] w-full bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-4">
        <h1 className="flex items-center gap-2 text-xl font-black tracking-tight"><Trophy size={20} className="text-amber-500" /> Fantasy Cricket</h1>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500"><ShieldCheck size={12} className="text-emerald-600" /> Pick 11 within 100 credits · captain 2x, vice-captain 1.5x · free contests</p>

        {error && <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {matches && matches.length === 0 && (
          <div className="mt-6 rounded-3xl bg-white p-6 text-center ring-1 ring-slate-200">
            <p className="text-base font-black">No matches scheduled yet</p>
            <p className="mt-1 text-sm text-slate-500">Upcoming fixtures appear here as soon as they are published. Only real, scheduled matches are listed.</p>
          </div>
        )}

        {live.length > 0 && (<><h2 className="mt-6 text-xs font-black uppercase tracking-wider text-rose-600">Live</h2><div className="mt-2 space-y-3">{live.map((m) => <Card key={m.id} m={m} now={now} />)}</div></>)}
        {upcoming.length > 0 && (<><h2 className="mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Upcoming</h2><div className="mt-2 space-y-3">{upcoming.map((m) => <Card key={m.id} m={m} now={now} />)}</div></>)}
        {done.length > 0 && (<><h2 className="mt-6 text-xs font-black uppercase tracking-wider text-slate-400">Completed</h2><div className="mt-2 space-y-3">{done.slice(-5).reverse().map((m) => <Card key={m.id} m={m} now={now} />)}</div></>)}

        <div className="mt-6 flex gap-2 rounded-2xl bg-white p-4 text-xs text-slate-600 ring-1 ring-slate-200">
          <Info size={16} className="mt-0.5 shrink-0 text-sky-600" />
          <p>Points follow the T20 system: runs, boundaries, milestones, wickets, maidens, catches, stumpings and run-outs, with strike-rate and economy bands. Scores update from the official scorecard after each innings.</p>
        </div>
      </div>
    </div>
  );
}

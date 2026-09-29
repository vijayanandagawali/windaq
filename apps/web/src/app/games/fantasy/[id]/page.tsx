"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ChevronLeft, Lock, Pencil, Plus, Radio, Trophy, Users, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import TeamBadge from '@/components/games/fantasy/TeamBadge';
import TeamBuilder from '@/components/games/fantasy/TeamBuilder';
import Portal from '@/components/ui/Portal';
import { countdown, fantasyApi, ROLE_INFO, type FMatch, type FPlayer, type FTeam, type Role } from '@/lib/fantasy';

interface LbEntry { id: string; rank: number | null; points: number; teamName: string; player: string; mine: boolean; team: null | { playerIds: string[]; captainId: string; viceCaptainId: string } }

function TeamView({ team, byId }: { team: { playerIds: string[]; captainId: string; viceCaptainId: string }; byId: Map<string, FPlayer> }) {
return (
  <div className="space-y-3">
    {(['WK', 'BAT', 'AR', 'BOWL'] as Role[]).map((r) => {
      const list = team.playerIds.map((id) => byId.get(id)).filter((p): p is FPlayer => !!p && p.role === r);
      if (!list.length) return null;
      return (
        <div key={r}>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{ROLE_INFO[r].label}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {list.map((p) => (
              <span key={p.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                {p.id === team.captainId && <span className="rounded-full bg-amber-500 px-1 text-[9px] text-white">C</span>}
                {p.id === team.viceCaptainId && <span className="rounded-full bg-sky-500 px-1 text-[9px] text-white">VC</span>}
                {p.name}{p.points !== null ? <span className="text-slate-400">· {p.points}</span> : null}
              </span>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);
}

export default function FantasyMatchPage() {
  const params = useParams();
  const matchId = params?.id as string;
  const { isAuthenticated, user, openAuthModal } = useAuthStore();
  const [match, setMatch] = useState<FMatch | null>(null);
  const [teams, setTeams] = useState<FTeam[]>([]);
  const [tab, setTab] = useState<'contests' | 'teams'>('contests');
  const [builder, setBuilder] = useState<null | { editId?: string; initial?: FTeam }>(null);
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [board, setBoard] = useState<null | { name: string; entries: LbEntry[] }>(null);
  const [viewTeam, setViewTeam] = useState<null | { title: string; team: { playerIds: string[]; captainId: string; viceCaptainId: string } }>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const m = await fantasyApi<FMatch>(`/matches/${matchId}`);
    if (m.ok && m.data) setMatch(m.data);
    if (isAuthenticated && !user?.isGuest) {
      const t = await fantasyApi<FTeam[]>(`/matches/${matchId}/my-teams`);
      if (t.ok) setTeams(t.data || []);
    }
  }, [matchId, isAuthenticated, user?.isGuest]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(load, 30000);
    return () => { clearTimeout(first); clearInterval(t); clearInterval(refresh); };
  }, [load]);

  const needSignIn = () => {
    if (!isAuthenticated || user?.isGuest) { openAuthModal('LOGIN'); toast('Sign in with your mobile number to create teams'); return true; }
    return false;
  };

  const save = async (team: { playerIds: string[]; captainId: string; viceCaptainId: string }) => {
    setSaving(true);
    const res = builder?.editId
      ? await fantasyApi(`/teams/${builder.editId}`, { method: 'PUT', body: team })
      : await fantasyApi(`/matches/${matchId}/teams`, { method: 'POST', body: team });
    setSaving(false);
    if (!res.ok) { toast.error(res.message || 'Could not save team'); return; }
    toast.success(builder?.editId ? 'Team updated' : 'Team created');
    setBuilder(null);
    setTab('teams');
    load();
  };

  const join = async (contestId: string, teamId: string) => {
    const res = await fantasyApi(`/contests/${contestId}/join`, { method: 'POST', body: { teamId } });
    setJoining(null);
    if (!res.ok) { toast.error(res.message || 'Could not join'); return; }
    toast.success('Joined the contest');
    load();
  };

  const openBoard = async (contestId: string, name: string) => {
    if (needSignIn()) return;
    const res = await fantasyApi<{ entries: LbEntry[] }>(`/contests/${contestId}/leaderboard`);
    if (res.ok && res.data) setBoard({ name, entries: res.data.entries });
    else toast.error(res.message || 'Could not load leaderboard');
  };

  if (!match) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-slate-500">Loading match…</div>;
  }

  const byId = new Map((match.players || []).map((p) => [p.id, p]));
  const left = countdown(match.startsAt, now);
  const open = match.open && !!left;

  return (
    <div className="min-h-[calc(100dvh-58px)] w-full bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-900">
      {/* Match header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-4 pb-5 pt-3 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/games/fantasy" className="inline-flex items-center gap-1 text-xs font-bold text-white/70"><ChevronLeft size={14} /> All matches</Link>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5"><TeamBadge short={match.teamAShort} size={48} /><div><p className="text-base font-black">{match.teamAShort}</p><p className="text-[11px] text-white/60">{match.teamA}</p></div></div>
            <div className="text-center">
              {match.status === 'LIVE' ? <p className="flex items-center gap-1 text-xs font-black text-rose-300"><Radio size={12} className="animate-pulse" /> LIVE</p>
                : match.status === 'COMPLETED' ? <p className="text-xs font-black text-white/60">COMPLETED</p>
                  : <><p className="text-[10px] font-bold uppercase text-white/50">Starts in</p><p className="font-mono text-sm font-black text-emerald-300">{left || 'now'}</p></>}
            </div>
            <div className="flex items-center gap-2.5 text-right"><div><p className="text-base font-black">{match.teamBShort}</p><p className="text-[11px] text-white/60">{match.teamB}</p></div><TeamBadge short={match.teamBShort} size={48} /></div>
          </div>
          <p className="mt-3 text-center text-[11px] text-white/50">{match.format} · {match.venue || 'Venue TBA'} · {new Date(match.startsAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-24">
        <div className="-mt-3 flex rounded-2xl bg-white p-1 shadow ring-1 ring-slate-200">
          {(['contests', 'teams'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-xl py-2 text-xs font-black ${tab === t ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>
              {t === 'contests' ? `Contests (${match.contests?.length || 0})` : `My teams (${teams.length})`}
            </button>
          ))}
        </div>

        {!open && match.status === 'UPCOMING' && <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700"><Lock size={13} /> Teams are locked for this match.</p>}

        {tab === 'contests' && (
          <div className="mt-4 space-y-3">
            {(match.contests || []).length === 0 && <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500 ring-1 ring-slate-200">No contests for this match yet.</p>}
            {(match.contests || []).map((c) => {
              const full = c.joined >= c.maxEntries;
              const mine = teams.filter((t) => t.entries.some((e) => e.contestId === c.id));
              return (
                <div key={c.id} className="rounded-3xl bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-black">{c.name}</p>
                      <p className="text-[11px] text-slate-500">{c.prizeText || 'Free contest · bragging rights'}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{c.entryFee > 0 ? `₹${c.entryFee}` : 'FREE'}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${Math.min(100, (c.joined / c.maxEntries) * 100)}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] font-semibold text-slate-500">
                    <span>{c.joined} joined</span><span>{Math.max(0, c.maxEntries - c.joined)} spots left</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => openBoard(c.id, c.name)} className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700"><Trophy size={13} /> Leaderboard</button>
                    {open && !full && mine.length < c.maxTeamsPerUser && (
                      <button onClick={() => { if (needSignIn()) return; if (!teams.length) { setBuilder({}); return; } setJoining(c.id); }}
                        className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-2 text-xs font-black text-white">Join</button>
                    )}
                    {mine.length > 0 && <span className="self-center text-[11px] font-bold text-emerald-700">Joined with {mine.map((t) => t.name).join(', ')}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'teams' && (
          <div className="mt-4 space-y-3">
            {teams.length === 0 && <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500 ring-1 ring-slate-200">You have not created a team for this match.</p>}
            {teams.map((t) => {
              const cap = byId.get(t.captainId);
              const vc = byId.get(t.viceCaptainId);
              return (
                <div key={t.id} className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black">{t.name}</p>
                    <div className="flex items-center gap-2">
                      {match.status !== 'UPCOMING' && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-black">{t.points} pts</span>}
                      {open && <button onClick={() => setBuilder({ editId: t.id, initial: t })} className="rounded-full bg-white/15 p-1.5" aria-label="Edit team"><Pencil size={13} /></button>}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-3 text-xs">
                    <span className="rounded-xl bg-white/15 px-2.5 py-1.5"><b className="mr-1 rounded bg-amber-400 px-1 text-[10px] text-amber-950">C</b>{cap?.name}</span>
                    <span className="rounded-xl bg-white/15 px-2.5 py-1.5"><b className="mr-1 rounded bg-sky-300 px-1 text-[10px] text-sky-950">VC</b>{vc?.name}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 text-center text-[11px] font-bold">
                    {(['WK', 'BAT', 'AR', 'BOWL'] as Role[]).map((r) => (
                      <span key={r}>{ROLE_INFO[r].short} {t.playerIds.filter((id) => byId.get(id)?.role === r).length}</span>
                    ))}
                  </div>
                  <button onClick={() => setViewTeam({ title: t.name, team: t })} className="mt-3 text-[11px] font-bold text-white/80 underline">View players</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur">
          <button onClick={() => { if (!needSignIn()) setBuilder({}); }} className="mx-auto flex w-full max-w-2xl items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 py-3.5 text-sm font-black text-white">
            <Plus size={16} /> Create team
          </button>
        </div>
      )}

      {builder && (
        <TeamBuilder match={match} initial={builder.initial} saving={saving} onCancel={() => setBuilder(null)} onSave={save} />
      )}

      {/* Choose a team to join with */}
      <Portal><AnimatePresence>
        {joining && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={() => setJoining(null)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
              <p className="text-base font-black">Join with which team?</p>
              <div className="mt-3 space-y-2">
                {teams.filter((t) => !t.entries.some((e) => e.contestId === joining)).map((t) => (
                  <button key={t.id} onClick={() => join(joining, t.id)} className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold ring-1 ring-slate-200">
                    {t.name}<span className="text-xs text-slate-500">C: {byId.get(t.captainId)?.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence></Portal>

      {/* Leaderboard */}
      <Portal><AnimatePresence>
        {board && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center">
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-white sm:rounded-3xl">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <p className="flex items-center gap-2 text-base font-black"><Users size={16} /> {board.name}</p>
                <button onClick={() => setBoard(null)} className="rounded-full p-1.5 text-slate-500" aria-label="Close"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {board.entries.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No entries yet.</p>}
                {board.entries.map((e, i) => (
                  <button key={e.id} onClick={() => e.team && setViewTeam({ title: `${e.player} · ${e.teamName}`, team: e.team })} disabled={!e.team}
                    className={`flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left ${e.mine ? 'bg-emerald-50' : ''}`}>
                    <span className="w-8 text-sm font-black text-slate-400">#{e.rank ?? i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{e.player}{e.mine ? ' (you)' : ''}</span>
                      <span className="block text-[11px] text-slate-500">{e.teamName}{!e.team ? ' · picks hidden until the deadline' : ''}</span>
                    </span>
                    <span className="text-sm font-black">{e.points}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence></Portal>

      {/* Team viewer */}
      <Portal><AnimatePresence>
        {viewTeam && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={() => setViewTeam(null)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
              <p className="mb-3 text-base font-black">{viewTeam.title}</p>
              <TeamView team={viewTeam.team} byId={byId} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence></Portal>
    </div>
  );
}

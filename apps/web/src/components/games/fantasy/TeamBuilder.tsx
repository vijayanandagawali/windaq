'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, Minus, Plus } from 'lucide-react';
import Portal from '@/components/ui/Portal';
import { MAX_CREDITS, MAX_PER_SIDE, ROLE_INFO, teamColor, type FMatch, type FPlayer, type Role } from '@/lib/fantasy';

const ROLES: Role[] = ['WK', 'BAT', 'AR', 'BOWL'];
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/**
 * Dream11-style team builder: pick 11 within 100 credits (max 7 per side, role limits), then choose
 * captain (2x) and vice-captain (1.5x). The server re-validates everything on save.
 */
export default function TeamBuilder({ match, initial, onCancel, onSave, saving }: {
  match: FMatch;
  initial?: { playerIds: string[]; captainId: string; viceCaptainId: string };
  onCancel: () => void;
  onSave: (team: { playerIds: string[]; captainId: string; viceCaptainId: string }) => void;
  saving: boolean;
}) {
  const players = useMemo(() => match.players || [], [match.players]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [picked, setPicked] = useState<string[]>(initial?.playerIds || []);
  const [role, setRole] = useState<Role>('WK');
  const [step, setStep] = useState<'pick' | 'captain'>('pick');
  const [captain, setCaptain] = useState(initial?.captainId || '');
  const [vice, setVice] = useState(initial?.viceCaptainId || '');

  const chosen = picked.map((id) => byId.get(id)).filter(Boolean) as FPlayer[];
  const credits = chosen.reduce((s, p) => s + p.credits, 0);
  const left = Math.round((MAX_CREDITS - credits) * 10) / 10;
  const sideCount = { A: chosen.filter((p) => p.team === 'A').length, B: chosen.filter((p) => p.team === 'B').length };
  const roleCount = (r: Role) => chosen.filter((p) => p.role === r).length;
  const slotsLeft = 11 - chosen.length;
  // Minimum players still needed for roles below their minimum.
  const neededFor = (except: Role | null) => ROLES.reduce((s, r) => s + (r === except ? 0 : Math.max(0, ROLE_INFO[r].min - roleCount(r))), 0);

  const blockReason = (p: FPlayer): string | null => {
    if (picked.includes(p.id)) return null;
    if (chosen.length >= 11) return '11 players already picked';
    if (p.credits > left + 1e-9) return 'Not enough credits left';
    if (sideCount[p.team] >= MAX_PER_SIDE) return `Max ${MAX_PER_SIDE} from one team`;
    if (roleCount(p.role) >= ROLE_INFO[p.role].max) return `Max ${ROLE_INFO[p.role].max} ${ROLE_INFO[p.role].label.toLowerCase()}`;
    const minHere = Math.max(0, ROLE_INFO[p.role].min - roleCount(p.role) - 1);
    if (slotsLeft - 1 < neededFor(p.role) + minHere) return 'Save slots for other roles';
    return null;
  };

  const toggle = (p: FPlayer) => {
    if (picked.includes(p.id)) {
      setPicked((ids) => ids.filter((x) => x !== p.id));
      if (captain === p.id) setCaptain('');
      if (vice === p.id) setVice('');
      return;
    }
    if (!blockReason(p)) setPicked((ids) => [...ids, p.id]);
  };

  const rolesOk = ROLES.every((r) => roleCount(r) >= ROLE_INFO[r].min && roleCount(r) <= ROLE_INFO[r].max);
  const ready = chosen.length === 11 && rolesOk && left >= 0;
  const aColor = teamColor(match.teamAShort);
  const bColor = teamColor(match.teamBShort);

  return (
    <Portal>
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-sky-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-2">
          <button onClick={step === 'captain' ? () => setStep('pick') : onCancel} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Back"><ChevronLeft size={20} /></button>
          <p className="text-sm font-black">{step === 'pick' ? 'Create team' : 'Choose captain & vice-captain'}</p>
        </div>
        {step === 'pick' && (
          <>
            <div className="mt-2 grid grid-cols-4 items-end gap-2 text-center">
              <div><p className="text-[10px] font-bold uppercase text-white/60">Players</p><p className="text-lg font-black">{chosen.length}<span className="text-white/50">/11</span></p></div>
              <div><p className="text-[10px] font-bold uppercase" style={{ color: aColor }}>{match.teamAShort}</p><p className="text-lg font-black">{sideCount.A}</p></div>
              <div><p className="text-[10px] font-bold uppercase" style={{ color: bColor }}>{match.teamBShort}</p><p className="text-lg font-black">{sideCount.B}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-white/60">Credits left</p><p className={`text-lg font-black ${left < 0 ? 'text-rose-400' : ''}`}>{left}</p></div>
            </div>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: 11 }).map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < chosen.length ? 'bg-emerald-400' : 'bg-white/15'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {step === 'pick' ? (
        <>
          <div className="flex border-b border-slate-200 bg-white">
            {ROLES.map((r) => (
              <button key={r} onClick={() => setRole(r)}
                className={`flex-1 border-b-2 py-2.5 text-xs font-black ${role === r ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500'}`}>
                {ROLE_INFO[r].short} ({roleCount(r)})
              </button>
            ))}
          </div>
          <p className="bg-slate-50 px-4 py-1.5 text-[11px] font-semibold text-slate-500">Pick {ROLE_INFO[role].min}–{ROLE_INFO[role].max} {ROLE_INFO[role].label}</p>
          <div className="flex-1 overflow-y-auto">
            {players.filter((p) => p.role === role).sort((a, b) => b.credits - a.credits).map((p) => {
              const on = picked.includes(p.id);
              const reason = blockReason(p);
              const short = p.team === 'A' ? match.teamAShort : match.teamBShort;
              const color = p.team === 'A' ? aColor : bColor;
              return (
                <button key={p.id} onClick={() => toggle(p)} disabled={!on && !!reason}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition ${on ? 'bg-emerald-50' : 'bg-white'} ${!on && reason ? 'opacity-45' : ''}`}>
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: color }}>
                    {initials(p.name)}
                    <span className="absolute -bottom-1 rounded bg-slate-900 px-1 text-[8px] font-black text-white">{short}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">{p.name}</span>
                    <span className="block text-[11px] text-slate-500">
                      {p.inLineup && <span className="mr-1.5 font-bold text-emerald-600">● Announced</span>}
                      {!on && reason ? reason : p.points !== null ? `${p.points} pts` : ROLE_INFO[p.role].label.slice(0, -1)}
                    </span>
                  </span>
                  <span className="text-sm font-black text-slate-700">{p.credits}</span>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${on ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {on ? <Minus size={14} /> : <Plus size={14} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-200 bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <button onClick={() => setStep('captain')} disabled={!ready}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 text-sm font-black text-white disabled:opacity-40">
              {ready ? 'Next: captain & vice-captain' : chosen.length < 11 ? `Pick ${11 - chosen.length} more` : 'Check role limits'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 bg-white px-4 py-2 text-center text-[11px] font-bold text-slate-600">
            <span className="rounded-xl bg-amber-50 py-1.5 text-amber-700">C gets 2x points</span>
            <span className="rounded-xl bg-sky-50 py-1.5 text-sky-700">VC gets 1.5x points</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ROLES.flatMap((r) => chosen.filter((p) => p.role === r)).map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: p.team === 'A' ? aColor : bColor }}>{initials(p.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{p.name}</span>
                  <span className="block text-[11px] text-slate-500">{ROLE_INFO[p.role].short} · {p.team === 'A' ? match.teamAShort : match.teamBShort}</span>
                </span>
                <button onClick={() => { setCaptain(p.id); if (vice === p.id) setVice(''); }}
                  className={`h-9 w-9 rounded-full border-2 text-xs font-black transition ${captain === p.id ? 'scale-110 border-amber-500 bg-amber-500 text-white' : 'border-slate-300 text-slate-500'}`}>C</button>
                <button onClick={() => { setVice(p.id); if (captain === p.id) setCaptain(''); }}
                  className={`h-9 w-9 rounded-full border-2 text-xs font-black transition ${vice === p.id ? 'scale-110 border-sky-500 bg-sky-500 text-white' : 'border-slate-300 text-slate-500'}`}>VC</button>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <button onClick={() => onSave({ playerIds: picked, captainId: captain, viceCaptainId: vice })} disabled={!captain || !vice || saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 py-3.5 text-sm font-black text-white disabled:opacity-40">
              <Check size={16} /> {saving ? 'Saving…' : 'Save team'}
            </button>
          </div>
        </>
      )}
    </div>
    </Portal>
  );
}

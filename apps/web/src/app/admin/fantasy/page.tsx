'use client';

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Trophy, Plus, Save, Download, RefreshCw, Users } from 'lucide-react';
import { fantasyApi, type FMatch } from '@/lib/fantasy';

interface Fixture {
  externalId: string; name: string; series: string; startsAt: string; venue: string | null;
  teamInfo: { name: string; shortname: string }[]; teams: string[]; hasSquad: boolean; fantasyEnabled: boolean; importedMatchId: string | null;
}
interface Usage { hitsToday: number | null; hitsLimit: number | null; hitsLeft: number | null; reserve: number; fantasyCallCost: number }

interface AdminPlayer {
  id: string; name: string; team: 'A' | 'B'; role: string; credits: number; inLineup: boolean; points: number;
  stats: Record<string, number | boolean> | null; breakdown: { label: string; points: number }[];
}

const STAT_FIELDS: [string, string][] = [
  ['runs', 'R'], ['balls', 'B'], ['fours', '4s'], ['sixes', '6s'], ['wickets', 'W'], ['bowledLbw', 'Bwd/LBW'],
  ['overs', 'Ov'], ['runsConceded', 'RC'], ['maidens', 'M'], ['catches', 'Ct'], ['stumpings', 'St'], ['runOutDirect', 'RO dir'], ['runOutIndirect', 'RO']
];

export default function AdminFantasyPage() {
  const [matches, setMatches] = useState<FMatch[]>([]);
  const [selected, setSelected] = useState<FMatch | null>(null);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [form, setForm] = useState({ teamA: '', teamAShort: '', teamB: '', teamBShort: '', venue: '', startsAt: '' });
  const [bulk, setBulk] = useState('');
  const [contest, setContest] = useState({ name: 'Free Contest', maxEntries: 1000, maxTeamsPerUser: 1, prizeText: '' });
  const [edits, setEdits] = useState<Record<string, Record<string, string | boolean>>>({});
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState('');

  const loadMatches = useCallback(async () => {
    const r = await fantasyApi<FMatch[]>('/matches');
    if (r.ok) setMatches(r.data || []);
  }, []);

  const loadMatch = useCallback(async (id: string) => {
    const [m, p] = await Promise.all([fantasyApi<FMatch>(`/matches/${id}`), fantasyApi<AdminPlayer[]>(`/admin/matches/${id}/points`)]);
    if (m.ok && m.data) setSelected(m.data);
    if (p.ok) setPlayers(p.data || []);
    setEdits({});
  }, []);

  useEffect(() => { const t = setTimeout(loadMatches, 0); return () => clearTimeout(t); }, [loadMatches]);

  const act = async (label: string, path: string, method: string, body?: unknown) => {
    const r = await fantasyApi(path, { method, body });
    if (!r.ok) { toast.error(r.message || `${label} failed`); return false; }
    toast.success(label);
    return true;
  };

  const createMatch = async () => {
    if (!form.teamA || !form.teamB || !form.startsAt) { toast.error('Teams and start time are required'); return; }
    if (await act('Match created', '/admin/matches', 'POST', { ...form, startsAt: new Date(form.startsAt).toISOString() })) {
      setForm({ teamA: '', teamAShort: '', teamB: '', teamBShort: '', venue: '', startsAt: '' });
      loadMatches();
    }
  };

  const addPlayers = async () => {
    if (!selected) return;
    const list = bulk.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, team, role, credits] = l.split(',').map((x) => x.trim());
      return { name, team: (team || '').toUpperCase(), role: (role || '').toUpperCase(), credits: Number(credits) };
    });
    if (await act(`${list.length} players added`, `/admin/matches/${selected.id}/players`, 'POST', { players: list })) {
      setBulk('');
      loadMatch(selected.id);
    }
  };

  const saveLineup = async () => {
    if (!selected) return;
    const ids = players.filter((p) => (edits[p.id]?.inLineup ?? p.inLineup) === true).map((p) => p.id);
    if (await act('Lineup saved', `/admin/matches/${selected.id}/lineup`, 'POST', { playerIds: ids })) loadMatch(selected.id);
  };

  const saveScorecard = async () => {
    if (!selected) return;
    const lines = Object.entries(edits).map(([playerId, e]) => {
      const stats: Record<string, number | boolean> = {};
      for (const [k, v] of Object.entries(e)) {
        if (k === 'inLineup') continue;
        stats[k] = k === 'dismissed' || k === 'substitute' ? Boolean(v) : Number(v) || 0;
      }
      return { playerId, stats };
    }).filter((l) => Object.keys(l.stats).length);
    if (!lines.length) { toast('No scorecard changes'); return; }
    if (await act('Scorecard saved, points recalculated', `/admin/matches/${selected.id}/scorecard`, 'POST', { lines })) loadMatch(selected.id);
  };

  const loadFixtures = async () => {
    setBusy('fixtures');
    const r = await fantasyApi<{ fixtures: Fixture[]; usage: Usage }>('/admin/provider/fixtures');
    setBusy('');
    if (!r.ok || !r.data) { toast.error(r.message || 'Could not load fixtures'); return; }
    setFixtures(r.data.fixtures);
    setUsage(r.data.usage);
  };

  const refreshUsage = async () => {
    const r = await fantasyApi<Usage>('/admin/provider/usage');
    if (r.ok && r.data) setUsage(r.data);
  };

  const importFixture = async (f: Fixture) => {
    setBusy(f.externalId);
    const r = await fantasyApi<{ matchId: string; squad: { added: number; note: string } }>('/admin/provider/import', { method: 'POST', body: f });
    setBusy('');
    if (!r.ok || !r.data) { toast.error(r.message || 'Import failed'); return; }
    toast.success(`Imported · ${r.data.squad.added} players. ${r.data.squad.note}`);
    setFixtures((list) => (list || []).map((x) => (x.externalId === f.externalId ? { ...x, importedMatchId: r.data!.matchId } : x)));
    loadMatches();
    loadMatch(r.data.matchId);
    refreshUsage();
  };

  const providerAction = async (label: string, path: string) => {
    if (!selected) return;
    setBusy(label);
    const r = await fantasyApi<{ added?: number; updated?: number; note?: string }>(path, { method: 'POST' });
    setBusy('');
    if (!r.ok) { toast.error(r.message || `${label} failed`); return; }
    toast.success(`${label}: ${r.data?.added ?? r.data?.updated ?? 0} players${r.data?.note ? ` · ${r.data.note}` : ''}`);
    loadMatch(selected.id);
    refreshUsage();
  };

  const saveCredits = async (p: AdminPlayer, credits: string) => {
    const r = await fantasyApi(`/admin/players/${p.id}`, { method: 'PATCH', body: { credits: Number(credits) } });
    if (!r.ok) toast.error(r.message || 'Could not update credits');
    else if (selected) loadMatch(selected.id);
  };

  const val = (p: AdminPlayer, k: string) => (edits[p.id]?.[k] ?? p.stats?.[k] ?? '') as string | number | boolean;
  const setVal = (id: string, k: string, v: string | boolean) => setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), [k]: v } }));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Trophy className="h-6 w-6 text-amber-500" /> Fantasy Cricket</h1>
        <p className="mt-1 text-sm text-slate-500">Publish only real fixtures and squads. Scorecards entered here drive every player&apos;s points, team totals and contest ranks. Contests are free.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="mr-auto flex items-center gap-2 text-sm font-bold"><Download size={15} className="text-sky-600" /> Import from CricketData (T20 only)</p>
          {usage && <span className="text-xs text-slate-500">API hits today: {usage.hitsToday ?? '—'} / {usage.hitsLimit ?? '—'} · squad or scorecard costs {usage.fantasyCallCost} · {usage.reserve} kept in reserve</span>}
          <button onClick={loadFixtures} disabled={busy === 'fixtures'} className="flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            <RefreshCw size={12} className={busy === 'fixtures' ? 'animate-spin' : ''} /> Load upcoming fixtures
          </button>
        </div>
        {fixtures && (
          <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-100">
            {fixtures.length === 0 && <p className="p-4 text-sm text-slate-500">No upcoming T20 fixtures in the next series.</p>}
            {fixtures.map((f) => (
              <div key={f.externalId} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{f.name}</p>
                  <p className="truncate text-slate-500">{new Date(f.startsAt).toLocaleString('en-IN')} · {f.venue || 'Venue TBA'} · {f.hasSquad ? 'squad published' : 'squad not yet published'}</p>
                </div>
                {f.importedMatchId
                  ? <button onClick={() => loadMatch(f.importedMatchId!)} className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold">Open</button>
                  : <button onClick={() => importFixture(f)} disabled={busy === f.externalId} className="rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white disabled:opacity-50">Import</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-bold">New match</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <input className="col-span-2 rounded-lg border px-2 py-1.5" placeholder="Team A name" value={form.teamA} onChange={(e) => setForm({ ...form, teamA: e.target.value })} />
              <input className="rounded-lg border px-2 py-1.5" placeholder="Short" value={form.teamAShort} onChange={(e) => setForm({ ...form, teamAShort: e.target.value })} />
              <input className="col-span-2 rounded-lg border px-2 py-1.5" placeholder="Team B name" value={form.teamB} onChange={(e) => setForm({ ...form, teamB: e.target.value })} />
              <input className="rounded-lg border px-2 py-1.5" placeholder="Short" value={form.teamBShort} onChange={(e) => setForm({ ...form, teamBShort: e.target.value })} />
              <input className="col-span-3 rounded-lg border px-2 py-1.5" placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
              <input className="col-span-3 rounded-lg border px-2 py-1.5" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </div>
            <button onClick={createMatch} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white"><Plus size={14} /> Create</button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            {matches.map((m) => (
              <button key={m.id} onClick={() => loadMatch(m.id)} className={`block w-full border-b border-slate-100 px-4 py-3 text-left text-sm ${selected?.id === m.id ? 'bg-emerald-50' : ''}`}>
                <span className="font-semibold">{m.teamAShort} vs {m.teamBShort}</span>
                <span className="ml-2 text-xs text-slate-500">{m.status} · {new Date(m.startsAt).toLocaleString('en-IN')}</span>
              </button>
            ))}
            {!matches.length && <p className="p-4 text-sm text-slate-500">No matches yet.</p>}
          </div>
        </div>

        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
              <p className="mr-auto text-base font-bold">{selected.title} <span className="text-xs font-medium text-slate-500">({selected.status})</span></p>
              <button onClick={() => providerAction('Fetch squad', `/admin/matches/${selected.id}/fetch-squad`)} disabled={!!busy}
                className="flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 disabled:opacity-50"><Users size={12} /> Fetch squad</button>
              <button onClick={() => providerAction('Sync scorecard', `/admin/matches/${selected.id}/sync-scorecard`)} disabled={!!busy}
                className="flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 disabled:opacity-50"><RefreshCw size={12} /> Sync scorecard</button>
              {(['UPCOMING', 'LIVE', 'COMPLETED', 'ABANDONED'] as const).map((s) => (
                <button key={s} onClick={async () => { if (await act(`Status: ${s}`, `/admin/matches/${selected.id}`, 'PATCH', { status: s })) { loadMatch(selected.id); loadMatches(); } }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${selected.status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{s}</button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold">Add players</p>
                <p className="text-xs text-slate-500">One per line: <code>Name, A|B, WK|BAT|AR|BOWL, credits</code></p>
                <textarea className="mt-2 h-28 w-full rounded-lg border p-2 font-mono text-xs" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'R Sharma, A, BAT, 10.5\nJ Bumrah, A, BOWL, 9.5'} />
                <button onClick={addPlayers} className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Add players</button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold">New free contest</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <input className="col-span-2 rounded-lg border px-2 py-1.5" value={contest.name} onChange={(e) => setContest({ ...contest, name: e.target.value })} />
                  <label className="text-xs text-slate-500">Max entries<input type="number" className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm" value={contest.maxEntries} onChange={(e) => setContest({ ...contest, maxEntries: Number(e.target.value) })} /></label>
                  <label className="text-xs text-slate-500">Teams per user<input type="number" className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm" value={contest.maxTeamsPerUser} onChange={(e) => setContest({ ...contest, maxTeamsPerUser: Number(e.target.value) })} /></label>
                  <input className="col-span-2 rounded-lg border px-2 py-1.5" placeholder="Prize text (e.g. Top 3 get a shout-out)" value={contest.prizeText} onChange={(e) => setContest({ ...contest, prizeText: e.target.value })} />
                </div>
                <button onClick={async () => { if (await act('Contest created', `/admin/matches/${selected.id}/contests`, 'POST', contest)) loadMatch(selected.id); }}
                  className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Create contest</button>
                <p className="mt-2 text-xs text-slate-500">{selected.contests?.length || 0} contest(s): {selected.contests?.map((c) => `${c.name} (${c.joined}/${c.maxEntries})`).join(', ')}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <p className="text-sm font-bold">Squad, lineup and scorecard ({players.length})</p>
                <div className="flex gap-2">
                  <button onClick={saveLineup} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold">Save lineup</button>
                  <button onClick={saveScorecard} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><Save size={12} /> Save scorecard</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Player</th><th>XI</th>
                      {STAT_FIELDS.map(([, l]) => <th key={l} className="px-1">{l}</th>)}
                      <th>Out</th><th className="px-2 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100" title={p.breakdown.map((b) => `${b.label}: ${b.points}`).join('\n')}>
                        <td className="px-2 py-1.5"><span className="font-semibold">{p.name}</span> <span className="text-slate-400">{p.team === 'A' ? selected.teamAShort : selected.teamBShort} · {p.role} · </span>
                          <input key={`${p.id}-${p.credits}`} defaultValue={p.credits} disabled={!selected.open} onBlur={(e) => { if (Number(e.target.value) !== p.credits) saveCredits(p, e.target.value); }}
                            className="w-12 rounded border px-1 py-0.5 text-right text-slate-700 disabled:bg-slate-50" inputMode="decimal" title="Credits (5-12, steps of 0.5)" /></td>
                        <td className="text-center"><input type="checkbox" checked={Boolean(val(p, 'inLineup') === '' ? p.inLineup : val(p, 'inLineup'))} onChange={(e) => setVal(p.id, 'inLineup', e.target.checked)} /></td>
                        {STAT_FIELDS.map(([k]) => (
                          <td key={k} className="px-0.5"><input className="w-12 rounded border px-1 py-0.5 text-right" inputMode="decimal" value={String(val(p, k))} onChange={(e) => setVal(p.id, k, e.target.value)} /></td>
                        ))}
                        <td className="text-center"><input type="checkbox" checked={Boolean(val(p, 'dismissed'))} onChange={(e) => setVal(p.id, 'dismissed', e.target.checked)} /></td>
                        <td className="px-2 text-right font-bold">{p.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Select a match to manage its squad, contests and scorecard.</div>
        )}
      </div>
    </div>
  );
}

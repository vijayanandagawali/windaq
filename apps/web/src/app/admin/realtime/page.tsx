"use client";

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Users, 
  Coins, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  Play, 
  Lock, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Search, 
  Eye, 
  X, 
  ChevronRight, 
  Copy, 
  Check, 
  Server, 
  Radio
} from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { useAuthStore } from '@/store/authStore';

interface ActiveTable {
  gameId: string;
  variantId: string;
  roundId: string;
  sequenceNumber: string;
  status: string;
  phase: string;
  countdown: number;
  totalPhaseDuration: number;
  phaseEndsAt: number;
  bettingState: 'OPEN' | 'LOCKED';
  playerCount: number;
  simulatedPlayerCount: number;
  totalStakePaise: string;
  totalStakeRupees: number;
  currentLiabilityPaise: string;
  currentLiabilityRupees: number;
  serverSeedHash: string;
  resultState: 'PENDING' | 'REVEALED';
  resultSummary?: string;
  settlementState: 'PENDING' | 'SETTLED';
  serverHealth: string;
  lastEvent: string;
  nextRound: string;
  isMaintenance: boolean;
  isEnabled: boolean;
  dealerSpeed: number;
}

interface OverviewData {
  timestamp: number;
  serverUptimeSeconds: number;
  serverHealth: {
    status: string;
    rssMB: number;
    heapUsedMB: number;
    activeTables: number;
    cpuStatus: string;
  };
  summary: {
    activeTablesCount: number;
    totalPlayers: number;
    totalSimulatedPlayers: number;
    totalStakeRupees: number;
    totalLiabilityRupees: number;
  };
  tables: ActiveTable[];
}

export default function AdminRealtimeControlCenter() {
  const { token } = useAuthStore();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterPhase, setFilterPhase] = useState<string>('ALL');
  const [selectedTable, setSelectedTable] = useState<ActiveTable | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('windaq_token') : null);
      const res = await fetch(getApiUrl('/api/admin/realtime/overview'), {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(json);
          // If a table is currently selected in modal, keep its active state refreshed
          if (selectedTable) {
            const updated = json.tables?.find((t: ActiveTable) => t.gameId === selectedTable.gameId && t.variantId === selectedTable.variantId);
            if (updated) setSelectedTable(updated);
          }
        }
      }
    } catch (err) {
      console.warn('[AdminRealtime] Poll error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 1000);
    return () => clearInterval(interval);
  }, [token, selectedTable]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredTables = (data?.tables || []).filter(table => {
    const matchesSearch = table.gameId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          table.roundId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPhase = filterPhase === 'ALL' || table.phase === filterPhase;
    return matchesSearch && matchesPhase;
  });

  const CANONICAL_TIMELINE = [
    { key: 'CREATED', label: '1. Created', icon: Sparkles },
    { key: 'BETTING_OPEN', label: '2. Betting Open', icon: Play },
    { key: 'BETTING_CLOSING', label: '3. Closing', icon: Clock },
    { key: 'BETTING_LOCKED', label: '4. Locked', icon: Lock },
    { key: 'PLAYING', label: '5. Playing', icon: Activity },
    { key: 'RESULT_REVEAL', label: '6. Result Reveal', icon: Sparkles },
    { key: 'SETTLEMENT', label: '7. Settlement', icon: Coins },
    { key: 'COMPLETED', label: '8. Completed', icon: CheckCircle2 },
    { key: 'NEXT_ROUND', label: '9. Next Round', icon: RefreshCw }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Title & Live Pulse */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-400" />
              Realtime Control Center
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
              LIVE ENGINE FEED (1s)
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative Server State • Continuous Game Rounds • Real-Time Liabilities & Outcomes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Aggregate Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>ACTIVE TABLES</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {data?.summary.activeTablesCount || 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Simultaneous continuous games</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>CONNECTED PLAYERS</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {data?.summary.totalPlayers || 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            +{data?.summary.totalSimulatedPlayers || 0} simulated sandbox
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>TOTAL ROUND STAKE</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400 font-mono">
            ₹{(data?.summary.totalStakeRupees || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">In active betting windows</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>CURRENT LIABILITY</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400 font-mono">
            ₹{(data?.summary.totalLiabilityRupees || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Max potential platform payout</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>SERVER HEALTH</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono">
            HEALTHY
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Uptime: {Math.floor((data?.serverUptimeSeconds || 0) / 60)}m • Heap: {data?.serverHealth.heapUsedMB || 0}MB
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search game or round ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'BETTING_OPEN', 'BETTING_LOCKED', 'PLAYING', 'RESULT_REVEAL', 'SETTLEMENT'].map(phase => (
            <button
              key={phase}
              onClick={() => setFilterPhase(phase)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                filterPhase === phase 
                  ? 'bg-emerald-500 text-slate-950 shadow' 
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {phase.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Active Tables Grid / Data View */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Game & Variant</th>
                <th className="py-3 px-4">Round ID</th>
                <th className="py-3 px-4">Status & Phase</th>
                <th className="py-3 px-4">Countdown</th>
                <th className="py-3 px-4">Betting State</th>
                <th className="py-3 px-4 text-right">Players</th>
                <th className="py-3 px-4 text-right">Total Stake</th>
                <th className="py-3 px-4 text-right">Liability</th>
                <th className="py-3 px-4">Result State</th>
                <th className="py-3 px-4 text-center">Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredTables.map((table) => {
                const isBetting = table.bettingState === 'OPEN';
                const progressPct = Math.max(0, Math.min(100, Math.round((table.countdown / (table.totalPhaseDuration || 15)) * 100)));

                return (
                  <tr 
                    key={`${table.gameId}-${table.variantId}`}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    onClick={() => setSelectedTable(table)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-white capitalize">{table.gameId.replace('-', ' ')}</div>
                      <div className="text-[11px] text-slate-400">{table.variantId}</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      {table.roundId}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                        table.phase === 'BETTING_OPEN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        table.phase === 'BETTING_CLOSING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse' :
                        table.phase === 'BETTING_LOCKED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                        table.phase === 'PLAYING' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                        table.phase === 'RESULT_REVEAL' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                        'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {table.phase.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-white w-6 text-right">
                          {table.countdown}s
                        </span>
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full transition-all duration-1000"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isBetting ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {isBetting ? 'OPEN' : 'LOCKED'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-200">
                      {table.playerCount}
                      {table.simulatedPlayerCount > 0 && (
                        <span className="text-slate-500 text-[10px] ml-1">+{table.simulatedPlayerCount}s</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-amber-400">
                      ₹{table.totalStakeRupees.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-rose-400">
                      ₹{table.currentLiabilityRupees.toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-slate-300 font-semibold">
                        {table.resultSummary || table.resultState}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 mx-auto group-hover:border-emerald-500/50 border border-slate-700 transition-colors">
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Live Timeline Modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white capitalize">
                    {selectedTable.gameId.replace('-', ' ')} Live Timeline
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 font-mono">
                    {selectedTable.variantId}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Round ID: {selectedTable.roundId}
                </p>
              </div>
              <button 
                onClick={() => setSelectedTable(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Canonical 9-Phase Timeline Flow */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Canonical Lifecycle Timeline (Server-Authoritative)
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {CANONICAL_TIMELINE.map((step, idx) => {
                    const isActive = selectedTable.phase === step.key;
                    const isPassed = CANONICAL_TIMELINE.findIndex(s => s.key === selectedTable.phase) > idx;

                    return (
                      <div 
                        key={step.key}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isActive 
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10' 
                            : isPassed 
                            ? 'bg-slate-800/40 border-slate-700/60 text-slate-400' 
                            : 'bg-slate-950/40 border-slate-800/40 text-slate-600'
                        }`}
                      >
                        <step.icon className={`w-4 h-4 mx-auto mb-1 ${isActive ? 'animate-bounce text-emerald-400' : ''}`} />
                        <span className="text-[11px] font-bold block">{step.label}</span>
                        {isActive && (
                          <span className="text-[10px] font-mono font-black text-white mt-0.5 block">
                            {selectedTable.countdown}s left
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Realtime Operational State Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Bets</span>
                  <p className="text-lg font-mono font-bold text-white mt-0.5">{selectedTable.playerCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Stake</span>
                  <p className="text-lg font-mono font-bold text-amber-400 mt-0.5">₹{selectedTable.totalStakeRupees.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Est. Liability</span>
                  <p className="text-lg font-mono font-bold text-rose-400 mt-0.5">₹{selectedTable.currentLiabilityRupees.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Outcome State</span>
                  <p className="text-lg font-mono font-bold text-emerald-400 mt-0.5">{selectedTable.resultSummary || selectedTable.resultState}</p>
                </div>
              </div>

              {/* Cryptographic Pre-Commitment Security (Read-Only) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Cryptographic Result Pre-Commitment
                  </div>
                  <button 
                    onClick={() => copyToClipboard(selectedTable.serverSeedHash)}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    {copiedHash === selectedTable.serverSeedHash ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Hash
                  </button>
                </div>
                <p className="font-mono text-xs text-slate-400 break-all bg-slate-900 p-2 rounded border border-slate-800/80">
                  {selectedTable.serverSeedHash}
                </p>
                <p className="text-[11px] text-slate-500">
                  Authoritative SHA-256 hash committed before betting closes. Secret seeds are protected and cannot be altered.
                </p>
              </div>

              {/* Live Event Stream */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Authoritative Timeline Event
                </h4>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 flex items-center justify-between">
                  <span>{selectedTable.lastEvent}</span>
                  <span className="text-emerald-400 font-semibold">NEXT: {selectedTable.nextRound}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

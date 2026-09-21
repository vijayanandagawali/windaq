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
  Sparkles, 
  CheckCircle2, 
  X, 
  Bot, 
  Settings2, 
  UserCheck, 
  History, 
  AlertTriangle,
  Play,
  Pause,
  Sliders,
  Eye,
  Lock,
  ArrowRight
} from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface VirtualDealerProfile {
  dealerId: string;
  displayName: string;
  title: string;
  avatar: string;
  action: string;
  speech: string;
}

interface SimulatedBot {
  botId: string;
  displayName: string;
  badge: string;
  seatIndex: number;
  status: string;
}

interface AdminTable {
  tableId: string;
  name: string;
  gameId: string;
  variantId: string;
  dealer: VirtualDealerProfile;
  status: 'ACTIVE' | 'MAINTENANCE' | 'PAUSED';
  roundId: string;
  phase: string;
  phaseTimeLeft: number;
  totalPhaseDuration: number;
  minBet: number;
  maxBet: number;
  seatedPlayersCount: number;
  simulatedBotsCount: number;
  simulatedBots: SimulatedBot[];
  totalStake: number;
  totalPayout: number;
  serverSeedHash?: string;
  result?: any;
  health: string;
  simulationEnabled: boolean;
  configurationVersion: number;
}

interface DealerOption {
  dealerId: string;
  displayName: string;
  title: string;
  avatar: string;
  personalityStyle: string;
  greeting: string;
}

export default function AdminTablesPage() {
  const { token } = useAuthStore();
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  
  // Modals & Panels
  const [selectedTable, setSelectedTable] = useState<AdminTable | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showDealerModal, setShowDealerModal] = useState<boolean>(false);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [audits, setAudits] = useState<any[]>([]);

  // Config Form State
  const [editMinBet, setEditMinBet] = useState<number>(10);
  const [editMaxBet, setEditMaxBet] = useState<number>(5000);
  const [editBettingDuration, setEditBettingDuration] = useState<number>(15);
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [editDealerId, setEditDealerId] = useState<string>('dealer_maya');

  const fetchTables = async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/tables'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch table data');
      const data = await res.json();
      if (data.success && data.tables) {
        setTables(data.tables);
      }
    } catch (err: any) {
      console.error('Error polling admin tables:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDealers = async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/tables/dealers'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.dealers) {
        setDealers(data.dealers);
      }
    } catch (err: any) {
      console.error('Error fetching dealers:', err.message);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchDealers();
  }, [token]);

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(() => {
      fetchTables();
    }, 1500);
    return () => clearInterval(interval);
  }, [isPolling, token]);

  const handleOpenConfig = (table: AdminTable) => {
    setSelectedTable(table);
    setEditMinBet(table.minBet);
    setEditMaxBet(table.maxBet);
    setEditBettingDuration(table.totalPhaseDuration || 15);
    setEditStatus(table.status);
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedTable) return;
    try {
      const res = await fetch(getApiUrl(`/api/admin/tables/${selectedTable.tableId}/config`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          minBet: Number(editMinBet),
          maxBet: Number(editMaxBet),
          bettingDuration: Number(editBettingDuration),
          status: editStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Table ${selectedTable.name} configuration updated`);
        setShowConfigModal(false);
        fetchTables();
      } else {
        toast.error(data.message || 'Update failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOpenDealerModal = (table: AdminTable) => {
    setSelectedTable(table);
    setEditDealerId(table.dealer.dealerId);
    setShowDealerModal(true);
  };

  const handleAssignDealer = async () => {
    if (!selectedTable) return;
    try {
      const res = await fetch(getApiUrl(`/api/admin/tables/${selectedTable.tableId}/dealer`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dealerId: editDealerId })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Assigned dealer to ${selectedTable.name}`);
        setShowDealerModal(false);
        fetchTables();
      } else {
        toast.error(data.message || 'Assignment failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleSimulation = async (table: AdminTable) => {
    try {
      const nextState = !table.simulationEnabled;
      const res = await fetch(getApiUrl(`/api/admin/tables/${table.tableId}/simulation/toggle`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: nextState })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Simulation ${nextState ? 'enabled' : 'disabled'} for ${table.name}`);
        fetchTables();
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleBotTest = async (botId: string, action: 'disconnect' | 'reconnect') => {
    try {
      const res = await fetch(getApiUrl('/api/admin/tables/simulation/bot-reconnect-test'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ botId, action })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Bot ${botId} ${action} successful (Resilience Test)`);
        fetchTables();
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleViewAudits = async (table: AdminTable) => {
    setSelectedTable(table);
    try {
      const res = await fetch(getApiUrl(`/api/admin/tables/${table.tableId}/audits`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAudits(data.audits || []);
        setShowAuditModal(true);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header & Polling Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Automated Virtual Tables & Dealer Monitor
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Multi-table continuous engine orchestration, synthetic dealer assignment, and test simulation sandbox.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPolling(!isPolling)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isPolling 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {isPolling ? <Pause size={14} /> : <Play size={14} />}
            {isPolling ? 'Live Streaming' : 'Paused'}
          </button>
          
          <button
            onClick={fetchTables}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Strict Anti-Outcome Manipulation Architecture Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 p-4 rounded-xl flex items-start gap-3 shadow-lg">
        <ShieldCheck className="text-emerald-400 w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-emerald-300 mb-0.5">
            Cryptographic Provably Fair & Anti-Manipulation Protection
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Every continuous round generates a SHA-256 seed commitment before betting locks. 
            Direct manual outcome injection is architecturally prohibited. 
            All dealer movements and presentations strictly reflect the verified server engine.
          </p>
        </div>
      </div>

      {/* Multi-Table Monitor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tables.map(table => (
          <div 
            key={table.tableId}
            data-testid={`admin-table-card-${table.tableId}`}
            className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden"
          >
            {/* Top Table Info Bar */}
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      {table.tableId.toUpperCase()}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      table.status === 'ACTIVE' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                        : table.status === 'MAINTENANCE' 
                        ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                      {table.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white mt-1">{table.name}</h3>
                  <div className="text-[11px] text-slate-400 capitalize">{table.gameId} • {table.variantId}</div>
                </div>

                {/* Status Indicator */}
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-mono text-slate-500">v{table.configurationVersion}</span>
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {table.health}
                  </span>
                </div>
              </div>

              {/* Dealer Area Card */}
              <div className="bg-black/60 border border-white/5 rounded-xl p-3 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-black border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                    {table.dealer?.avatar?.[0]?.toUpperCase() || 'D'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{table.dealer?.displayName || 'Virtual Dealer'}</span>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 rounded uppercase tracking-wider font-mono">
                        SIMULATED
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[170px]" title={table.dealer?.speech}>
                      "{table.dealer?.speech || 'Welcome to the table.'}"
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenDealerModal(table)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                  title="Change Dealer"
                >
                  <UserCheck size={14} />
                </button>
              </div>

              {/* Live Round Phase & Countdown */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 mb-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Current Round:</span>
                  <span className="font-mono text-amber-300 font-bold">{table.roundId}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      table.phase === 'BETTING_OPEN' ? 'bg-emerald-400 animate-ping' :
                      table.phase === 'PLAYING' ? 'bg-amber-400 animate-spin' :
                      table.phase === 'RESULT' ? 'bg-purple-400' : 'bg-slate-500'
                    }`} />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {table.phase.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {table.phaseTimeLeft > 0 && (
                    <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                      {table.phaseTimeLeft}s
                    </span>
                  )}
                </div>

                {/* Cryptographic Seed Commitment Hash */}
                {table.serverSeedHash && (
                  <div className="text-[10px] font-mono text-slate-500 truncate" title={`SHA-256 Hash: ${table.serverSeedHash}`}>
                    <span className="text-slate-400 font-semibold">Commitment:</span> {table.serverSeedHash.slice(0, 16)}...
                  </div>
                )}
              </div>

              {/* Seated Simulated Opponents Sandbox */}
              <div className="border border-white/5 bg-slate-950/40 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Bot size={14} className="text-indigo-400" />
                    <span className="font-semibold">Simulated Bots ({table.simulatedBotsCount})</span>
                  </div>
                  <button
                    onClick={() => handleToggleSimulation(table)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                      table.simulationEnabled 
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {table.simulationEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {table.simulatedBots.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {table.simulatedBots.map(bot => (
                      <div 
                        key={bot.botId}
                        className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px]"
                      >
                        <span className="text-indigo-400 font-medium">{bot.displayName}</span>
                        <span className="text-[8px] text-slate-500 font-mono">#{bot.seatIndex}</span>
                        <button
                          onClick={() => handleBotTest(bot.botId, bot.status === 'DISCONNECTED' ? 'reconnect' : 'disconnect')}
                          className="text-[8px] text-slate-400 hover:text-white underline ml-1"
                          title="Simulate Disconnect/Reconnect"
                        >
                          {bot.status === 'DISCONNECTED' ? 'rc' : 'dc'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 italic">No simulated bots assigned</div>
                )}
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <div className="text-[11px] text-slate-400 font-mono">
                ₹{table.minBet} – ₹{table.maxBet}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewAudits(table)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                  title="View Audit Log"
                >
                  <History size={12} />
                  <span>Audits</span>
                </button>

                <button
                  onClick={() => handleOpenConfig(table)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center gap-1 transition-colors"
                  title="Configure Table"
                >
                  <Settings2 size={12} />
                  <span>Configure</span>
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* 1. Modal: Table Configuration & Timing */}
      {showConfigModal && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Configure {selectedTable.name}</h3>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Table Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="ACTIVE">ACTIVE (Running rounds continuously)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Temporarily paused for players)</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Min Bet (₹)</label>
                  <input
                    type="number"
                    value={editMinBet}
                    onChange={(e) => setEditMinBet(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Max Bet (₹)</label>
                  <input
                    type="number"
                    value={editMaxBet}
                    onChange={(e) => setEditMaxBet(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Betting Phase Duration (Seconds)</label>
                <input
                  type="number"
                  value={editBettingDuration}
                  onChange={(e) => setEditBettingDuration(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-300">
                ⚠️ Any changes will be audited and recorded with your administrator identity.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Dealer Assignment */}
      {showDealerModal && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Assign Virtual Dealer to {selectedTable.name}</h3>
              <button 
                onClick={() => setShowDealerModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dealers.map(d => (
                <div
                  key={d.dealerId}
                  onClick={() => setEditDealerId(d.dealerId)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    editDealerId === d.dealerId 
                      ? 'bg-amber-500/15 border-amber-500 shadow-md scale-[1.02]' 
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-black border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm">
                      {d.avatar?.[0]?.toUpperCase() || 'D'}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">{d.displayName}</div>
                      <div className="text-[10px] text-amber-400 font-medium uppercase">{d.personalityStyle} style</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 italic line-clamp-2">
                    "{d.greeting}"
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDealerModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignDealer}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Configuration Audit Trail */}
      {showAuditModal && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white">Configuration Audits</h3>
                <p className="text-xs text-slate-400">{selectedTable.name} ({selectedTable.tableId})</p>
              </div>
              <button 
                onClick={() => setShowAuditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {audits.length > 0 ? (
                audits.map((a, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-mono text-amber-300 font-bold">{a.auditId}</span>
                      <span>{new Date(a.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-300">
                      <span className="text-slate-500 font-medium">Admin:</span> {a.adminUser} • <span className="text-slate-500 font-medium">Version:</span> v{a.version}
                    </div>
                    <pre className="bg-black/60 p-2 rounded text-[11px] text-emerald-300 overflow-x-auto">
                      {JSON.stringify(a.changes, null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No configuration updates logged yet for this table.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

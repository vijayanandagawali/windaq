'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { 
  Gamepad2, 
  ShieldAlert, 
  Settings2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Coins, 
  Search, 
  Sliders, 
  Zap, 
  Eye, 
  History, 
  Layers, 
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Save,
  Check
} from 'lucide-react';

interface Variant {
  id: string;
  name: string;
  isEnabled: boolean;
  minBet?: number;
  maxBet?: number;
}

interface PayoutVersion {
  id: string;
  version: number;
  rules: Record<string, number>;
  reason: string;
  createdBy: string;
  effectiveFrom: string;
  isActive: boolean;
}

interface GameAudit {
  id: string;
  action: string;
  fieldChanged?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  adminId: string;
  createdAt: string;
}

interface GameConfigItem {
  id: string;
  gameSlug: string;
  name: string;
  category: string;
  isEnabled: boolean;
  isMaintenance: boolean;
  maintenanceMessage: string;
  visibility: 'FEATURED' | 'VISIBLE' | 'HIDDEN';
  dealerSpeed: number;
  minBet: number;
  maxBet: number;
  roundDuration: number;
  bettingDuration: number;
  activePayoutVersion: number;
  variants: Variant[];
  payoutRules: Record<string, number>;
  payoutVersionsCount: number;
  updatedAt: string;
}

export default function AdminGameControlPage() {
  const [games, setGames] = useState<GameConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'DISABLED'>('ALL');
  
  // Selected Game for Drawer / Modal
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [gameDetails, setGameDetails] = useState<(GameConfigItem & { versionHistory?: PayoutVersion[]; audits?: GameAudit[] }) | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'limits' | 'variants' | 'payouts' | 'audits'>('general');

  // Editable form state for active modal
  const [editConfig, setEditConfig] = useState<any>({});
  const [editablePayouts, setEditablePayouts] = useState<Record<string, number>>({});
  const [payoutReason, setPayoutReason] = useState('');
  const [isDeployingPayout, setIsDeployingPayout] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchGames = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:4000/api/admin/games', {
        headers: { 'x-admin-user-id': 'mock-super-admin-id' }
      });
      const json = await res.json();
      if (json.success) {
        setGames(json.data);
      }
    } catch (err) {
      console.error('Fetch games error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const openGameDetails = async (slug: string) => {
    setSelectedSlug(slug);
    setDetailsLoading(true);
    setActiveTab('general');
    try {
      const res = await fetch(`http://localhost:4000/api/admin/games/${slug}`, {
        headers: { 'x-admin-user-id': 'mock-super-admin-id' }
      });
      const json = await res.json();
      if (json.success) {
        setGameDetails(json.data);
        setEditConfig({
          isEnabled: json.data.isEnabled,
          isMaintenance: json.data.isMaintenance,
          maintenanceMessage: json.data.maintenanceMessage || '',
          visibility: json.data.visibility,
          dealerSpeed: json.data.dealerSpeed,
          minBet: json.data.minBet,
          maxBet: json.data.maxBet,
          roundDuration: json.data.roundDuration,
          bettingDuration: json.data.bettingDuration,
          variants: json.data.variants || []
        });
        setEditablePayouts({ ...json.data.payoutRules });
        setPayoutReason('');
      }
    } catch (err) {
      console.error('Fetch game detail error:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Quick toggle on main page
  const handleQuickToggleActive = async (game: GameConfigItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newStatus = !game.isEnabled;
      const res = await fetch(`http://localhost:4000/api/admin/games/${game.gameSlug}/config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user-id': 'mock-super-admin-id'
        },
        body: JSON.stringify({ isEnabled: newStatus })
      });
      const json = await res.json();
      if (json.success) {
        setGames(prev => prev.map(g => g.gameSlug === game.gameSlug ? { ...g, isEnabled: newStatus } : g));
        showToast(`${game.name} is now ${newStatus ? 'ENABLED' : 'DISABLED'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickToggleMaintenance = async (game: GameConfigItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newMaintenance = !game.isMaintenance;
      const res = await fetch(`http://localhost:4000/api/admin/games/${game.gameSlug}/config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user-id': 'mock-super-admin-id'
        },
        body: JSON.stringify({ isMaintenance: newMaintenance })
      });
      const json = await res.json();
      if (json.success) {
        setGames(prev => prev.map(g => g.gameSlug === game.gameSlug ? { ...g, isMaintenance: newMaintenance } : g));
        showToast(`${game.name} maintenance mode ${newMaintenance ? 'ACTIVATED' : 'DEACTIVATED'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save General / Limits / Variants config changes
  const handleSaveConfig = async () => {
    if (!selectedSlug) return;
    setIsSavingConfig(true);
    try {
      const res = await fetch(`http://localhost:4000/api/admin/games/${selectedSlug}/config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user-id': 'mock-super-admin-id'
        },
        body: JSON.stringify(editConfig)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Game configuration updated successfully');
        fetchGames();
        // Refresh local details
        if (gameDetails) {
          setGameDetails(prev => prev ? ({ ...prev, ...editConfig }) : null);
        }
      } else {
        alert(json.message || 'Error updating configuration');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Deploy New Versioned Payout Rules
  const handleDeployPayoutVersion = async () => {
    if (!selectedSlug) return;
    if (!payoutReason.trim() || payoutReason.trim().length < 3) {
      alert('A mandatory justification reason (min 3 characters) is required for versioned payout rule deployments.');
      return;
    }

    setIsDeployingPayout(true);
    try {
      const res = await fetch(`http://localhost:4000/api/admin/games/${selectedSlug}/payout-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user-id': 'mock-super-admin-id'
        },
        body: JSON.stringify({
          rules: editablePayouts,
          reason: payoutReason
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Version ${json.version} deployed and locked in successfully!`);
        payoutReason && setPayoutReason('');
        // Reload details to show updated version history and audits
        openGameDetails(selectedSlug);
        fetchGames();
      } else {
        alert(json.message || 'Error deploying payout rule version');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeployingPayout(false);
    }
  };

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = games.length;
    const active = games.filter(g => g.isEnabled && !g.isMaintenance).length;
    const maintenance = games.filter(g => g.isMaintenance).length;
    const disabled = games.filter(g => !g.isEnabled).length;
    return { total, active, maintenance, disabled };
  }, [games]);

  // Filtered games
  const filteredGames = useMemo(() => {
    return games.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          g.gameSlug.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      if (filterStatus === 'ACTIVE') return g.isEnabled && !g.isMaintenance;
      if (filterStatus === 'MAINTENANCE') return g.isMaintenance;
      if (filterStatus === 'DISABLED') return !g.isEnabled;
      return true;
    });
  }, [games, searchTerm, filterStatus]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500 text-slate-950 font-semibold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-emerald-400" />
            <h1 className="text-3xl font-bold tracking-tight text-white">Admin Game Control Room</h1>
          </div>
          <p className="text-slate-400 mt-1 text-sm">
            Server-authoritative game controls, variant limits, speed governors, and versioned financial payout governance.
          </p>
        </div>
        <button 
          onClick={fetchGames}
          className="flex items-center gap-2 bg-slate-900 border border-slate-700 hover:border-slate-600 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh State
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Total Catalog</span>
            <Gamepad2 className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{metrics.total}</p>
          <p className="text-xs text-slate-500 mt-1">Platform Games Loaded</p>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase">Active & Open</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{metrics.active}</p>
          <p className="text-xs text-emerald-500/70 mt-1">Accepting Wagers</p>
        </div>

        <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase">Maintenance Mode</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-1">{metrics.maintenance}</p>
          <p className="text-xs text-amber-500/70 mt-1">Undergoing Service</p>
        </div>

        <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-400 uppercase">Disabled</span>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400 mt-1">{metrics.disabled}</p>
          <p className="text-xs text-red-500/70 mt-1">Deactivated by Admin</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {(['ALL', 'ACTIVE', 'MAINTENANCE', 'DISABLED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterStatus === tab 
                  ? 'bg-emerald-500 text-slate-950 shadow-md' 
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search game or slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Games Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-lg backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">Game & Category</th>
                <th className="px-5 py-4">Operational Status</th>
                <th className="px-5 py-4">Lobby Visibility</th>
                <th className="px-5 py-4">Dealer Speed</th>
                <th className="px-5 py-4">Bet Limits</th>
                <th className="px-5 py-4">Cycle Durations</th>
                <th className="px-5 py-4">Payout Governance</th>
                <th className="px-5 py-4 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredGames.map((game) => (
                <tr 
                  key={game.gameSlug}
                  onClick={() => openGameDetails(game.gameSlug)}
                  className="hover:bg-slate-800/40 cursor-pointer transition"
                >
                  {/* Game Name & Category */}
                  <td className="px-5 py-4">
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span>{game.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 font-mono">{game.gameSlug}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                        {game.category}
                      </span>
                    </div>
                  </td>

                  {/* Operational Status */}
                  <td className="px-5 py-4">
                    {game.isMaintenance ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/40 text-amber-400 border border-amber-800/40">
                        <AlertTriangle className="w-3.5 h-3.5" /> Maintenance
                      </span>
                    ) : game.isEnabled ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-950/40 text-red-400 border border-red-800/40">
                        <XCircle className="w-3.5 h-3.5" /> Disabled
                      </span>
                    )}
                  </td>

                  {/* Visibility */}
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      game.visibility === 'FEATURED' 
                        ? 'bg-purple-950/50 text-purple-400 border border-purple-800/40' 
                        : game.visibility === 'VISIBLE'
                        ? 'bg-blue-950/50 text-blue-400 border border-blue-800/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {game.visibility}
                    </span>
                  </td>

                  {/* Dealer Speed */}
                  <td className="px-5 py-4 font-mono text-xs">
                    <span className="bg-slate-800/80 text-amber-300 px-2 py-1 rounded border border-slate-700/60 font-semibold">
                      {game.dealerSpeed}x
                    </span>
                  </td>

                  {/* Limits */}
                  <td className="px-5 py-4 text-xs font-mono text-slate-200">
                    <div>Min: ₹{game.minBet}</div>
                    <div className="text-slate-400">Max: ₹{game.maxBet?.toLocaleString()}</div>
                  </td>

                  {/* Durations */}
                  <td className="px-5 py-4 text-xs font-mono text-slate-300">
                    <div>Round: {game.roundDuration}s</div>
                    <div className="text-emerald-400">Betting: {game.bettingDuration}s</div>
                  </td>

                  {/* Versioned Payouts */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-mono font-bold px-2 py-0.5 rounded">
                        v{game.activePayoutVersion}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({game.payoutVersionsCount || 1} revs)
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => handleQuickToggleMaintenance(game, e)}
                        title={game.isMaintenance ? "Disable Maintenance" : "Enable Maintenance"}
                        className={`p-1.5 rounded-lg border text-xs font-medium transition ${
                          game.isMaintenance 
                            ? 'bg-amber-500 text-slate-950 border-amber-400' 
                            : 'bg-slate-800 text-slate-400 hover:text-amber-400 border-slate-700'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleQuickToggleActive(game, e)}
                        title={game.isEnabled ? "Disable Game" : "Enable Game"}
                        className={`p-1.5 rounded-lg border text-xs font-medium transition ${
                          game.isEnabled 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' 
                            : 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                        }`}
                      >
                        {game.isEnabled ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => openGameDetails(game.gameSlug)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-700"
                      >
                        <Settings2 className="w-3.5 h-3.5" /> Configure
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPREHENSIVE GAME CONFIGURATION MODAL / DRAWER */}
      {selectedSlug && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Gamepad2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {gameDetails?.name || selectedSlug}
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono font-normal">
                      {selectedSlug}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Active Financial Payout Version: <span className="text-emerald-400 font-mono font-bold">v{gameDetails?.activePayoutVersion}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSlug(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 gap-2 overflow-x-auto">
              {[
                { id: 'general', label: 'General & Visibility', icon: Settings2 },
                { id: 'limits', label: 'Bet Limits & Durations', icon: Sliders },
                { id: 'variants', label: 'Variants & Rooms', icon: Layers },
                { id: 'payouts', label: 'Versioned Payout Rules', icon: TrendingUp },
                { id: 'audits', label: 'Audit Trail', icon: History }
              ].map(t => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
                      isActive 
                        ? 'border-emerald-400 text-emerald-400 bg-slate-900/60' 
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailsLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading game control parameters...
                </div>
              ) : (
                <>
                  {/* TAB 1: GENERAL & VISIBILITY */}
                  {activeTab === 'general' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Game Status Toggle */}
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-white">Enable Game Operation</h3>
                              <p className="text-xs text-slate-400">Allow players to enter lobby and place bets</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={editConfig.isEnabled ?? true}
                              onChange={(e) => setEditConfig({ ...editConfig, isEnabled: e.target.checked })}
                              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                            />
                          </div>
                          <div className={`text-xs p-2.5 rounded-lg font-medium ${
                            editConfig.isEnabled ? 'bg-emerald-950/30 text-emerald-400' : 'bg-red-950/30 text-red-400'
                          }`}>
                            {editConfig.isEnabled ? '✅ Game is currently accessible to all players' : '🚫 Game is closed. Bet attempts will be rejected.'}
                          </div>
                        </div>

                        {/* Maintenance Mode Toggle */}
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-white">Maintenance Mode</h3>
                              <p className="text-xs text-slate-400">Suspend bets & display scheduled notice</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={editConfig.isMaintenance ?? false}
                              onChange={(e) => setEditConfig({ ...editConfig, isMaintenance: e.target.checked })}
                              className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400">Maintenance Banner Notice:</label>
                            <input
                              type="text"
                              value={editConfig.maintenanceMessage || ''}
                              onChange={(e) => setEditConfig({ ...editConfig, maintenanceMessage: e.target.value })}
                              placeholder="e.g. Card shoe replacement in progress. Back shortly."
                              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Lobby Visibility */}
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-3">
                          <h3 className="text-sm font-semibold text-white">Lobby Visibility</h3>
                          <p className="text-xs text-slate-400">Choose game promotional placement in platform lobby</p>
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            {(['FEATURED', 'VISIBLE', 'HIDDEN'] as const).map(vis => (
                              <button
                                key={vis}
                                type="button"
                                onClick={() => setEditConfig({ ...editConfig, visibility: vis })}
                                className={`py-2 text-xs font-semibold rounded-lg border transition ${
                                  editConfig.visibility === vis
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {vis}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Simulated Dealer Speed */}
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white">Simulated Dealer Speed</h3>
                            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded">
                              {editConfig.dealerSpeed}x
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">Controls dealing animations, countdown pacing, and card turn delays</p>
                          <div className="flex items-center gap-2 pt-2">
                            {[0.75, 1.0, 1.25, 1.5, 2.0].map(spd => (
                              <button
                                key={spd}
                                type="button"
                                onClick={() => setEditConfig({ ...editConfig, dealerSpeed: spd })}
                                className={`flex-1 py-1.5 text-xs font-mono font-semibold rounded-lg border transition ${
                                  editConfig.dealerSpeed === spd
                                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {spd}x
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4 border-t border-slate-800">
                        <button
                          onClick={handleSaveConfig}
                          disabled={isSavingConfig}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" /> {isSavingConfig ? 'Saving...' : 'Save General Settings'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: LIMITS & DURATIONS */}
                  {activeTab === 'limits' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Min & Max Bet */}
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
                          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Coins className="w-4 h-4 text-emerald-400" /> Financial Stake Limits (INR)
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-slate-400">Minimum Bet (₹)</label>
                              <input
                                type="number"
                                min="1"
                                value={editConfig.minBet || 10}
                                onChange={(e) => setEditConfig({ ...editConfig, minBet: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400">Maximum Bet (₹)</label>
                              <input
                                type="number"
                                min="10"
                                value={editConfig.maxBet || 50000}
                                onChange={(e) => setEditConfig({ ...editConfig, maxBet: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm mt-1"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Round Durations */}
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
                          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-400" /> Game Round Lifecycle Timing
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-slate-400">Total Round Cycle Duration (seconds)</label>
                              <input
                                type="number"
                                min="5"
                                value={editConfig.roundDuration || 30}
                                onChange={(e) => setEditConfig({ ...editConfig, roundDuration: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400">Betting Countdown Window (seconds)</label>
                              <input
                                type="number"
                                min="3"
                                value={editConfig.bettingDuration || 15}
                                onChange={(e) => setEditConfig({ ...editConfig, bettingDuration: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm mt-1"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Visual Cycle Timeline Preview */}
                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-3">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase">Live Cycle Preview</h4>
                        <div className="h-6 w-full bg-slate-800 rounded-lg overflow-hidden flex text-[10px] font-bold">
                          <div 
                            style={{ width: `${Math.min(100, Math.round(((editConfig.bettingDuration || 15) / (editConfig.roundDuration || 30)) * 100))}%` }}
                            className="bg-emerald-500 text-slate-950 flex items-center justify-center truncate px-2"
                          >
                            Betting ({editConfig.bettingDuration || 15}s)
                          </div>
                          <div className="flex-1 bg-blue-600 text-white flex items-center justify-center truncate px-2">
                            Dealing & Reveal ({(editConfig.roundDuration || 30) - (editConfig.bettingDuration || 15)}s)
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4 border-t border-slate-800">
                        <button
                          onClick={handleSaveConfig}
                          disabled={isSavingConfig}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" /> {isSavingConfig ? 'Saving...' : 'Save Limits & Durations'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: VARIANTS & ROOMS */}
                  {activeTab === 'variants' && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white">Configured Rooms & Variants</h3>
                        <p className="text-xs text-slate-400">Toggle individual variant availability without shutting down the entire game.</p>
                      </div>

                      <div className="space-y-3">
                        {(editConfig.variants || []).map((variant: Variant, idx: number) => (
                          <div 
                            key={variant.id}
                            className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between"
                          >
                            <div>
                              <h4 className="text-sm font-semibold text-white">{variant.name}</h4>
                              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                                <span>ID: {variant.id}</span>
                                {variant.minBet && <span>Min: ₹{variant.minBet}</span>}
                                {variant.maxBet && <span>Max: ₹{variant.maxBet}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                variant.isEnabled ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-red-950/60 text-red-400 border border-red-800/40'
                              }`}>
                                {variant.isEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                              <input
                                type="checkbox"
                                checked={variant.isEnabled}
                                onChange={(e) => {
                                  const updated = [...editConfig.variants];
                                  updated[idx] = { ...variant, isEnabled: e.target.checked };
                                  setEditConfig({ ...editConfig, variants: updated });
                                }}
                                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end pt-4 border-t border-slate-800">
                        <button
                          onClick={handleSaveConfig}
                          disabled={isSavingConfig}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" /> {isSavingConfig ? 'Saving...' : 'Save Variants'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: VERSIONED PAYOUT RULES */}
                  {activeTab === 'payouts' && (
                    <div className="space-y-6">
                      <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4 flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-emerald-300">Financial Payout Versioning & Audit Protection</h4>
                          <p className="text-xs text-emerald-400/80 mt-1 leading-relaxed">
                            Financial payout rules are strictly versioned. When new multipliers are deployed, a new sequential version is created and ongoing rounds lock to their creation version. All edits require a mandatory audit justification reason.
                          </p>
                        </div>
                      </div>

                      {/* Active Version Multipliers Form */}
                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <h3 className="text-sm font-semibold text-white">Payout Multipliers & Odds Configuration</h3>
                          <span className="bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-mono font-bold px-2.5 py-1 rounded">
                            Active Version: v{gameDetails?.activePayoutVersion}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {Object.entries(editablePayouts).map(([market, multiplier]) => (
                            <div key={market} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                              <label className="text-xs text-slate-400 font-mono font-semibold block truncate" title={market}>
                                {market}
                              </label>
                              <div className="mt-1 flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={multiplier}
                                  onChange={(e) => setEditablePayouts({ ...editablePayouts, [market]: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                                />
                                <span className="text-xs text-slate-500 font-mono">x</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-3 border-t border-slate-800 space-y-2">
                          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                            <span>Mandatory Audit Rationale / Justification:</span>
                            <span className="text-red-400">*</span>
                          </label>
                          <textarea
                            rows={2}
                            value={payoutReason}
                            onChange={(e) => setPayoutReason(e.target.value)}
                            placeholder="e.g. Festival Promotional RTP Boost - Calibrated for weekend volume."
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-slate-500">
                            Deploying will generate <strong className="text-emerald-400 font-mono">v{(gameDetails?.activePayoutVersion || 1) + 1}</strong>
                          </span>
                          <button
                            onClick={handleDeployPayoutVersion}
                            disabled={isDeployingPayout || !payoutReason.trim()}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition disabled:opacity-40"
                          >
                            <TrendingUp className="w-4 h-4" /> 
                            {isDeployingPayout ? 'Deploying...' : `Deploy New Payout Version (v${(gameDetails?.activePayoutVersion || 1) + 1})`}
                          </button>
                        </div>
                      </div>

                      {/* Version History Timeline */}
                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Historical Payout Revisions</h4>
                        <div className="space-y-3">
                          {(gameDetails?.versionHistory || []).map((ver) => (
                            <div 
                              key={ver.id}
                              className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                                ver.isActive 
                                  ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-300' 
                                  : 'bg-slate-900/40 border-slate-800 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                                    ver.isActive ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                                  }`}>
                                    v{ver.version}
                                  </span>
                                  {ver.isActive && <span className="text-emerald-400 font-semibold">(Current Active)</span>}
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Effective: {new Date(ver.effectiveFrom).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-slate-300 italic font-medium">"{ver.reason}"</p>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                                <span>Author: {ver.createdBy}</span>
                                <span>{Object.keys(ver.rules || {}).length} markets configured</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: AUDIT TRAIL */}
                  {activeTab === 'audits' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Immutable Administrative Audit Trail</h3>
                        <span className="text-xs text-slate-400">{gameDetails?.audits?.length || 0} events recorded</span>
                      </div>

                      <div className="space-y-2.5">
                        {(gameDetails?.audits || []).map((audit) => (
                          <div 
                            key={audit.id}
                            className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-emerald-400">{audit.action}</span>
                              <span className="text-slate-500 font-mono">{new Date(audit.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="text-slate-300">
                              <span className="text-slate-500">Reason:</span> {audit.reason || 'N/A'}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono pt-1 border-t border-slate-850">
                              <span>Admin ID: {audit.adminId}</span>
                              {audit.fieldChanged && <span>Field: {audit.fieldChanged}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

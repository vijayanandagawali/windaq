"use client";

import React, { useState, useEffect } from 'react';
import { 
  History, 
  ExternalLink, 
  ShieldCheck, 
  ChevronRight, 
  X, 
  Sparkles, 
  RefreshCw, 
  Layers 
} from 'lucide-react';
import { getApiUrl } from '@/lib/config';

export interface HistoryRound {
  roundId: string;
  gameId: string;
  variantId?: string;
  sequenceNumber?: string;
  result: any;
  resultSummary?: string;
  multiplier?: number;
  winningNumber?: number;
  winningColor?: string;
  cards?: any;
  serverSeedHash?: string;
  serverSeed?: string;
  clientSeed?: string;
  nonce?: number;
  fairnessRef?: string;
  settlementStatus?: string;
  completedAt?: string | Date;
}

interface Props {
  gameId: string;
  variantId?: string;
  initialHistory?: HistoryRound[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ResultHistoryDrawer({
  gameId,
  variantId = 'Standard',
  initialHistory = [],
  isOpen,
  onClose
}: Props) {
  const [rounds, setRounds] = useState<HistoryRound[]>(initialHistory);
  const [limit, setLimit] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRound, setSelectedRound] = useState<HistoryRound | null>(null);

  const fetchHistory = async (count: number) => {
    setLoading(true);
    try {
      const url = getApiUrl(`/api/history/${gameId}?limit=${count}&variantId=${variantId}`);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setRounds(data.history);
        }
      }
    } catch (err) {
      console.warn('[ResultHistoryDrawer] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory(limit);
    }
  }, [isOpen, limit, gameId, variantId]);

  if (!isOpen) return null;

  // Render game-specific result badge
  const renderResultBadge = (round: HistoryRound) => {
    const summary = round.resultSummary || (round.result?.winner) || (round.result?.resultNumber !== undefined ? `${round.result.resultNumber}` : 'Completed');

    if (gameId === 'dragon-tiger') {
      const isDragon = summary.toUpperCase().includes('DRAGON');
      const isTiger = summary.toUpperCase().includes('TIGER');
      const isTie = summary.toUpperCase().includes('TIE');

      const colorClass = isDragon 
        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' 
        : isTiger 
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

      return (
        <span className={`px-2.5 py-1 text-xs font-black rounded-md border tracking-wider uppercase ${colorClass}`}>
          {summary}
        </span>
      );
    }

    if (gameId === 'roulette') {
      const num = round.winningNumber ?? round.result?.resultNumber;
      const col = round.winningColor ?? round.result?.color ?? (num === 0 ? 'green' : ([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num) ? 'red' : 'black'));
      const bgClass = col === 'green' ? 'bg-emerald-600 text-white' : (col === 'red' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white border border-slate-700');

      return (
        <span className={`w-7 h-7 flex items-center justify-center font-mono font-black text-xs rounded-full shadow-inner ${bgClass}`}>
          {num !== undefined ? num : '?'}
        </span>
      );
    }

    if (gameId === 'aviator' || gameId === 'crash') {
      const mult = round.multiplier ?? round.result?.crashPoint ?? 1.0;
      const multColor = mult >= 10 ? 'text-amber-400 bg-amber-500/20 border-amber-500/30' : (mult >= 2 ? 'text-purple-400 bg-purple-500/20 border-purple-500/30' : 'text-blue-400 bg-blue-500/20 border-blue-500/30');

      return (
        <span className={`px-2.5 py-1 text-xs font-mono font-black rounded-md border tracking-wider ${multColor}`}>
          {typeof mult === 'number' ? mult.toFixed(2) : mult}x
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-800 text-slate-200 border border-slate-700">
        {summary}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white uppercase">Official Result History</h2>
              <p className="text-[11px] text-slate-400">Server-Authoritative • Provably Fair</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Count Selector Tabs */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            {[10, 20, 50, 100].map(c => (
              <button
                key={c}
                onClick={() => setLimit(c)}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  limit === c 
                    ? 'bg-emerald-500 text-slate-950 shadow' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <button 
            onClick={() => fetchHistory(limit)}
            disabled={loading}
            title="Refresh History"
            className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* List of Results */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2">
          {loading && rounds.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
              Loading authoritative rounds...
            </div>
          ) : rounds.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No completed rounds recorded yet.
            </div>
          ) : (
            rounds.map((round) => (
              <div 
                key={round.roundId}
                onClick={() => setSelectedRound(round)}
                className="p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors flex items-center justify-between group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {round.roundId}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono">
                      SETTLED
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {round.completedAt ? new Date(round.completedAt).toLocaleTimeString() : 'Recent'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {renderResultBadge(round)}
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Verification Detail Modal / Drawer */}
        {selectedRound && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 text-xs space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                Cryptographic Commitment Proof
              </div>
              <button 
                onClick={() => setSelectedRound(null)}
                className="text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div>
              <span className="text-slate-400 font-semibold">Round ID:</span>
              <p className="font-mono text-slate-200 break-all">{selectedRound.roundId}</p>
            </div>

            <div>
              <span className="text-slate-400 font-semibold">Pre-Committed SHA-256 Hash:</span>
              <p className="font-mono text-emerald-400 text-[10px] break-all bg-slate-900 p-1.5 rounded border border-slate-800">
                {selectedRound.serverSeedHash || 'Generated prior to betting lock'}
              </p>
            </div>

            {selectedRound.serverSeed && (
              <div>
                <span className="text-slate-400 font-semibold">Revealed Server Seed:</span>
                <p className="font-mono text-slate-300 text-[10px] break-all bg-slate-900 p-1.5 rounded border border-slate-800">
                  {selectedRound.serverSeed}
                </p>
              </div>
            )}

            {selectedRound.clientSeed && (
              <div>
                <span className="text-slate-400 font-semibold">Revealed Client Entropy:</span>
                <p className="font-mono text-slate-300 text-[10px] break-all bg-slate-900 p-1.5 rounded border border-slate-800">
                  {selectedRound.clientSeed}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

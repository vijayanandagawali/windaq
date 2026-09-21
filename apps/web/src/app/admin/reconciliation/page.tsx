"use client";

import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, RefreshCw, 
  Search, Filter, ExternalLink, ArrowRight, Play, Eye, FileText, 
  X, Check, AlertCircle, TrendingUp
} from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface SummaryCards {
  totalWallets: number;
  totalTransactions: number;
  matchedCount: number;
  mismatchCount: number;
  pendingCount: number;
  manualReviewCount: number;
  resolvedCount: number;
  totalSystemDiscrepancy: number;
}

interface ReconciliationCase {
  id: string;
  caseId: string;
  userId: string;
  referenceId: string;
  transactionId?: string;
  provider: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  status: string;
  reason: string;
  metadata?: any;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionReference?: string;
}

export default function AdminReconciliationPage() {
  const { user, token } = useAuthStore();
  const [summary, setSummary] = useState<SummaryCards>({
    totalWallets: 0,
    totalTransactions: 0,
    matchedCount: 0,
    mismatchCount: 0,
    pendingCount: 0,
    manualReviewCount: 0,
    resolvedCount: 0,
    totalSystemDiscrepancy: 0
  });

  const [cases, setCases] = useState<ReconciliationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSweep, setRunningSweep] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedCase, setSelectedCase] = useState<ReconciliationCase | null>(null);

  // Resolution modal state
  const [resolvingCase, setResolvingCase] = useState<ReconciliationCase | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState('RESOLVED');
  const [resolutionReference, setResolutionReference] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  const getHeaders = () => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('windaq_auth_token') : null);
    const uid = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('windaq_user_id') : null);
    return {
      'Content-Type': 'application/json',
      ...(uid ? { 'x-user-id': uid } : {}),
      ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
    };
  };

  const fetchReconciliationData = async () => {
    setLoading(true);
    try {
      // 1. Fetch dashboard summary
      const sumRes = await fetch(getApiUrl('/api/admin/reconciliation/summary'), {
        headers: getHeaders()
      });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        if (sumData.success && sumData.data) {
          setSummary(sumData.data);
        }
      }

      // 2. Fetch cases
      const casesRes = await fetch(getApiUrl(`/api/admin/reconciliation/cases?status=${statusFilter}`), {
        headers: getHeaders()
      });
      if (casesRes.ok) {
        const casesData = await casesRes.json();
        if (casesData.success && Array.isArray(casesData.data)) {
          setCases(casesData.data);
        }
      }
    } catch (err) {
      console.error('Failed to load reconciliation data:', err);
      toast.error('Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliationData();
  }, [statusFilter]);

  const handleRunSweep = async () => {
    setRunningSweep(true);
    try {
      const res = await fetch(getApiUrl('/api/admin/reconciliation/run'), {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Automated reconciliation complete! Checked ${data.data?.walletsChecked || 0} wallets. Discrepancies: ${data.data?.discrepanciesFound || 0}`);
        await fetchReconciliationData();
      } else {
        toast.error(data.message || 'Reconciliation sweep failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error during reconciliation sweep');
    } finally {
      setRunningSweep(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingCase) return;

    if (!resolutionReference.trim()) {
      toast.error('Audited Resolution Reference (e.g. BANK-DISPUTE-REF-1049) is strictly required.');
      return;
    }

    setIsSubmittingResolution(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/reconciliation/cases/${resolvingCase.caseId || resolvingCase.id}/resolve`), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          status: resolutionStatus,
          resolutionReference: resolutionReference.trim(),
          notes: resolutionNotes.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Case ${resolvingCase.caseId || resolvingCase.id} resolved with audited reference`);
        setResolvingCase(null);
        setResolutionReference('');
        setResolutionNotes('');
        await fetchReconciliationData();
      } else {
        toast.error(data.message || 'Failed to submit case resolution');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error submitting case resolution');
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-400 w-8 h-8" />
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">Wallet Reconciliation Engine</h1>
            <span className="text-[11px] font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">
              PROMPT #69 AUDIT ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Detects discrepancies between Payment Gateways, Authoritative Double-Entry Ledger, and User Wallets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchReconciliationData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleRunSweep}
            disabled={runningSweep}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Play size={14} fill="currentColor" />
            <span>{runningSweep ? 'Scanning Wallets...' : 'Run Automated Sweep'}</span>
          </button>
        </div>
      </div>

      {/* 7 Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Wallets</span>
          <span className="text-xl font-mono font-black text-white">{summary.totalWallets}</span>
          <span className="text-[10px] text-slate-400 block mt-1">Checked on DB</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Transactions</span>
          <span className="text-xl font-mono font-black text-slate-200">{summary.totalTransactions}</span>
          <span className="text-[10px] text-slate-400 block mt-1">Double-Entry</span>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Matched</span>
          <span className="text-xl font-mono font-black text-emerald-400">{summary.matchedCount}</span>
          <span className="text-[10px] text-emerald-500/80 block mt-1">₹0.00 Diff</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pending</span>
          <span className="text-xl font-mono font-black text-amber-300">{summary.pendingCount}</span>
          <span className="text-[10px] text-amber-400/80 block mt-1">In-Flight</span>
        </div>

        <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Mismatched</span>
          <span className="text-xl font-mono font-black text-rose-400">{summary.mismatchCount}</span>
          <span className="text-[10px] text-rose-400/80 block mt-1">Investigate</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Manual Review</span>
          <span className="text-xl font-mono font-black text-cyan-300">{summary.manualReviewCount}</span>
          <span className="text-[10px] text-cyan-400/80 block mt-1">Awaiting Docs</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Resolved</span>
          <span className="text-xl font-mono font-black text-emerald-300">{summary.resolvedCount}</span>
          <span className="text-[10px] text-emerald-400/80 block mt-1">Compensated</span>
        </div>
      </div>

      {/* Discrepancy Alert Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between ${
        summary.totalSystemDiscrepancy === 0 
          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
          : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
      }`}>
        <div className="flex items-center gap-3">
          {summary.totalSystemDiscrepancy === 0 ? (
            <CheckCircle2 className="text-emerald-400 w-6 h-6 shrink-0" />
          ) : (
            <AlertTriangle className="text-rose-400 w-6 h-6 shrink-0" />
          )}
          <div>
            <h3 className="font-bold text-sm">
              {summary.totalSystemDiscrepancy === 0 
                ? 'System Reconciliation Status: 100% HEALTHY' 
                : 'Active System Discrepancy Detected!'}
            </h3>
            <p className="text-xs opacity-80 mt-0.5">
              {summary.totalSystemDiscrepancy === 0 
                ? 'All user wallets, gateway records, and double-entry ledger entries match with ₹0.00 difference.' 
                : `Total unresolved variance: ₹${Math.abs(summary.totalSystemDiscrepancy).toFixed(2)}. Requires audited resolution.`}
            </p>
          </div>
        </div>
        <div className="font-mono font-black text-lg">
          Diff: ₹{summary.totalSystemDiscrepancy.toFixed(2)}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1 overflow-x-auto">
          {['ALL', 'MATCHED', 'PENDING', 'MISMATCH', 'MANUAL_REVIEW_REQUIRED', 'RESOLVED'].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === filter
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {filter.replace('_', ' ')}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-mono pr-2">
          {cases.length} cases shown
        </span>
      </div>

      {/* Discrepancy & Cases Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="animate-spin text-emerald-400 mx-auto mb-3" size={24} />
            <p className="text-xs text-slate-400 font-mono">Loading audited cases...</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 className="text-emerald-400 w-12 h-12 mx-auto mb-3 opacity-80" />
            <h3 className="text-base font-bold text-white">No Reconciliation Cases in Current Filter</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {statusFilter === 'MISMATCH' 
                ? 'Great news! There are zero financial mismatches across all wallets.' 
                : 'Click "Run Automated Sweep" to perform a full system balance cross-examination.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-4">Case ID</th>
                  <th className="p-4">User ID</th>
                  <th className="p-4">Provider / Ref</th>
                  <th className="p-4">Expected</th>
                  <th className="p-4">Actual Ledger</th>
                  <th className="p-4">Difference</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created</th>
                  <th className="p-4 text-right">Audited Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {cases.map((c) => (
                  <tr key={c.id || c.caseId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-bold text-emerald-400">
                      {c.caseId || c.id.substring(0, 8)}
                    </td>
                    <td className="p-4 text-slate-300 font-normal truncate max-w-[120px]">
                      {c.userId}
                    </td>
                    <td className="p-4 text-slate-300 font-normal">
                      <span className="font-bold text-white">{c.provider || 'INTERNAL'}</span>
                      <span className="block text-[10px] text-slate-500 truncate max-w-[150px]">{c.referenceId}</span>
                    </td>
                    <td className="p-4 text-slate-200">
                      ₹{c.expectedAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td className="p-4 text-slate-200">
                      ₹{c.actualAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td className="p-4">
                      <span className={`font-bold ${c.difference === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {c.difference > 0 ? '+' : ''}₹{c.difference?.toFixed(2) || '0.00'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        c.status === 'MATCHED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                        c.status === 'RESOLVED' ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' :
                        c.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                        'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedCase(c)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          Inspect
                        </button>
                        {c.status !== 'RESOLVED' && c.status !== 'MATCHED' && (
                          <button
                            onClick={() => {
                              setResolvingCase(c);
                              setResolutionReference('');
                              setResolutionNotes('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors cursor-pointer"
                          >
                            Resolve Case
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: INSPECT CASE DETAIL */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="text-emerald-400" size={20} />
                <h3 className="text-base font-black text-white">Case Inspection: {selectedCase.caseId || selectedCase.id}</h3>
              </div>
              <button onClick={() => setSelectedCase(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">User ID</span>
                  <span className="text-slate-300 font-bold break-all">{selectedCase.userId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                  <span className="text-emerald-400 font-bold">{selectedCase.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Expected (Gateway)</span>
                  <span className="text-slate-200 font-bold">₹{selectedCase.expectedAmount?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Actual (Ledger)</span>
                  <span className="text-slate-200 font-bold">₹{selectedCase.actualAmount?.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Reason / Description</span>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 font-mono text-[11px]">
                  {selectedCase.reason || 'No specific reason logged.'}
                </div>
              </div>

              {selectedCase.resolutionReference && (
                <div className="bg-teal-950/20 border border-teal-500/30 p-3 rounded-xl">
                  <span className="text-[10px] text-teal-400 uppercase font-bold block">Resolution Audit Proof</span>
                  <p className="font-mono text-xs text-white mt-0.5">{selectedCase.resolutionReference}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Resolved By: {selectedCase.resolvedBy} at {selectedCase.resolvedAt}</p>
                </div>
              )}

              <button
                onClick={() => setSelectedCase(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer mt-4"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RESOLVE DISCREPANCY (STRICT AUDITED RESOLUTION ONLY) */}
      {resolvingCase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-400" size={20} />
                <h3 className="text-base font-black text-white">Audited Resolution Workflow</h3>
              </div>
              <button onClick={() => setResolvingCase(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="mt-4 space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between text-slate-400">
                  <span>Case ID:</span>
                  <span className="text-white font-mono font-bold">{resolvingCase.caseId || resolvingCase.id}</span>
                </div>
                <div className="flex justify-between text-slate-400 mt-1">
                  <span>Difference:</span>
                  <span className="text-rose-400 font-mono font-bold">₹{resolvingCase.difference?.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Target Status</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-emerald-400 outline-none"
                >
                  <option value="RESOLVED">RESOLVED (Audit matched)</option>
                  <option value="MANUAL_REVIEW_REQUIRED">ESCALATE TO MANUAL REVIEW</option>
                  <option value="MATCHED">FORCE MATCH WITH BANK PROOF</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  Audited Bank/Gateway Reference (MANDATORY)
                </label>
                <input
                  type="text"
                  value={resolutionReference}
                  onChange={(e) => setResolutionReference(e.target.value)}
                  placeholder="e.g. PG-SETTLE-REF-90214 or DISPUTE-TICKET-582"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-emerald-400 outline-none"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Notice: Arbitrary balance edits are prohibited. Every resolution logs an immutable admin audit event.
                </span>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Resolution Audit Notes</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="State the justification, bank statement reference, or reversal confirmation."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-emerald-400 outline-none h-20"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingCase(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolution}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingResolution ? 'Auditing...' : 'Commit Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

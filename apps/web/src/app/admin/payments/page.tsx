'use client';
import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, ArrowRightLeft, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { getApiUrl } from '@/lib/config';

type Kind = 'deposits' | 'withdrawals';

interface PendingIntent {
  id: string;
  userId: string;
  amount: string;
  provider: string;
  status: string;
  createdAt: string;
  metadata?: { utr?: string; destination?: string; kycStatus?: string } | null;
  user?: { phone?: string } | null;
}

const COPY: Record<Kind, { approveLabel: string; approvePrompt: string; noteRequiredOnApprove: boolean }> = {
  deposits: {
    approveLabel: 'Verify & Credit',
    approvePrompt: 'Confirm the UTR appears on the bank statement for this exact amount. Optional note:',
    noteRequiredOnApprove: false
  },
  withdrawals: {
    approveLabel: 'Mark as Paid',
    approvePrompt: 'Send the payout manually first, then enter the payout UTR/reference:',
    noteRequiredOnApprove: true
  }
};

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  return headers;
}

async function loadPending(target: Kind): Promise<{ items: PendingIntent[]; error: string | null }> {
  try {
    const res = await fetch(getApiUrl(`/api/payments/admin/${target}/pending`), { headers: authHeaders() });
    const data = await res.json();
    if (res.ok && data.success) return { items: data.data, error: null };
    return { items: [], error: data.message || `Could not load pending ${target} (HTTP ${res.status}).` };
  } catch {
    return { items: [], error: 'Payment service unreachable.' };
  }
}

export default function PaymentsReviewPage() {
  const [kind, setKind] = useState<Kind>('deposits');
  const [items, setItems] = useState<PendingIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Reload counter: bumping it re-runs the loader effect (refresh button, after approve/reject).
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadPending(kind).then((result) => {
      if (cancelled) return;
      setItems(result.items);
      setError(result.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, reloadToken]);

  const reload = () => {
    setLoading(true);
    setReloadToken((n) => n + 1);
  };

  const switchKind = (next: Kind) => {
    if (next === kind) return;
    setLoading(true);
    setItems([]);
    setKind(next);
  };

  const act = async (id: string, action: 'approve' | 'reject') => {
    const copy = COPY[kind];
    const note = window.prompt(action === 'approve' ? copy.approvePrompt : 'Reason for rejection (shown in audit log):');
    if (note === null) return;
    if ((action === 'reject' || copy.noteRequiredOnApprove) && !note.trim()) {
      alert('A note is required for this action.');
      return;
    }

    setBusyId(id);
    try {
      const res = await fetch(getApiUrl(`/api/payments/admin/${kind}/${id}/${action}`), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ note: note.trim() })
      });
      const data = await res.json();
      if (!data.success) alert(data.message || `Failed to ${action}`);
      reload();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-blue-500" />
            Payment Review
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Deposits are credited automatically when the bank&apos;s credit SMS matches the player&apos;s UTR and amount. Anything unmatched waits here for a finance officer; withdrawals are always paid manually.
          </p>
        </div>
        <button
          onClick={reload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded hover:bg-slate-100"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div role="tablist" className="flex gap-2">
        {(['deposits', 'withdrawals'] as Kind[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            onClick={() => switchKind(k)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border ${
              kind === k ? 'bg-blue-500/15 text-blue-700 border-blue-500/40' : 'text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {k === 'deposits' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
            Pending {k}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white/90 border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Amount (INR)</th>
                <th className="px-6 py-4">{kind === 'deposits' ? 'Player UTR' : 'Destination VPA'}</th>
                {kind === 'withdrawals' && <th className="px-6 py-4">KYC</th>}
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((req) => (
                <tr key={req.id} className="border-b border-slate-200 hover:bg-slate-100">
                  <td className="px-6 py-4 text-xs text-slate-500">{new Date(req.createdAt).toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 font-mono text-sm text-slate-900">{req.user?.phone || req.userId.substring(0, 12)}</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">₹{(Number(req.amount) / 100).toFixed(2)}</td>
                  <td className="px-6 py-4 font-mono text-slate-600 text-xs">
                    {kind === 'deposits' ? req.metadata?.utr || '—' : req.metadata?.destination || '—'}
                  </td>
                  {kind === 'withdrawals' && (
                    <td className="px-6 py-4 text-xs font-bold">{req.metadata?.kycStatus || 'PENDING'}</td>
                  )}
                  <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                    <button
                      disabled={busyId === req.id}
                      onClick={() => act(req.id, 'approve')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 rounded transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" /> {COPY[kind].approveLabel}
                    </button>
                    <button
                      disabled={busyId === req.id}
                      onClick={() => act(req.id, 'reject')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/30 rounded transition disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && !error && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No pending {kind} to review.</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BankCreditsPanel reloadToken={reloadToken} />
    </div>
  );
}

interface BankCreditRow {
  id: string;
  utr: string;
  amountInr: number;
  sender: string;
  payerName?: string | null;
  status: 'UNMATCHED' | 'MATCHED' | 'AMOUNT_MISMATCH';
  bankReceivedAt: string;
}

const CREDIT_BADGE: Record<BankCreditRow['status'], string> = {
  MATCHED: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30',
  UNMATCHED: 'text-amber-700 bg-amber-500/10 border-amber-500/30',
  AMOUNT_MISMATCH: 'text-red-700 bg-red-500/10 border-red-500/30'
};

/** Money the bank reported as received (forwarded credit SMS), newest first. */
function BankCreditsPanel({ reloadToken }: { reloadToken: number }) {
  const [rows, setRows] = useState<BankCreditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(getApiUrl('/api/payments/admin/bank-credits'), { headers: authHeaders(), cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.success) { setRows(data.data); setError(null); }
        else setError(data.message || `Could not load bank credits (HTTP ${res.status}).`);
      })
      .catch(() => !cancelled && setError('Payment service unreachable.'));
    return () => { cancelled = true; };
  }, [reloadToken]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Bank credits received</h2>
        <p className="text-xs text-slate-500">From the bank SMS forwarder. UNMATCHED: no player has submitted this UTR yet. AMOUNT_MISMATCH: the player claimed a different amount — resolve manually.</p>
      </div>
      {error && <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-700">{error}</div>}
      <div className="bg-white/90 border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Received</th>
              <th className="px-6 py-3">UTR</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">From</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((c) => (
              <tr key={c.id} className="border-b border-slate-200">
                <td className="px-6 py-3 text-xs text-slate-500">{new Date(c.bankReceivedAt).toLocaleString('en-IN')}</td>
                <td className="px-6 py-3 font-mono text-xs">{c.utr}</td>
                <td className="px-6 py-3 font-bold text-emerald-600">₹{c.amountInr.toFixed(2)}</td>
                <td className="px-6 py-3 text-xs">{c.payerName || '—'} <span className="text-slate-500">({c.sender})</span></td>
                <td className="px-6 py-3"><span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${CREDIT_BADGE[c.status]}`}>{c.status}</span></td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-6 text-center text-slate-500">No bank credits received yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

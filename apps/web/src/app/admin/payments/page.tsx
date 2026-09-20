'use client';
import React, { useEffect, useState } from 'react';
import { CreditCard, CheckCircle2, XCircle, ArrowRightLeft, Search } from 'lucide-react';

export default function PaymentsReconciliationPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithdrawals = () => {
    setLoading(true);
    fetch('http://localhost:4000/api/payments/admin/withdrawals/pending', {
      headers: { 'x-admin-user-id': 'mock-super-admin-id' }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setWithdrawals(data.data);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/payments/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-user-id': 'mock-super-admin-id'
        }
      });
      const data = await res.json();
      
      if (data.success) {
        fetchWithdrawals();
      } else {
        alert(data.message || 'Failed to approve');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-blue-500" />
            Withdrawal Reconciliation
          </h1>
          <p className="text-sm text-slate-400 mt-1">Review and approve high-value withdrawals before dispatching to provider.</p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Amount (INR)</th>
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4">Destination VPA</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((req) => (
                <tr key={req.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-mono text-sm text-white">
                    {req.user?.phone || req.userId.substring(0,8)}
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-400">
                    ₹{(Number(req.amount) / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs font-mono border border-slate-700">
                      {req.provider}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                    {req.metadata?.destination || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs font-bold uppercase">
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => handleApprove(req.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded transition"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve & Payout
                    </button>
                  </td>
                </tr>
              ))}
              {withdrawals.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No pending withdrawals to review.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

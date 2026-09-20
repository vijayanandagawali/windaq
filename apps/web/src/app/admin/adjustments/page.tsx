'use client';
import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, Clock } from 'lucide-react';

export default function WalletAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState('');

  const fetchAdjustments = () => {
    setLoading(true);
    fetch('http://localhost:4000/api/admin/adjustments', {
      headers: { 'x-admin-user-id': 'mock-super-admin-id' }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAdjustments(data.data);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const handleApprove = async (id: string) => {
    if (!mfaToken) {
      setError('MFA Token required for approval.');
      return;
    }
    setError('');
    
    try {
      const res = await fetch(`http://localhost:4000/api/admin/adjustments/${id}/approve`, {
        method: 'POST',
        headers: { 
          'x-admin-user-id': 'mock-super-admin-id',
          'x-mfa-token': mfaToken
        }
      });
      const data = await res.json();
      
      if (data.success) {
        setMfaToken('');
        fetchAdjustments();
      } else {
        setError(data.message || 'Failed to approve');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Manual Wallet Adjustments</h1>
          <p className="text-sm text-slate-400">Strict dual-authorization workflow for manual credits/debits.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-900 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3">
          <ShieldAlert className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Wallet ID</th>
                <th className="px-6 py-4 text-right">Amount (INR)</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adj) => (
                <tr key={adj.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-mono text-xs">{adj.id.substring(0,8)}...</td>
                  <td className="px-6 py-4 font-mono text-xs">{adj.walletId.substring(0,8)}...</td>
                  <td className={`px-6 py-4 text-right font-medium ${Number(adj.amount) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ₹ {(Number(adj.amount) / 100).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 max-w-[200px] truncate">{adj.reason}</td>
                  <td className="px-6 py-4">
                    {adj.status === 'PENDING' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Pending</span>}
                    {adj.status === 'APPROVED' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Approved</span>}
                  </td>
                  <td className="px-6 py-4">
                    {adj.status === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="password" 
                          placeholder="MFA PIN"
                          className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          value={mfaToken}
                          onChange={(e) => setMfaToken(e.target.value)}
                        />
                        <button 
                          onClick={() => handleApprove(adj.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
                        >
                          Approve
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">Processed by {adj.approver?.phone || adj.approvedBy}</span>
                    )}
                  </td>
                </tr>
              ))}
              {adjustments.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No adjustments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

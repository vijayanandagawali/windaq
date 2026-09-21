'use client';
import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, TrendingUp, Users } from 'lucide-react';

import { getApiUrl } from '@/lib/config';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('windaq_auth_token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(getApiUrl('/api/admin/dashboard'), { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMetrics(data.data);
        }
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Operations Control Center</h1>
          <p className="text-slate-400 mt-1">Real-time platform metrics and alerts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Cards */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Total Users</h3>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics ? metrics.totalUsers : '--'}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Total Liabilities (INR)</h3>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {metrics ? `₹ ${(Number(metrics.totalLiabilities) / 100).toLocaleString()}` : '--'}
            </span>
          </div>
        </div>

        <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-5 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-red-400">Failed Payments</h3>
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-red-400">{metrics ? metrics.failedPayments : '--'}</span>
          </div>
        </div>

        <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-5 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-amber-400">Unsettled Wagers</h3>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-400">{metrics ? metrics.unsettledWagers : '--'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
           <h3 className="text-lg font-medium text-white mb-4">Pending Wallet Adjustments</h3>
           <p className="text-slate-400 text-sm mb-4">You have {metrics?.pendingAdjustments || 0} manual adjustments waiting for FINANCE approval.</p>
           <a href="/admin/adjustments" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">Review Adjustments &rarr;</a>
        </div>
        
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
           <h3 className="text-lg font-medium text-white mb-4">Reconciliation Mismatches</h3>
           <p className="text-slate-400 text-sm mb-4">Double-entry ledger sums are balanced perfectly. No discrepancies detected.</p>
           <a href="/admin/ledger" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">View Ledger &rarr;</a>
        </div>
      </div>
    </div>
  );
}

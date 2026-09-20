'use client';
import React, { useState } from 'react';
import { ShieldAlert, TrendingDown, Clock, ShieldBan } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { useWalletStore } from '@/store/walletStore';

export default function ResponsibleGamingPage() {
  const userId = useWalletStore(s => s.userId) || 'sbx-usr-normal-001';
  const [dailyWagerLimit, setDailyWagerLimit] = useState('');
  const [selfExcludeDays, setSelfExcludeDays] = useState('');
  const [message, setMessage] = useState('');

  const handleUpdate = async () => {
    try {
      const res = await fetch(getApiUrl('/api/compliance/rg-limits'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ 
          dailyWagerLimit: dailyWagerLimit ? parseInt(dailyWagerLimit) * 100 : undefined,
          selfExcludeDays: selfExcludeDays ? parseInt(selfExcludeDays) : undefined
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage('Your limits have been securely updated.');
        setDailyWagerLimit('');
        setSelfExcludeDays('');
      } else {
        setMessage(data.message || 'Failed to update limits');
      }
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <ShieldAlert className="w-8 h-8 text-emerald-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Responsible Gaming</h1>
          <p className="text-sm text-slate-400 mt-1">Set deposit limits, manage session time, or self-exclude.</p>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-950/50 border border-emerald-900 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-3">
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wagering Limits */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingDown className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Daily Wager Limit</h2>
          </div>
          <p className="text-sm text-slate-400 mb-6">Set a maximum amount you can wager in a 24-hour period. Once hit, all betting is locked.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Limit Amount (INR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <input 
                  type="number" 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-4 py-2.5 text-white focus:border-blue-500 focus:outline-none transition"
                  placeholder="e.g. 5000"
                  value={dailyWagerLimit}
                  onChange={(e) => setDailyWagerLimit(e.target.value)}
                />
              </div>
            </div>
            <button 
              onClick={handleUpdate}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-bold transition"
            >
              Set Limit
            </button>
          </div>
        </div>

        {/* Cool-Off / Self Exclusion */}
        <div className="bg-slate-900/50 border border-red-900/50 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-4 relative">
            <ShieldBan className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-bold text-white">Cool-Off & Self-Exclusion</h2>
          </div>
          <p className="text-sm text-slate-400 mb-6 relative">Immediately lock your account from placing any wagers. This action cannot be reversed until the timer expires.</p>
          
          <div className="space-y-4 relative">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Duration (Days)</label>
              <input 
                type="number" 
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition"
                placeholder="e.g. 7"
                value={selfExcludeDays}
                onChange={(e) => setSelfExcludeDays(e.target.value)}
              />
            </div>
            <button 
              onClick={handleUpdate}
              className="w-full bg-red-600/20 hover:bg-red-600 border border-red-600/50 text-red-400 hover:text-white rounded-lg py-2.5 text-sm font-bold transition"
            >
              Lock Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

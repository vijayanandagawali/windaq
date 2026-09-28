"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ShieldCheck, AlertTriangle, Clock, Ban, CheckCircle, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResponsibleGamingPage() {
  const [dailyLimit, setDailyLimit] = useState('50000');
  const [lossLimit, setLossLimit] = useState('25000');
  const [sessionTime, setSessionTime] = useState('60');
  const [selfExclusionPeriod, setSelfExclusionPeriod] = useState('none');
  const [saving, setSaving] = useState(false);

  const handleSaveLimits = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Responsible gaming limits updated successfully!');
    }, 600);
  };

  const handleSelfExclude = () => {
    if (selfExclusionPeriod === 'none') {
      toast.error('Please select an exclusion duration');
      return;
    }
    toast.success(`Self-exclusion initiated for ${selfExclusionPeriod}. Account gameplay is temporarily locked.`);
  };

  return (
    <main className="min-h-screen bg-white font-sans selection:bg-[#26F0B2] text-[#F4FBFF] max-w-lg mx-auto pb-12 shadow-2xl">
      {/* Page Title Banner */}
      <div className="px-4 py-3 bg-white/90 border-b border-slate-200 flex items-center justify-between">
        <h1 className="font-black text-sm tracking-wider uppercase text-slate-900">RESPONSIBLE GAMING</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 18+ Caution Card */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-700 font-black text-sm">STRICTLY 18+ ONLY</h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              WinDaq strictly prohibits underage participation. Real-money gaming carries financial risk and may be addictive. Please play responsibly and within your financial means.
            </p>
          </div>
        </div>

        {/* Deposit & Loss Limits */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={20} className="text-[#26F0B2]" />
            <h2 className="font-black text-base text-slate-900">PLAYING LIMIT CONTROLS</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-extrabold uppercase text-[#8EA8B8] block mb-1">
                Daily Deposit Limit (₹)
              </label>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold text-sm outline-none focus:border-[#26F0B2]"
              />
            </div>

            <div>
              <label className="text-[11px] font-extrabold uppercase text-[#8EA8B8] block mb-1">
                Daily Loss Limit (₹)
              </label>
              <input
                type="number"
                value={lossLimit}
                onChange={(e) => setLossLimit(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold text-sm outline-none focus:border-[#26F0B2]"
              />
            </div>

            <div>
              <label className="text-[11px] font-extrabold uppercase text-[#8EA8B8] block mb-1">
                Session Reminder Interval
              </label>
              <select
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold text-sm outline-none focus:border-[#26F0B2]"
              >
                <option value="30">Every 30 Minutes</option>
                <option value="60">Every 60 Minutes (Recommended)</option>
                <option value="120">Every 120 Minutes</option>
              </select>
            </div>

            <button
              onClick={handleSaveLimits}
              disabled={saving}
              className="w-full mt-2 py-3 rounded-xl bg-[#26F0B2] text-[#061625] font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(38,240,178,0.4)] hover:bg-[#1ed49c] active:scale-95 transition-all"
            >
              {saving ? 'Saving...' : 'SAVE GAMING LIMITS'}
            </button>
          </div>
        </div>

        {/* Self-Exclusion Tool */}
        <div className="bg-white border border-red-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Ban size={20} className="text-red-600" />
            <h2 className="font-black text-base text-slate-900">SELF-EXCLUSION & COOLING OFF</h2>
          </div>
          <p className="text-xs text-[#8EA8B8] mb-3 leading-relaxed">
            Need a break? Temporarily or permanently suspend your account. During self-exclusion, all wagering and deposits are locked.
          </p>

          <select
            value={selfExclusionPeriod}
            onChange={(e) => setSelfExclusionPeriod(e.target.value)}
            className="w-full bg-white border border-red-500/30 rounded-xl px-3 py-2.5 text-slate-900 font-bold text-sm outline-none mb-3"
          >
            <option value="none">Select Period...</option>
            <option value="24 Hours (Cool-off)">24 Hours (Cool-off)</option>
            <option value="7 Days">7 Days</option>
            <option value="30 Days">30 Days</option>
            <option value="6 Months">6 Months</option>
          </select>

          <button
            onClick={handleSelfExclude}
            className="w-full py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider transition-all"
          >
            ACTIVATE SELF-EXCLUSION
          </button>
        </div>

        {/* Help & Support Helplines */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-lg">
          <h3 className="font-black text-sm text-slate-900 mb-2 flex items-center gap-2">
            <HelpCircle size={18} className="text-[#5BB8FF]" /> NEED PROFESSIONAL SUPPORT?
          </h3>
          <p className="text-xs text-[#8EA8B8] leading-relaxed mb-3">
            If gaming is affecting your personal or financial well-being, free confidential counseling is available:
          </p>
          <ul className="text-xs space-y-1.5 text-slate-600 font-semibold">
            <li>• Tele-MANAS (Govt of India): 14416 (24x7 Toll-Free)</li>
            <li>• NIMHANS Behavioral Addiction Clinic: (080) 2699 5000</li>
            <li>• WinDaq Player Protection Desk: support@daqwon.in</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

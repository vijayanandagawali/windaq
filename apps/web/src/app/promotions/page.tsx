'use client';
import React, { useEffect, useState } from 'react';
import { Gift, Zap, ShieldAlert, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/config';
import { useWalletStore } from '@/store/walletStore';

import { useAuthStore } from '@/store/authStore';

export default function PromotionsPage() {
  const { user, isAuthenticated, openAuthModal } = useAuthStore();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('/api/bonus/campaigns'))
      .then(res => res.json())
      .then(data => {
        if (data.success) setCampaigns(data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const activateCampaign = async (id: string) => {
    if (!isAuthenticated || !user) {
      openAuthModal('LOGIN');
      alert('Please log in to claim promotions.');
      return;
    }

    try {
      const res = await fetch(getApiUrl('/api/bonus/activate'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
        },
        body: JSON.stringify({ campaignId: id })
      });
      const data = await res.json();
      if (data.success) {
        alert('Bonus claimed successfully! Check your Profile > Bonuses.');
      } else {
        alert(data.message || 'Failed to claim bonus.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Gift className="w-8 h-8 text-pink-500" />
            Promotions & Bonuses
          </h1>
          <p className="text-sm text-slate-500 mt-2">Claim rewards and boost your bankroll. Transparent terms, no hidden tricks.</p>
        </div>
        <Link href="/profile/bonuses" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-bold flex items-center gap-2">
          My Active Bonuses <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="text-slate-500 font-mono">Loading campaigns...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map(camp => (
            <div key={camp.id} className="bg-white/90 border border-slate-200 rounded-2xl overflow-hidden group">
              <div className="h-32 bg-gradient-to-br from-pink-600/20 to-purple-900/20 border-b border-slate-200 p-6 flex flex-col justify-end relative overflow-hidden">
                <Gift className="absolute -right-4 -bottom-4 w-24 h-24 text-pink-500/10 group-hover:scale-110 transition-transform" />
                <span className="bg-pink-500/20 text-pink-600 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded w-max mb-2">
                  {camp.type.replace('_', ' ')}
                </span>
                <h3 className="text-xl font-bold text-slate-900 relative z-10">{camp.name}</h3>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Max Bonus:</span>
                  <span className="font-bold text-emerald-600">₹{(camp.config.maxBonus / 100).toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Wagering Req:</span>
                  <span className="font-bold text-orange-600">{camp.config.wageringReqMultiplier}x</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Expires In:</span>
                  <span className="font-bold text-slate-900">{camp.config.expiryDays} Days</span>
                </div>

                <div className="bg-white p-3 rounded-lg flex gap-2 items-start text-xs text-slate-500">
                  <ShieldAlert className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <p>Restricted Games: {camp.config.restrictedGames?.join(', ') || 'None'}. Withdrawing real cash forfeits active bonuses.</p>
                </div>

                <button 
                  onClick={() => activateCampaign(camp.id)}
                  className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold tracking-wide flex items-center justify-center gap-2 transition"
                >
                  <Zap className="w-4 h-4" /> Claim Bonus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

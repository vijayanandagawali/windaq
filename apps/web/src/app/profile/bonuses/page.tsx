'use client';
import React, { useEffect, useState } from 'react';
import { Target, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/config';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';

export default function MyBonusesPage() {
  const { user } = useAuthStore();
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(getApiUrl('/api/bonus/active'), {
      headers: { 
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setBonuses(data.data);
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <ProtectedRoute title="MY BONUSES">
      <div className="max-w-4xl mx-auto space-y-8 py-8 px-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-pink-500" />
            My Active Bonuses
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track your wagering progress before conversion to real cash.</p>
        </div>
        <Link href="/promotions" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-bold flex items-center gap-2">
          Find More <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="text-slate-500 font-mono">Loading bonuses...</div>
      ) : bonuses.length === 0 ? (
        <div className="bg-white/90 border border-slate-200 rounded-xl p-12 text-center">
          <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">No Active Bonuses</h2>
          <p className="text-slate-500 mb-6">You don't have any active bonuses to wager. Check out our promotions page to claim one!</p>
          <Link href="/promotions" className="inline-block px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl transition">
            View Promotions
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {bonuses.map(b => {
            const progress = Math.min(100, Number(b.wageredAmount) * 100 / Number(b.wageringRequirement));
            const daysLeft = Math.max(0, Math.ceil((new Date(b.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

            return (
              <div key={b.id} className="bg-white/90 border border-pink-900/30 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-bl-full pointer-events-none" />
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">{b.campaign?.name || 'Bonus'}</h2>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-pink-600 font-bold">₹{(Number(b.currentAmount) / 100).toLocaleString()} Available</span>
                      <span className="text-slate-500">|</span>
                      <span className="flex items-center gap-1 text-orange-600">
                        <Clock className="w-3 h-3" /> Expires in {daysLeft} days
                      </span>
                    </div>
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
                    ACTIVE
                  </span>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Wagering Progress</span>
                    <span className="font-mono text-slate-900">
                      ₹{(Number(b.wageredAmount) / 100).toLocaleString()} / ₹{(Number(b.wageringRequirement) / 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 bg-white rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className="h-full bg-gradient-to-r from-pink-600 to-purple-500 rounded-full transition-all duration-1000"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-right text-xs text-pink-600 font-bold">{progress.toFixed(1)}% Completed</div>
                </div>

                <div className="bg-white/90 border border-slate-200 p-3 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>Bonus funds will be automatically converted to real cash once wagering is 100% complete.</p>
                    <p className="text-red-600">Initiating a real-money withdrawal before completion will instantly forfeit this bonus.</p>
                    <p>Restricted on: {b.campaign?.config?.restrictedGames?.join(', ') || 'None'}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}

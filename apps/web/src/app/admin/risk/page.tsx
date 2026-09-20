'use client';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Shield, AlertOctagon, UserX, CheckCircle } from 'lucide-react';

export default function RiskQueuePage() {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  const fetchFlags = () => {
    setLoading(true);
    fetch('http://localhost:4000/api/admin/risk/flags', {
      headers: { 'x-admin-user-id': 'mock-super-admin-id' }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setFlags(data.data);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const handleResolve = async (id: string, status: string, suspendUser: boolean) => {
    try {
      const res = await fetch(`http://localhost:4000/api/admin/risk/flags/${id}/resolve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-user-id': 'mock-super-admin-id'
        },
        body: JSON.stringify({ status, suspendUser, notes })
      });
      const data = await res.json();
      
      if (data.success) {
        setNotes('');
        fetchFlags();
      } else {
        alert(data.message || 'Failed to resolve');
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
            <AlertOctagon className="w-6 h-6 text-red-500" />
            Risk & Fraud Investigation Queue
          </h1>
          <p className="text-sm text-slate-400 mt-1">Review algorithmic flags for velocity, replay attacks, and impossible states.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {flags.map((flag) => (
          <div key={flag.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
            {/* Severity Indicator */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
              flag.severity === 'CRITICAL' ? 'bg-red-500' :
              flag.severity === 'HIGH' ? 'bg-orange-500' :
              flag.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'
            }`} />
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pl-4">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded uppercase tracking-wider ${
                     flag.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                     flag.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                     flag.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {flag.severity}
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-tight">{flag.reasonCode}</h3>
                  <span className="text-xs text-slate-500">{new Date(flag.createdAt).toLocaleString()}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 block text-xs uppercase">User</span>
                    <span className="font-mono text-slate-300">{flag.user?.phone || flag.userId}</span>
                    {flag.user?.riskProfile?.isSuspended && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                        <UserX className="w-3 h-3" /> Suspended
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs uppercase">Risk Score</span>
                    <span className="font-bold text-slate-300">{flag.user?.riskProfile?.riskScore || 0} / 100</span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded p-3 text-xs font-mono text-slate-400 overflow-x-auto">
                  {JSON.stringify(flag.evidence, null, 2)}
                </div>
              </div>

              <div className="w-full md:w-72 bg-slate-800/30 p-4 rounded-lg border border-slate-700/50 flex flex-col gap-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase">Investigation Decision</h4>
                
                <textarea 
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 resize-none h-20"
                  placeholder="Investigation notes / suspension reason..."
                  onChange={(e) => setNotes(e.target.value)}
                />
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleResolve(flag.id, 'RESOLVED', true)}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded py-2 text-xs font-medium transition"
                  >
                    <UserX className="w-4 h-4" />
                    Suspend User
                  </button>
                  <button 
                    onClick={() => handleResolve(flag.id, 'FALSE_POSITIVE', false)}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded py-2 text-xs font-medium transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    False Positive
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {flags.length === 0 && !loading && (
          <div className="text-center py-12 bg-slate-900/30 border border-slate-800 rounded-xl border-dashed">
            <Shield className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-300">Queue is Clear</h3>
            <p className="text-sm text-slate-500">No anomalous behavior detected.</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';
import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Search, FileText } from 'lucide-react';
import { getApiUrl } from '@/lib/config';

export default function KYCReviewPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('windaq_auth_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchProfiles = () => {
    setLoading(true);
    fetch(getApiUrl('/api/compliance/admin/kyc'), {
      headers: getHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setProfiles(data.data);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleReview = async (id: string, status: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/compliance/admin/kyc/${id}/review`), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      
      if (data.success) {
        fetchProfiles();
      } else {
        alert(data.message || 'Failed to review');
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
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            KYC & Compliance Verification
          </h1>
          <p className="text-sm text-slate-400 mt-1">Review encrypted user identity documents and jurisdiction eligibility.</p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Jurisdiction</th>
                <th className="px-6 py-4">DOB</th>
                <th className="px-6 py-4">Decrypted Evidence</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-mono text-sm text-white">
                    {profile.user?.phone || profile.userId.substring(0,8)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs font-mono border border-slate-700">
                      {profile.jurisdiction}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {new Date(profile.dob).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-emerald-400/80">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      <span className="truncate max-w-[200px]">{profile.decryptedDoc || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => handleReview(profile.id, 'APPROVED')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded transition"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button 
                      onClick={() => handleReview(profile.id, 'REJECTED')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded transition"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No pending KYC profiles.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

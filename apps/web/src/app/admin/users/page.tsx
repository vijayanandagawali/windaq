'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Users, Search, RefreshCw } from 'lucide-react';
import { getApiUrl } from '@/lib/config';

interface AdminUser {
  id: string;
  phone: string;
  role: string;
  createdAt: string;
  balance: number;
  locked: number;
  deposited: number;
  withdrawn: number;
  won: number;
  lost: number;
}

const PAGE = 50;
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const roleStyle = (role: string) =>
  role === 'USER' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (search) params.set('q', search);
      const res = await fetch(getApiUrl(`/api/admin/users?${params}`), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Users could not be loaded.');
      setUsers(data.data);
      setTotal(data.total ?? data.data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Users could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [offset, search]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setSearch(query.replace(/\D/g, ''));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Users className="h-6 w-6 text-emerald-600" /> Users
          </h1>
          <p className="mt-1 text-sm text-slate-500">{total} {total === 1 ? 'account' : 'accounts'}{search ? ` matching “${search}”` : ''}. Balances are live wallet values.</p>
        </div>
        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} inputMode="numeric" placeholder="Search phone digits"
              className="w-48 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </div>
          <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Search</button>
          <button type="button" onClick={load} aria-label="Refresh" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-800">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </form>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-right">Locked</th>
              <th className="px-4 py-3 text-right">Deposited</th>
              <th className="px-4 py-3 text-right">Withdrawn</th>
              <th className="px-4 py-3 text-right">Won / Lost</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{u.phone}</div>
                  <div className="font-mono text-[10px] text-slate-400">{u.id.slice(0, 8)}</div>
                </td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${roleStyle(u.role)}`}>{u.role}</span></td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{inr(u.balance)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${u.locked > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{inr(u.locked)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{inr(u.deposited)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{inr(u.withdrawn)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{inr(u.won)} / {inr(u.lost)}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
            {!loading && users.length === 0 && !error && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

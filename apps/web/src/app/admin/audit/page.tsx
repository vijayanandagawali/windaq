'use client';
import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getApiUrl } from '@/lib/config';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const headers: Record<string, string> = {};

    fetch(getApiUrl('/api/admin/audit'), { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setLogs(data.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = logs.filter(l => 
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (l.admin?.phone || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Audit Logs</h1>
          <p className="text-sm text-slate-500">Immutable trail of all privileged operations.</p>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search action or admin..." 
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white/90 border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Admin</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Target Resource</th>
                <th className="px-6 py-4">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-200 hover:bg-slate-100">
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {log.admin?.phone || log.adminId.substring(0,8)}
                    <span className="ml-2 text-[10px] uppercase text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">{log.admin?.role || 'UNKNOWN'}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-emerald-600">{log.action}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{log.resourceId || 'N/A'}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{log.ipAddress || 'UNKNOWN'}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No logs found matching criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

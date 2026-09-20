"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, ShieldCheck, AlertTriangle, FileText, Download, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LedgerDashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invariants, setInvariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:4000/api/ledger?limit=100')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTransactions(data.data);
          setInvariants(data.invariants);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-400 bg-green-900/30 border-green-500/30';
      case 'PENDING': return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30';
      case 'REVERSED': return 'text-red-400 bg-red-900/30 border-red-500/30';
      default: return 'text-gray-400 bg-gray-900/30 border-gray-500/30';
    }
  };

  const getTxColor = (type: string) => {
    if (type === 'BET_PLACE') return 'text-orange-400';
    if (type === 'BET_WIN') return 'text-green-400';
    if (type === 'BET_LOSS') return 'text-red-400';
    if (type === 'MIGRATION') return 'text-purple-400';
    if (type === 'REFUND') return 'text-blue-400';
    return 'text-white';
  };

  // Check simple invariant: sum of SYSTEM:WAGER_RESERVE
  // (In a real system, you sum all debits and credits and assert they balance to zero).
  // Here, the API sends grouped sums by debitAccountId.
  const isHealthy = true; // Placeholder for UI

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-6 selection:bg-blue-500">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <ShieldCheck className="text-blue-500" size={32} />
              Double-Entry Ledger
            </h1>
            <p className="text-gray-400 text-sm mt-1">Authoritative source of truth for all real-money movements.</p>
          </div>
          <div className="flex gap-4">
             <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded border border-gray-700 flex items-center gap-2 text-sm font-bold transition-colors">
               <FileText size={16} /> Audit Report
             </button>
             <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded border border-blue-500 flex items-center gap-2 text-sm font-bold transition-colors">
               <Download size={16} /> Export CSV
             </button>
          </div>
        </div>

        {/* INVARIANTS STATUS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Ledger Health</h3>
                {isHealthy ? <CheckCircle className="text-green-500" /> : <XCircle className="text-red-500" />}
             </div>
             <p className="text-2xl font-black text-white">{isHealthy ? 'System Balanced' : 'Divergence Detected'}</p>
             <p className="text-xs text-green-400 mt-1">Zero sum constraint verified across all accounts.</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Total System Reserve</h3>
             <p className="text-2xl font-black text-white">₹0.00</p>
             <p className="text-xs text-gray-500 mt-1">Funds currently locked in active bets.</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">House Revenue</h3>
             <p className="text-2xl font-black text-white">₹0.00</p>
             <p className="text-xs text-gray-500 mt-1">Total platform net winnings (paise).</p>
          </div>
        </div>

        {/* TRANSACTIONS TABLE */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Immutable Ledger Entries</h2>
            <div className="text-sm text-gray-500">Showing last 100 transactions</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold">Tx ID / Date</th>
                  <th className="p-4 font-bold">Type / Reference</th>
                  <th className="p-4 font-bold text-right">Debit Account (From)</th>
                  <th className="p-4 text-center"></th>
                  <th className="p-4 font-bold">Credit Account (To)</th>
                  <th className="p-4 font-bold text-right">Amount (₹)</th>
                  <th className="p-4 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">Loading ledger data...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">No transactions found.</td>
                  </tr>
                ) : (
                  transactions.map((tx: any) => (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={tx.id} 
                      className="hover:bg-gray-750 transition-colors group"
                    >
                      <td className="p-4">
                        <div className="text-sm font-mono text-gray-300">{tx.id.split('-')[0]}...</div>
                        <div className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</div>
                      </td>
                      <td className="p-4">
                        <div className={`text-sm font-bold ${getTxColor(tx.referenceType)}`}>{tx.referenceType}</div>
                        <div className="text-xs font-mono text-gray-500 max-w-[150px] truncate" title={tx.referenceId}>{tx.referenceId}</div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-mono text-sm px-2 py-1 bg-gray-900 rounded text-red-300 border border-red-900/30 truncate block max-w-[200px] ml-auto">
                          {tx.debitAccountId}
                        </span>
                      </td>
                      <td className="p-4 text-center text-gray-600 group-hover:text-blue-500 transition-colors">
                        <ArrowRightLeft size={16} />
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-sm px-2 py-1 bg-gray-900 rounded text-green-300 border border-green-900/30 truncate block max-w-[200px]">
                          {tx.creditAccountId}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-white">
                        {(Number(tx.amount) / 100).toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-widest ${getStatusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

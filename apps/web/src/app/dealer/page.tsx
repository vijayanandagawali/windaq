"use client";

import React, { useState, useEffect } from 'react';
import { io, Socket } from '@/lib/gameSocket';
import toast from 'react-hot-toast';
import { Lock, Unlock, PlayCircle, CheckCircle, StopCircle, RefreshCw, AlertTriangle } from 'lucide-react';

export default function DealerConsole() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [pin, setPin] = useState('');
  const [dealer, setDealer] = useState<any>(null);
  
  const [tableId] = useState('live-roulette-1');
  const [roundState, setRoundState] = useState<any>(null); // from live:state
  const [resultInput, setResultInput] = useState('');
  const [recentBets, setRecentBets] = useState<any[]>([]);

  useEffect(() => {
    const s = io('http://localhost:4000', { auth: { token: null } });
    setSocket(s);
    
    s.on('live:state', (data: any) => {
      setRoundState(data);
      if (data.status === 'SETTLED' || data.status === 'BETTING_OPEN') {
        setResultInput('');
        if (data.status === 'BETTING_OPEN') setRecentBets([]);
      }
    });

    s.on('live:live_bet', (data: any) => {
      setRecentBets(prev => [data, ...prev].slice(0, 10));
    });

    return () => { s.disconnect(); };
  }, []);

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    socket.emit('dealer:login', { pinCode: pin }, (res: any) => {
      if (res.success) {
        setDealer(res.dealer);
        toast.success(`Welcome back, ${res.dealer.name}`);
        // Join room to receive state updates
        socket.emit('live:join', { tableId }, (rRes: any) => {
           if (rRes.success && rRes.state) {
             setRoundState({ status: rRes.state.status, roundId: rRes.state.id, result: rRes.state.result });
           }
        });
      } else {
        toast.error(res.message || "Invalid PIN");
      }
    });
  };

  const executeAction = (action: string, payload: any = {}) => {
    if (!socket) return;
    socket.emit(action, { tableId, dealerId: dealer.id, ...payload }, (res: any) => {
      if (res.success) toast.success("Action successful");
      else toast.error(res.message || "Action failed");
    });
  };

  if (!dealer) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 font-mono text-white selection:bg-blue-500">
        <form onSubmit={login} className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <Lock className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2 tracking-widest text-blue-400">STUDIO LOGIN</h1>
          <p className="text-gray-400 text-center text-sm mb-6">Authorized Personnel Only</p>
          
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-blue-500 mb-6"
            placeholder="PIN"
            autoFocus
          />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded transition-colors uppercase tracking-widest">
            Authenticate
          </button>
        </form>
      </div>
    );
  }

  const statusColors: any = {
    'WAITING': 'text-gray-400',
    'BETTING_OPEN': 'text-green-400',
    'BETTING_CLOSED': 'text-yellow-400',
    'RESULT_PENDING': 'text-orange-400',
    'SETTLED': 'text-blue-400'
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 font-mono flex flex-col selection:bg-blue-500">
      
      {/* HEADER */}
      <header className="bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center shadow-lg z-10">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-2">
            <Unlock size={16}/> {dealer.name}
          </div>
          <div className="text-gray-400 text-sm">Table: <span className="text-white font-bold uppercase">{tableId}</span></div>
        </div>
        <div className="flex items-center gap-4">
           <div className={`font-bold text-lg ${statusColors[roundState?.status || 'WAITING']}`}>
             ● {roundState?.status?.replace('_', ' ') || 'NO ACTIVE ROUND'}
           </div>
           <button onClick={() => window.location.reload()} className="p-2 hover:bg-gray-800 rounded">
             <RefreshCw size={18} className="text-gray-400" />
           </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: CONTROLS */}
        <div className="w-1/2 p-6 flex flex-col gap-6 border-r border-gray-800 overflow-y-auto">
          
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => executeAction('dealer:open_betting')}
              disabled={roundState?.status === 'BETTING_OPEN' || roundState?.status === 'BETTING_CLOSED' || roundState?.status === 'RESULT_PENDING'}
              className="bg-green-900/40 hover:bg-green-800 disabled:opacity-30 disabled:cursor-not-allowed border border-green-500/50 rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <PlayCircle className="w-10 h-10 text-green-400" />
              <span className="font-bold tracking-widest text-green-200 uppercase">New Round<br/>(Open Bets)</span>
            </button>

            <button 
              onClick={() => executeAction('dealer:close_betting')}
              disabled={roundState?.status !== 'BETTING_OPEN'}
              className="bg-red-900/40 hover:bg-red-800 disabled:opacity-30 disabled:cursor-not-allowed border border-red-500/50 rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <StopCircle className="w-10 h-10 text-red-400" />
              <span className="font-bold tracking-widest text-red-200 uppercase">No More<br/>Bets</span>
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-4">
            <h2 className="text-lg font-bold mb-4 text-gray-400 uppercase tracking-widest">Result Input</h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Winning Number</label>
                <input
                  type="number"
                  min="0"
                  max="36"
                  value={resultInput}
                  onChange={(e) => setResultInput(e.target.value)}
                  disabled={roundState?.status !== 'BETTING_CLOSED'}
                  className="w-full bg-black border border-gray-700 rounded p-4 text-3xl text-center focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  placeholder="-"
                />
              </div>
              <button 
                onClick={() => executeAction('dealer:submit_result', { result: { number: parseInt(resultInput) } })}
                disabled={roundState?.status !== 'BETTING_CLOSED' || resultInput === ''}
                className="bg-orange-600 hover:bg-orange-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded h-[74px] uppercase tracking-widest transition-colors"
              >
                Submit
              </button>
            </div>
          </div>

          <button 
            onClick={() => executeAction('dealer:settle_round')}
            disabled={roundState?.status !== 'RESULT_PENDING'}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-6 rounded-xl flex items-center justify-center gap-3 uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(37,99,235,0.2)]"
          >
            <CheckCircle className="w-6 h-6" />
            Confirm & Settle Payouts
          </button>

          <div className="mt-auto pt-8">
            <button className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 py-3 rounded border border-gray-700 flex items-center justify-center gap-2 text-sm uppercase tracking-widest">
              <AlertTriangle className="w-4 h-4 text-yellow-500" /> Flag Incident to Supervisor
            </button>
          </div>

        </div>

        {/* RIGHT PANEL: LIVE AUDIT */}
        <div className="w-1/2 bg-gray-900 p-6 flex flex-col">
          <h2 className="text-lg font-bold mb-4 text-gray-400 uppercase tracking-widest border-b border-gray-800 pb-2">Live Bet Stream</h2>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {recentBets.length === 0 ? (
              <div className="text-center text-gray-600 mt-10 text-sm">No bets placed yet in this round.</div>
            ) : (
              recentBets.map((b, i) => (
                <div key={i} className="bg-black/50 border border-gray-800 p-3 rounded flex justify-between items-center text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{b.userId}</span>
                    <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300 font-bold">{b.market}</span>
                  </div>
                  <div className="font-bold text-green-400">₹{Number(b.amount).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
          
          {roundState && (
            <div className="mt-4 bg-black border border-gray-800 p-4 rounded text-xs text-gray-500 font-mono">
              <div className="mb-1 text-gray-400 font-bold uppercase tracking-widest border-b border-gray-800 pb-1">Round Audit State</div>
              <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(roundState, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

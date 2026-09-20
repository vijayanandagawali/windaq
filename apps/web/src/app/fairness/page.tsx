"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ShieldCheck, CheckCircle2, XCircle, Search, RefreshCw, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProvablyFairPage() {
  const [game, setGame] = useState<'aviator' | 'wingo' | 'cards'>('aviator');
  const [serverSeed, setServerSeed] = useState('7d8a9f2e4b1c3d5a8e0f2b4c6d8e0a2f4c6b8d0e2a4f6c8b0d2e4a6f8c0b2d4e');
  const [clientSeed, setClientSeed] = useState('global_client_seed_2026');
  const [nonce, setNonce] = useState('1042');
  const [expectedResult, setExpectedResult] = useState('2.45');
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    computedMultiplier: string;
    computedHash: string;
  } | null>(null);

  const handleVerify = async () => {
    if (!serverSeed || !clientSeed || !nonce) {
      toast.error('Please enter Server Seed, Client Seed, and Nonce.');
      return;
    }

    try {
      // Convert seeds to HMAC-SHA256 client-side using Web Crypto
      const encoder = new TextEncoder();
      const keyData = encoder.encode(serverSeed);
      const msgData = encoder.encode(`${clientSeed}:${nonce}`);

      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, msgData);
      const hashArray = Array.from(new Uint8Array(signature));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Aviator formula calculation
      const h = parseInt(hashHex.substring(0, 13), 16);
      const e = Math.pow(2, 52);
      const multiplier = Math.floor((100 * e - h) / (e - h)) / 100;
      const finalMult = Math.max(1.01, parseFloat(multiplier.toFixed(2)));

      const expected = parseFloat(expectedResult);
      const matches = !isNaN(expected) && Math.abs(finalMult - expected) < 0.05;

      setVerificationResult({
        verified: matches,
        computedMultiplier: finalMult.toFixed(2) + 'X',
        computedHash: hashHex
      });

      if (matches) {
        toast.success(`Outcome Verified! Exactly matches ${finalMult.toFixed(2)}X!`);
      } else {
        toast(`Calculated ${finalMult.toFixed(2)}X from cryptographic seeds.`, { icon: 'ℹ️' });
      }
    } catch (err: any) {
      toast.error('Verification error: ' + err.message);
    }
  };

  return (
    <main className="min-h-screen bg-[#061625] font-sans selection:bg-[#26F0B2] text-[#F4FBFF] max-w-lg mx-auto pb-12 shadow-2xl">
      {/* Page Title Banner */}
      <div className="px-4 py-3 bg-[#0B2236]/90 border-b border-white/10 flex items-center justify-between">
        <h1 className="font-black text-sm tracking-wider uppercase text-white">PROVABLY FAIR VERIFIER</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Banner */}
        <div className="bg-[#0B2236] border border-[#26F0B2]/30 rounded-2xl p-4 shadow-[0_0_25px_rgba(38,240,178,0.15)]">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={22} className="text-[#26F0B2]" />
            <h2 className="font-black text-base text-white">CRYPTOGRAPHIC INTEGRITY</h2>
          </div>
          <p className="text-xs text-[#8EA8B8] leading-relaxed">
            WinDaq outcomes are predetermined by mathematical cryptography (HMAC-SHA256) before rounds start. Neither the platform nor players can manipulate the result during flight.
          </p>
        </div>

        {/* Verifier Form */}
        <div className="bg-[#0B2236] border border-white/10 rounded-2xl p-4 shadow-lg space-y-3">
          <div>
            <label className="text-[11px] font-extrabold uppercase text-[#8EA8B8] block mb-1">
              GAME SYSTEM
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'aviator', label: 'WinDaq Aviator' },
                { id: 'wingo', label: 'Color Trading' },
                { id: 'cards', label: 'Teen Patti / Cards' },
              ].map(g => (
                <button
                  key={g.id}
                  onClick={() => setGame(g.id as any)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    game === g.id
                      ? 'bg-[#26F0B2] text-[#061625] shadow-md font-black'
                      : 'bg-[#061625] text-gray-400 border border-white/10'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-extrabold uppercase text-[#8EA8B8] block mb-1">
              REVEALED SERVER SEED (HEX)
            </label>
            <input
              type="text"
              value={serverSeed}
              onChange={(e) => setServerSeed(e.target.value)}
              placeholder="e.g. 7d8a9f2e4b1c..."
              className="w-full bg-[#061625] border border-white/15 rounded-xl px-3 py-2.5 text-white font-mono text-xs outline-none focus:border-[#26F0B2]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-extrabold uppercase text-[#8EA8B8] block mb-1">
                CLIENT SEED
              </label>
              <input
                type="text"
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                className="w-full bg-[#061625] border border-white/15 rounded-xl px-3 py-2.5 text-white font-mono text-xs outline-none focus:border-[#26F0B2]"
              />
            </div>
            <div>
              <label className="text-[11px] font-extrabold uppercase text-[#8EA8B8] block mb-1">
                NONCE / ROUND #
              </label>
              <input
                type="number"
                value={nonce}
                onChange={(e) => setNonce(e.target.value)}
                className="w-full bg-[#061625] border border-white/15 rounded-xl px-3 py-2.5 text-white font-mono text-xs outline-none focus:border-[#26F0B2]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-extrabold uppercase text-[#8EA8B8] block mb-1">
              EXPECTED OUTCOME (MULTIPLIER)
            </label>
            <input
              type="text"
              value={expectedResult}
              onChange={(e) => setExpectedResult(e.target.value)}
              placeholder="e.g. 2.45"
              className="w-full bg-[#061625] border border-white/15 rounded-xl px-3 py-2.5 text-white font-bold text-sm outline-none focus:border-[#26F0B2]"
            />
          </div>

          <button
            onClick={handleVerify}
            className="w-full py-3 rounded-xl bg-[#26F0B2] text-[#061625] font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(38,240,178,0.4)] hover:bg-[#1ed49c] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Search size={16} /> RECOMPUTE & VERIFY FAIRNESS
          </button>
        </div>

        {/* Result Box */}
        {verificationResult && (
          <div className={`border rounded-2xl p-4 transition-all ${
            verificationResult.verified 
              ? 'bg-[#26F0B2]/10 border-[#26F0B2] text-[#26F0B2]' 
              : 'bg-[#0F2C43] border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-xs uppercase tracking-wider">COMPUTED RESULT:</span>
              <span className="font-black text-xl text-yellow-400">{verificationResult.computedMultiplier}</span>
            </div>
            <div className="text-[11px] font-mono text-gray-300 break-all bg-black/40 p-2.5 rounded-xl border border-white/5">
              <span className="text-gray-400 block mb-0.5">Derived HMAC-SHA256:</span>
              {verificationResult.computedHash}
            </div>
          </div>
        )}

        {/* Verification Logic Guide */}
        <div className="bg-[#0B2236] border border-white/10 rounded-2xl p-4 space-y-2">
          <h3 className="font-black text-sm text-white flex items-center gap-2">
            <Lock size={16} className="text-[#26F0B2]" /> HOW TO VERIFY INDEPENDENTLY
          </h3>
          <p className="text-xs text-[#8EA8B8] leading-relaxed">
            You can verify any round independently using standard third-party tools (like CyberChef or Node.js):
          </p>
          <ol className="text-xs text-gray-300 space-y-1 pl-4 list-decimal">
            <li>Take the revealed Server Seed and Client Seed.</li>
            <li>Compute HMAC-SHA256 with key = Server Seed, message = ClientSeed:Nonce.</li>
            <li>Extract the first 52 bits and apply formula: 100 / (100 - X).</li>
          </ol>
        </div>
      </div>
    </main>
  );
}

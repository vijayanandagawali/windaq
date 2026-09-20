"use client";

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ShieldCheck, FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#061625] font-sans selection:bg-[#26F0B2] text-[#F4FBFF] max-w-lg mx-auto pb-12 shadow-2xl">
      {/* Page Title Banner */}
      <div className="px-4 py-3 bg-[#0B2236]/90 border-b border-white/10 flex items-center justify-between">
        <h1 className="font-black text-sm tracking-wider uppercase text-white">TERMS & CONDITIONS</h1>
      </div>

      <div className="p-4 space-y-4 text-xs leading-relaxed text-[#8EA8B8]">
        <div className="bg-[#0B2236] border border-white/10 rounded-2xl p-4 space-y-3">
          <h2 className="text-white font-black text-sm uppercase">1. ELIGIBILITY & AGE RESTRICTION</h2>
          <p>
            You must be at least 18 years of age and a resident of an Indian jurisdiction where real-money skill gaming is permissible by law. Access is strictly prohibited from Assam, Telangana, Andhra Pradesh, Nagaland, and Odisha.
          </p>

          <h2 className="text-white font-black text-sm uppercase">2. REAL-MONEY BANKING & UTR VERIFICATION</h2>
          <p>
            All deposits must originate from accounts legally held in the player&apos;s name. Deposits via dynamic UPI require valid 12-digit UTR verification. Duplicate submission of previously used or fraudulent UTR numbers will lead to immediate forfeiture of balances and permanent device suspension.
          </p>

          <h2 className="text-white font-black text-sm uppercase">3. WITHDRAWAL & ANTI-WASHING POLICY</h2>
          <p>
            To prevent money laundering, deposits must be utilized for gameplay before withdrawal. Only amounts in the Winning Wallet balance may be requested for withdrawal. Withdrawals are processed to the verified UPI ID or Bank Account matching the player&apos;s verified KYC profile.
          </p>

          <h2 className="text-white font-black text-sm uppercase">4. PROVABLY FAIR OUTCOMES</h2>
          <p>
            WinDaq employs cryptographic SHA-256 HMAC algorithms for non-live game rounds. Once a round concludes, the server seed is revealed publicly to enable unalterable player verification.
          </p>

          <h2 className="text-white font-black text-sm uppercase">5. RESPONSIBLE GAMING & LIMITS</h2>
          <p>
            Players may establish voluntary daily deposit limits, loss thresholds, or initiate cooling-off/self-exclusion periods at any time via the Responsible Gaming portal.
          </p>
        </div>
      </div>
    </main>
  );
}

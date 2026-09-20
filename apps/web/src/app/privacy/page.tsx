"use client";

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Lock } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#061625] font-sans selection:bg-[#26F0B2] text-[#F4FBFF] max-w-lg mx-auto pb-12 shadow-2xl">
      {/* Page Title Banner */}
      <div className="px-4 py-3 bg-[#0B2236]/90 border-b border-white/10 flex items-center justify-between">
        <h1 className="font-black text-sm tracking-wider uppercase text-white">PRIVACY POLICY</h1>
      </div>

      <div className="p-4 space-y-4 text-xs leading-relaxed text-[#8EA8B8]">
        <div className="bg-[#0B2236] border border-white/10 rounded-2xl p-4 space-y-3">
          <h2 className="text-white font-black text-sm uppercase">1. INFORMATION WE COLLECT</h2>
          <p>
            WinDaq collects only necessary information for account creation and financial regulatory compliance, including: 10-digit mobile number, masked payment identifiers (UPI ID / Bank Account details), device fingerprint, and IP address for fraud detection.
          </p>

          <h2 className="text-white font-black text-sm uppercase">2. ENCRYPTION & DATA PROTECTION</h2>
          <p>
            All network communication is strictly transmitted across TLS 1.3 encrypted connections. High-risk sensitive fields, including KYC identification documents and authentication tokens, are encrypted at rest with AES-256 primitives.
          </p>

          <h2 className="text-white font-black text-sm uppercase">3. THIRD-PARTY DISCLOSURE</h2>
          <p>
            We do not sell, trade, or monetize player personal details to marketing brokers. Data is shared solely with certified telecom partners (Fast2SMS) for transactional OTP dispatch and verified banking networks for fund settlement.
          </p>

          <h2 className="text-white font-black text-sm uppercase">4. CONTACT & DATA DELETION</h2>
          <p>
            Players may request full account closure and audit data anonymization by contacting privacy@daqwon.in.
          </p>
        </div>
      </div>
    </main>
  );
}

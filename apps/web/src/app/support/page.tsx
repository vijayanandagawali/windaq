"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, MessageCircle, Send, HelpCircle, ShieldCheck, Mail, PhoneCall } from 'lucide-react';
import toast from 'react-hot-toast';

const FAQS = [
  {
    q: 'How long does UPI Deposit take to reflect?',
    a: 'Deposits via dynamic UPI are credited within 30 to 90 seconds after entering the correct 12-digit UTR from your PhonePe, Google Pay, or Paytm payment receipt.'
  },
  {
    q: 'What is the minimum deposit and withdrawal?',
    a: 'Minimum deposit is ₹100. Minimum withdrawal is ₹200. Withdrawals are processed 24/7 directly to your registered UPI ID or Bank Account.'
  },
  {
    q: 'How do I know games are fair?',
    a: 'WinDaq uses Provably Fair HMAC-SHA256 cryptography. The server seed hash is committed before rounds start. You can verify every round using our Fairness Verifier tool.'
  },
  {
    q: 'Why was my withdrawal rejected?',
    a: 'Common reasons include incorrect UPI ID, insufficient winning balance, or pending KYC verification. Contact our 24/7 support desk if you need assistance.'
  }
];

export default function SupportPage() {
  const [topic, setTopic] = useState('deposit');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter your query details.');
      return;
    }
    setSubmitted(true);
    toast.success('Support ticket submitted! Our VIP desk will reply within 15 minutes.');
  };

  return (
    <main className="min-h-screen bg-[#061625] font-sans selection:bg-[#26F0B2] text-[#F4FBFF] max-w-lg mx-auto pb-12 shadow-2xl">
      <header className="sticky top-0 bg-[#0B2236]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between z-30">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <h1 className="font-black text-sm tracking-wider uppercase text-white">24/7 HELP & SUPPORT</h1>
        <span className="w-8" />
      </header>

      <div className="p-4 space-y-4">
        {/* Quick Contact Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href="https://t.me/windaq_support"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#0B2236] border border-[#5BB8FF]/30 p-3 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 hover:border-[#5BB8FF] transition-all shadow-md group"
          >
            <Send size={24} className="text-[#5BB8FF] group-hover:scale-110 transition-transform" />
            <span className="font-black text-xs text-white">TELEGRAM VIP</span>
            <span className="text-[10px] text-[#8EA8B8]">Instant 1-on-1 Help</span>
          </a>

          <a
            href="https://wa.me/919876543210?text=Hi%20WinDaq%20Support"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#0B2236] border border-[#26F0B2]/30 p-3 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 hover:border-[#26F0B2] transition-all shadow-md group"
          >
            <MessageCircle size={24} className="text-[#26F0B2] group-hover:scale-110 transition-transform" />
            <span className="font-black text-xs text-white">WHATSAPP DESK</span>
            <span className="text-[10px] text-[#8EA8B8]">24/7 Live Agent</span>
          </a>
        </div>

        {/* Support Ticket Form */}
        <div className="bg-[#0B2236] border border-white/10 rounded-2xl p-4 shadow-lg">
          <h2 className="font-black text-sm text-white mb-1 uppercase tracking-wide">OPEN A SUPPORT TICKET</h2>
          <p className="text-xs text-[#8EA8B8] mb-3">Our dedicated financial resolution team is online 24/7.</p>

          {submitted ? (
            <div className="bg-[#26F0B2]/10 border border-[#26F0B2] p-4 rounded-xl text-center">
              <span className="text-2xl mb-1 block">✅</span>
              <h3 className="font-black text-sm text-[#26F0B2]">TICKET #WDQ-84920 CREATED</h3>
              <p className="text-xs text-gray-300 mt-1">We are reviewing your query. A response will be sent via SMS / Notification.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitTicket} className="space-y-3">
              <div>
                <label className="text-[11px] font-extrabold uppercase text-[#8EA8B8] block mb-1">ISSUE CATEGORY</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-[#061625] border border-white/15 rounded-xl px-3 py-2.5 text-white font-bold text-sm outline-none focus:border-[#26F0B2]"
                >
                  <option value="deposit">Deposit & UTR Verification</option>
                  <option value="withdrawal">Withdrawal & Payout Status</option>
                  <option value="game">Game Result & Fairness Query</option>
                  <option value="kyc">KYC & Account Verification</option>
                  <option value="other">Other Inquiries</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase text-[#8EA8B8] block mb-1">QUERY DETAILS / UTR #</label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or provide 12-digit UTR number..."
                  className="w-full bg-[#061625] border border-white/15 rounded-xl p-3 text-white text-xs outline-none focus:border-[#26F0B2] resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#26F0B2] text-[#061625] font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(38,240,178,0.4)] hover:bg-[#1ed49c] active:scale-95 transition-all"
              >
                SUBMIT TICKET
              </button>
            </form>
          )}
        </div>

        {/* FAQs */}
        <div className="bg-[#0B2236] border border-white/10 rounded-2xl p-4 shadow-lg space-y-3">
          <h2 className="font-black text-sm text-white flex items-center gap-2 uppercase">
            <HelpCircle size={18} className="text-yellow-400" /> FREQUENTLY ASKED QUESTIONS
          </h2>

          <div className="space-y-2">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="bg-[#061625] border border-white/5 rounded-xl p-3">
                <h4 className="font-bold text-xs text-white mb-1">{faq.q}</h4>
                <p className="text-[11px] text-[#8EA8B8] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

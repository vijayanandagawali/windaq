"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, ShieldCheck, User, Lock, FileCheck, ArrowUpRight, 
  HelpCircle, LogOut, Smartphone, Copy, Check, Sparkles, UserPlus 
} from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const router = useRouter();
  const { balance, vipTier } = useWalletStore();
  const { user, isGuest, logout, openAuthModal } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const [kycStatus, setKycStatus] = useState<'UNVERIFIED' | 'PENDING' | 'VERIFIED'>(
    user?.kycStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING'
  );
  const [showKycForm, setShowKycForm] = useState(false);

  // KYC Form State
  const [fullName, setFullName] = useState('Player Name');
  const [panNumber, setPanNumber] = useState('ABCDE1234F');
  const [aadhaarLastFour, setAadhaarLastFour] = useState('4829');
  const [bankAccount, setBankAccount] = useState('918273645201');
  const [ifsc, setIfsc] = useState('HDFC0001234');
  const [submittingKyc, setSubmittingKyc] = useState(false);

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopied(true);
      toast.success('User ID copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleSwitchAccount = () => {
    logout();
    openAuthModal('LOGIN');
  };

  const handleSubmitKyc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!panNumber || panNumber.length !== 10) {
      toast.error('Please enter a valid 10-character PAN number');
      return;
    }
    if (!bankAccount || !ifsc) {
      toast.error('Bank account number and IFSC are required for payouts.');
      return;
    }

    setSubmittingKyc(true);
    setTimeout(() => {
      setSubmittingKyc(false);
      setKycStatus('PENDING');
      setShowKycForm(false);
      toast.success('KYC documents submitted! Verification under review.');
    }, 800);
  };

  return (
    <ProtectedRoute title="MY PROFILE & KYC">
      <main className="min-h-screen bg-[#061625] font-sans selection:bg-[#26F0B2] text-[#F4FBFF] max-w-lg mx-auto pb-24 shadow-2xl">
        {/* Page Title Banner */}
        <div className="px-4 py-3 bg-[#0B2236]/90 border-b border-white/10 flex items-center justify-between">
          <h1 className="font-black text-sm tracking-wider uppercase text-white">MY PROFILE & KYC</h1>
          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer"
            title="Log Out"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">LOGOUT</span>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* User Card */}
          <div className="bg-gradient-to-br from-[#0B2236] to-[#0F2C43] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-[#26F0B2] flex items-center justify-center text-[#061625] font-black text-xl shadow-[0_0_20px_rgba(38,240,178,0.4)]">
                {isGuest ? 'G' : (user?.phone ? user.phone.slice(-2) : 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-white font-black text-base truncate">
                    {isGuest ? 'Sandbox Test Guest' : `Player_${user?.id?.slice(-4) || '3210'}`}
                  </h2>
                  {isGuest ? (
                    <span className="text-[10px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Sparkles size={10} />
                      TEST GUEST
                    </span>
                  ) : (
                    <span className="text-[10px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-md">
                      ⭐ {vipTier.toUpperCase()} VIP
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8EA8B8] font-mono mt-0.5">{user?.phone || '+91 99999 00000'}</p>
                
                {/* Unique User ID with Copy Button */}
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400 font-mono">
                  <span className="text-gray-500">ID:</span>
                  <span className="truncate max-w-[150px]">{user?.id}</span>
                  <button 
                    onClick={copyUserId}
                    className="p-1 hover:text-neon-mint transition-colors cursor-pointer"
                    title="Copy User ID"
                  >
                    {copied ? <Check size={12} className="text-neon-mint" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#8EA8B8] font-bold uppercase">WALLET BALANCE</span>
                <div className="text-lg font-black text-[#26F0B2]">
                  ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <Link
                href="/wallet"
                className="bg-[#26F0B2] text-[#061625] font-black text-xs px-3.5 py-1.5 rounded-xl shadow-md hover:bg-[#1ed49c] active:scale-95 transition-all"
              >
                WALLET
              </Link>
            </div>
          </div>

          {/* KYC Verification Status Card */}
          <div className="bg-[#0B2236] border border-white/10 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileCheck size={20} className="text-[#26F0B2]" />
                <h3 className="font-black text-sm text-white uppercase">KYC & BANK VERIFICATION</h3>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                kycStatus === 'VERIFIED'
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : (kycStatus === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse' : 'bg-red-500/20 text-red-400 border-red-500/30')
              }`}>
                {kycStatus === 'VERIFIED' ? '✓ VERIFIED' : (kycStatus === 'PENDING' ? '⏳ UNDER REVIEW' : '⚠️ UNVERIFIED')}
              </span>
            </div>

            <p className="text-xs text-[#8EA8B8] leading-relaxed mb-3">
              KYC compliance is mandatory under Indian banking guidelines for high-value payouts.
            </p>

            {showKycForm ? (
              <form onSubmit={handleSubmitKyc} className="space-y-3 pt-2 border-t border-white/10">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-[#8EA8B8] block mb-1">FULL NAME (AS PER PAN)</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#061625] border border-white/15 rounded-xl px-3 py-2 text-white font-bold text-xs outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-[#8EA8B8] block mb-1">PAN NUMBER (10 DIGITS)</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                      className="w-full bg-[#061625] border border-white/15 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-[#8EA8B8] block mb-1">AADHAAR (LAST 4)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={aadhaarLastFour}
                      onChange={(e) => setAadhaarLastFour(e.target.value)}
                      className="w-full bg-[#061625] border border-white/15 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-[#8EA8B8] block mb-1">BANK ACCOUNT #</label>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="w-full bg-[#061625] border border-white/15 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-[#8EA8B8] block mb-1">BANK IFSC CODE</label>
                    <input
                      type="text"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      className="w-full bg-[#061625] border border-white/15 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowKycForm(false)}
                    className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-400 cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={submittingKyc}
                    className="flex-1 py-2 rounded-xl bg-[#26F0B2] text-[#061625] font-black text-xs shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submittingKyc ? 'SUBMITTING...' : 'SUBMIT KYC'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowKycForm(true)}
                className="w-full py-2.5 rounded-xl bg-white/5 border border-white/15 text-white font-bold text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{kycStatus === 'VERIFIED' ? 'VIEW VERIFIED DETAILS' : 'UPDATE / RE-SUBMIT KYC DOCUMENTS'}</span>
                <ArrowUpRight size={14} className="text-[#26F0B2]" />
              </button>
            )}
          </div>

          {/* Navigation & Controls Menu */}
          <div className="bg-[#0B2236] border border-white/10 rounded-2xl overflow-hidden shadow-lg divide-y divide-white/5">
            <Link
              href="/responsible-gaming"
              className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-[#26F0B2]" />
                <span className="text-xs font-bold text-white">Responsible Gaming & Limits</span>
              </div>
              <span className="text-gray-400 text-xs">›</span>
            </Link>

            <Link
              href="/fairness"
              className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock size={18} className="text-[#5BB8FF]" />
                <span className="text-xs font-bold text-white">Provably Fair Verifier Tool</span>
              </div>
              <span className="text-gray-400 text-xs">›</span>
            </Link>

            <Link
              href="/support"
              className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <HelpCircle size={18} className="text-yellow-400" />
                <span className="text-xs font-bold text-white">24/7 VIP Help & Support</span>
              </div>
              <span className="text-gray-400 text-xs">›</span>
            </Link>

            <Link
              href="/terms"
              className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileCheck size={18} className="text-[#8EA8B8]" />
                <span className="text-xs font-bold text-white">Terms, Conditions & AML</span>
              </div>
              <span className="text-gray-400 text-xs">›</span>
            </Link>

            <Link
              href="/privacy"
              className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-[#8EA8B8]" />
                <span className="text-xs font-bold text-white">Privacy Policy & Encryption</span>
              </div>
              <span className="text-gray-400 text-xs">›</span>
            </Link>
          </div>

          {/* Account Actions: Logout & Switch Account */}
          <div className="p-4 bg-[#0B2236] border border-white/10 rounded-2xl shadow-lg space-y-2.5">
            <h4 className="text-[11px] font-black uppercase text-gray-400 mb-2">SESSION ACTIONS</h4>
            
            <button
              onClick={handleSwitchAccount}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/15 text-white font-bold text-xs hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus size={15} className="text-neon-mint" />
              <span>SWITCH ACCOUNT / LOG IN AGAIN</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-black text-xs hover:bg-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut size={15} />
              <span>LOG OUT FROM WINDAQ</span>
            </button>
          </div>

          {/* Security & Sessions */}
          <div className="bg-[#0B2236] border border-white/10 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone size={18} className="text-[#26F0B2]" />
              <div>
                <h4 className="font-black text-xs text-white">ACTIVE LOGIN SESSION</h4>
                <p className="text-[10px] text-[#8EA8B8]">Verified JWT • AES-256 Encrypted Session</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-neon-mint bg-neon-mint/10 border border-neon-mint/20 px-2 py-0.5 rounded-md">
              SECURE
            </span>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

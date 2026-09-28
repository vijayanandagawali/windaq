"use client";

import React, { useState, useEffect } from 'react';
import { X, Smartphone, KeyRound, Sparkles, ShieldCheck, ArrowRight, Loader2, AlertCircle, Gift, UserCheck, Send } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authModalMode,
    isLoading,
    error,
    login,
    register,
    loginAsGuest,
    closeAuthModal,
    clearError
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER' | 'GUEST'>(authModalMode);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Keep internal tab synchronized with store mode
  useEffect(() => {
    setActiveTab(authModalMode);
    clearError();
  }, [authModalMode, isAuthModalOpen, clearError]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setCountdown(30);
        toast.success(data.message || 'OTP sent to your mobile via SMS!');
      } else {
        toast.error(data.message || 'Could not send OTP.');
      }
    } catch {
      toast.error('Network error sending OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'GUEST') {
      await loginAsGuest();
      return;
    }

    if (!otp) {
      toast.error('Please enter the OTP sent to your phone.');
      return;
    }
    if (activeTab === 'REGISTER') {
      await register(phone, otp, referralCode);
    } else {
      await login(phone, otp);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      {/* Sleek, cleanly proportioned card with zero browser scrollbars */}
      <div 
        className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-[0_20px_70px_rgba(15,23,42,0.18)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-neon-mint/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          data-testid="auth-close-btn"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors z-10 cursor-pointer"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Header Branding */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-neon-mint via-emerald-400 to-blue-500 rounded-2xl shadow-[0_0_20px_rgba(0,255,163,0.3)] mb-2">
            <span className="font-black text-deep-ocean text-2xl">W</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">WINDAQ ACCESS</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeTab === 'GUEST'
              ? 'Instant sandbox session with test currency'
              : activeTab === 'REGISTER'
              ? 'Create your account — verified by SMS code'
              : 'Sign in with your mobile OTP to access your wallet'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 bg-slate-50 p-1 rounded-2xl border border-slate-200 mb-5">
          <button
            type="button"
            data-testid="auth-tab-login"
            onClick={() => { setActiveTab('LOGIN'); clearError(); }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'LOGIN'
                ? 'bg-neon-mint text-deep-ocean shadow-md'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            LOGIN
          </button>
          <button
            type="button"
            data-testid="auth-tab-register"
            onClick={() => { setActiveTab('REGISTER'); clearError(); }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'REGISTER'
                ? 'bg-neon-mint text-deep-ocean shadow-md'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            REGISTER
          </button>
          <button
            type="button"
            data-testid="auth-tab-guest"
            onClick={() => { setActiveTab('GUEST'); clearError(); }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'GUEST'
                ? 'bg-amber-400 text-deep-ocean shadow-md'
                : 'text-yellow-600 hover:text-yellow-700'
            }`}
          >
            🧪 GUEST
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-red-700 animate-shake">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Guest Tab Content */}
        {activeTab === 'GUEST' ? (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/25 rounded-2xl">
              <div className="flex items-center gap-2 text-yellow-600 font-black text-xs uppercase mb-1">
                <Sparkles size={16} />
                <span>Sandbox Test Environment</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Test the platform with a synthetic sandbox account. Automatically provisioned with{' '}
                <strong className="text-yellow-600">₹50,000 play money</strong>. It cannot be deposited or withdrawn.
              </p>
            </div>

            <button
              onClick={() => loginAsGuest()}
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-deep-ocean font-black text-sm rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>INITIALIZING SANDBOX...</span>
                </>
              ) : (
                <>
                  <UserCheck size={18} strokeWidth={2.5} />
                  <span>PLAY AS GUEST (₹10,000 CREDIT)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Login & Register Forms */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Input */}
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                MOBILE NUMBER
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center gap-1.5 text-slate-500 font-bold text-xs pointer-events-none">
                  <Smartphone size={15} className="text-neon-mint" />
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  data-testid="auth-phone-input"
                  maxLength={10}
                  required
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-neon-mint rounded-2xl py-3 pl-16 pr-4 text-slate-900 font-mono text-sm tracking-wide outline-none transition-colors"
                />
              </div>
            </div>

            {/* OTP verification (required for both login and registration) */}
            {(activeTab === 'LOGIN' || activeTab === 'REGISTER') && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-black uppercase text-slate-500">
                    VERIFICATION CODE (OTP)
                  </label>
                  <button
                    type="button"
                    disabled={sendingOtp || countdown > 0 || phone.length !== 10}
                    onClick={handleSendOtp}
                    className="text-[11px] font-bold text-neon-mint hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1 cursor-pointer"
                  >
                    {sendingOtp ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : countdown > 0 ? (
                      `Resend in ${countdown}s`
                    ) : (
                      <>
                        <Send size={11} />
                        <span>{otpSent ? 'Resend OTP' : 'Send OTP via SMS'}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative flex items-center">
                  <KeyRound size={16} className="absolute left-3.5 text-neon-mint pointer-events-none" />
                  <input
                    type="text"
                    data-testid="auth-otp-input"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-neon-mint rounded-2xl py-3 pl-10 pr-4 text-slate-900 font-mono text-sm tracking-widest outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Register: Referral Code & Welcome Bonus Badge */}
            {activeTab === 'REGISTER' && (
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">
                  REFERRAL CODE (OPTIONAL)
                </label>
                <div className="relative flex items-center">
                  <Gift size={16} className="absolute left-3.5 text-yellow-600 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="WIN500 (Optional)"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-neon-mint rounded-2xl py-3 pl-10 pr-4 text-slate-900 font-mono text-xs uppercase outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              data-testid="auth-submit-btn"
              disabled={isLoading || phone.length < 10 || otp.length < 4}
              className="w-full py-3.5 bg-neon-mint text-deep-ocean font-black text-sm rounded-2xl shadow-[0_0_20px_rgba(0,255,163,0.35)] hover:bg-[#1ed49c] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>VERIFYING...</span>
                </>
              ) : (
                <>
                  <span>{activeTab === 'REGISTER' ? 'VERIFY & CREATE ACCOUNT' : 'SECURE SIGN IN'}</span>
                  <ArrowRight size={16} strokeWidth={3} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Footer */}
        <div className="mt-5 pt-3.5 border-t border-slate-200 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          <ShieldCheck size={13} className="text-neon-mint" />
          <span>256-Bit Encrypted • Fast2SMS Verified OTP</span>
        </div>
      </div>
    </div>
  );
}

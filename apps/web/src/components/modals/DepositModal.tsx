"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import { X, ArrowDownLeft, Copy, Check, ExternalLink, Loader2, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';
import AnimatedWalletBalance from '@/components/wallet/AnimatedWalletBalance';

const PRESETS = [100, 500, 1000, 2000, 5000];
const POLL_MS = 4000;
const POLL_LIMIT_MS = 15 * 60 * 1000;

interface PaymentConfig {
  enabled: boolean;
  upiId: string;
  payeeName: string;
  minDepositInr: number;
  maxDepositInr: number;
}

type Step = 'amount' | 'pay' | 'waiting' | 'credited' | 'rejected';

export default function DepositModal() {
  const { isDepositing, setDepositing, submitDeposit, fetchBalance, balance, availableBalance } = useWalletStore();
  const { isAuthenticated, isGuest, openAuthModal } = useAuthStore();

  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [amount, setAmount] = useState<number>(500);
  const [utr, setUtr] = useState('');
  const [step, setStep] = useState<Step>('amount');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState('');
  const [intentId, setIntentId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isDepositing && !isAuthenticated) {
      setDepositing(false);
      openAuthModal('LOGIN');
      toast.error('Please log in to deposit');
    }
  }, [isDepositing, isAuthenticated, setDepositing, openAuthModal]);

  // Payment details always come from the server, so the switch and UPI ID can change without a redeploy.
  useEffect(() => {
    if (!isDepositing) return;
    fetch(getApiUrl('/api/payments/config'), { cache: 'no-store' })
      .then((r) => r.json())
      .then((res) => (res?.success ? setConfig(res.data) : setConfigError(true)))
      .catch(() => setConfigError(true));
  }, [isDepositing]);

  const upiLink = config?.upiId
    ? `upi://pay?pa=${encodeURIComponent(config.upiId)}&pn=${encodeURIComponent(config.payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('WinDaq wallet deposit')}`
    : '';

  useEffect(() => {
    if (step !== 'pay' || !upiLink) return;
    QRCode.toDataURL(upiLink, { margin: 1, width: 260 }).then(setQr).catch(() => setQr(''));
  }, [step, upiLink]);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => stopPolling, []);

  const startPolling = (id: string) => {
    stopPolling();
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_LIMIT_MS) return stopPolling();
      try {
        const res = await (await fetch(getApiUrl(`/api/payments/intent/${id}`), { cache: 'no-store' })).json();
        const status = res?.data?.status;
        if (status === 'SUCCESS') {
          stopPolling();
          setStep('credited');
          fetchBalance();
          toast.success('Payment received. Wallet credited!');
        } else if (status === 'FAILED') {
          stopPolling();
          setStep('rejected');
        }
      } catch {
        // transient network error: keep polling
      }
    }, POLL_MS);
  };

  if (!isDepositing || !isAuthenticated) return null;

  const close = () => {
    stopPolling();
    setConfig(null);
    setConfigError(false);
    setStep('amount');
    setUtr('');
    setIntentId(null);
    setDepositing(false);
  };

  const min = config?.minDepositInr ?? 100;
  const max = config?.maxDepositInr ?? 100000;
  const amountValid = Number.isInteger(amount) && amount >= min && amount <= max;
  const utrValid = /^\d{12}$/.test(utr.trim());

  const copyUpi = () => {
    if (!config?.upiId) return;
    navigator.clipboard?.writeText(config.upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submit = async () => {
    if (!utrValid) {
      toast.error('Enter the 12-digit UPI reference number (UTR) from your payment app.');
      return;
    }
    setSubmitting(true);
    const res = await submitDeposit(amount, utr.trim(), 'UPI');
    setSubmitting(false);
    if (!res.success) {
      toast.error(res.message || 'Deposit could not be submitted.');
      return;
    }
    setIntentId(res.data?.intentId || null);
    if (res.data?.status === 'SUCCESS') {
      setStep('credited');
      fetchBalance();
      return;
    }
    setStep('waiting');
    if (res.data?.intentId) startPolling(res.data.intentId);
  };

  const shell = (children: React.ReactNode) => (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" />
        <motion.div role="dialog" aria-modal="true" aria-label="UPI deposit"
          initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
          className="relative z-10 w-full max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-3xl bg-gradient-to-b from-white to-slate-50 p-6 text-left ring-1 ring-slate-200 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neon-mint-soft text-neon-mint"><ArrowDownLeft size={22} /></div>
              <div>
                <h3 className="text-base font-black text-slate-900">Add money</h3>
                <p className="text-xs text-slate-500">UPI • credited automatically when the bank confirms</p>
              </div>
            </div>
            <button onClick={close} aria-label="Close" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X size={18} /></button>
          </div>
          {children}
        </motion.div>
      </div>
    </AnimatePresence>
  );

  if (isGuest) {
    return shell(
      <p className="mt-5 text-sm text-slate-700">Guest accounts use play money only. Log in with your mobile number to add real money.</p>
    );
  }

  if (!config && !configError) {
    return shell(<div className="flex justify-center py-12 text-neon-mint"><Loader2 className="animate-spin" size={28} /></div>);
  }

  if (configError || !config?.enabled) {
    return shell(
      <div className="mt-6 space-y-3 text-center">
        <Clock className="mx-auto text-gold-warning" size={32} />
        <h4 className="text-lg font-black text-slate-900">Deposits are closed right now</h4>
        <p className="text-sm text-slate-600">Adding money is temporarily unavailable. Please check back later.</p>
        <button onClick={close} className="mt-2 w-full rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-900">Close</button>
      </div>
    );
  }

  return shell(
    <>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <span className="text-xs font-semibold text-slate-500">Available balance</span>
        <AnimatedWalletBalance value={availableBalance || balance} className="text-sm text-neon-mint" />
      </div>

      {step === 'amount' && (
        <div className="mt-5 space-y-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Amount</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PRESETS.map((p) => (
                <button key={p} data-testid={`deposit-preset-${p}`} onClick={() => setAmount(p)}
                  className={`rounded-xl py-3 text-sm font-black transition ${amount === p ? 'bg-neon-mint text-deep-ocean' : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'}`}>
                  ₹{p.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Or enter amount (₹{min} – ₹{max.toLocaleString('en-IN')})</span>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">₹</span>
              <input type="number" inputMode="numeric" min={min} max={max} value={amount || ''}
                onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))}
                className="w-full rounded-xl bg-slate-100 py-3 pl-8 pr-4 font-mono text-base font-bold text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-neon-mint/60" />
            </div>
          </label>
          <button onClick={() => setStep('pay')} disabled={!amountValid}
            className="w-full rounded-2xl bg-neon-mint py-3.5 text-sm font-black text-deep-ocean transition hover:bg-neon-mint-hover disabled:opacity-40">
            Continue to pay ₹{(amount || 0).toLocaleString('en-IN')}
          </button>
        </div>
      )}

      {step === 'pay' && (
        <div className="mt-5 space-y-5">
          <button onClick={() => setStep('amount')} className="text-xs font-bold text-neon-mint hover:underline">← Change amount</button>

          <div className="rounded-2xl bg-gold-warning/10 p-3 text-xs text-gold-warning ring-1 ring-gold-warning/30">
            Pay <b>exactly ₹{amount.toLocaleString('en-IN')}</b>. A different amount cannot be matched automatically.
          </div>

          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4">
            {qr
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={qr} alt={`UPI QR code to pay ₹${amount}`} width={220} height={220} className="h-[220px] w-[220px]" />
              : <div className="flex h-[220px] w-[220px] items-center justify-center text-slate-500"><Loader2 className="animate-spin" /></div>}
            <p className="text-center text-xs font-semibold text-slate-400">Scan with any UPI app</p>
          </div>

          <a href={upiLink} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-200 sm:hidden">
            Open UPI app <ExternalLink size={14} />
          </a>

          <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-100 p-3 ring-1 ring-slate-200">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">UPI ID</p>
              <p className="truncate font-mono text-sm font-bold text-slate-900">{config.upiId}</p>
            </div>
            <button onClick={copyUpi} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-neon-mint">
              {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <label htmlFor="deposit-utr" className="block text-xs font-bold uppercase tracking-wider text-slate-500">After paying, enter the 12-digit UTR</label>
            <p className="text-[11px] text-slate-500">Find it in your UPI app under the payment details (UPI Ref No. / UTR).</p>
            <div className="flex gap-2">
              <input id="deposit-utr" inputMode="numeric" maxLength={12} placeholder="e.g. 526712345678" value={utr}
                onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3.5 py-3 font-mono text-sm text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-neon-mint/60" />
              <button onClick={submit} disabled={!utrValid || submitting}
                className="rounded-xl bg-neon-mint px-4 text-sm font-black text-deep-ocean disabled:opacity-40">
                {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'waiting' && (
        <div className="mt-8 space-y-4 text-center">
          <Loader2 className="mx-auto animate-spin text-neon-mint" size={36} />
          <h4 className="text-base font-black text-slate-900">Waiting for the bank to confirm</h4>
          <p className="mx-auto max-w-xs text-sm text-slate-600">
            Your ₹{amount.toLocaleString('en-IN')} will be added automatically, usually within a minute. You can close this window — it will still be credited.
          </p>
          <p className="font-mono text-[11px] text-slate-500">UTR {utr} • Request {intentId?.slice(0, 8)}</p>
          <button onClick={close} className="w-full rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-900">Close</button>
        </div>
      )}

      {step === 'credited' && (
        <div className="mt-8 space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neon-mint-soft text-neon-mint"><ShieldCheck size={32} /></div>
          <h4 className="text-lg font-black text-slate-900">₹{amount.toLocaleString('en-IN')} added</h4>
          <p className="text-sm text-slate-600">The bank confirmed your payment and your wallet has been credited.</p>
          <button onClick={close} className="w-full rounded-2xl bg-neon-mint py-3 text-sm font-black text-deep-ocean">Start playing</button>
        </div>
      )}

      {step === 'rejected' && (
        <div className="mt-8 space-y-4 text-center">
          <AlertTriangle className="mx-auto text-danger" size={32} />
          <h4 className="text-lg font-black text-slate-900">Deposit not approved</h4>
          <p className="text-sm text-slate-600">We could not match this payment. If money left your account, contact support with UTR {utr}.</p>
          <button onClick={close} className="w-full rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-900">Close</button>
        </div>
      )}
    </>
  );
}

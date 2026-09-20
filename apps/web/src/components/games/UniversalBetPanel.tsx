"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Minus, CheckCircle2, XCircle, AlertCircle, 
  RotateCcw, Sparkles, TrendingUp, ShieldCheck, ArrowUpRight, 
  Zap, Clock, DollarSign
} from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { audioEngine } from '@/lib/audioEngine';
import { stateRecovery } from '@/lib/stateRecovery';

export interface UniversalBetPanelProps {
  /** Current market name or label (e.g., 'DRAGON', 'RED', 'OVER 7', 'MULTIPLIER') */
  marketName?: string;
  /** Current market odds / multiplier (default: 2.0x / 1:1 payout) */
  odds?: number;
  /** Minimum bet allowed (default: 10) */
  minBet?: number;
  /** Maximum bet allowed (default: 100,000) */
  maxBet?: number;
  /** Custom chip denominations */
  quickChips?: number[];
  /** Whether betting is currently open / enabled */
  isOpen?: boolean;
  /** Locked state message (e.g. "Bets Locked", "Round in Progress") */
  lockedMessage?: string;
  /** Variant of the panel */
  variant?: 'standard' | 'crash' | 'compact';
  /** External loading override */
  isLoading?: boolean;
  /** External state: 'IDLE' | 'LOADING' | 'ACCEPTED' | 'REJECTED' | 'SETTLED' */
  betState?: 'IDLE' | 'LOADING' | 'ACCEPTED' | 'REJECTED' | 'SETTLED';
  /** Settlement result */
  settlement?: {
    status: 'WON' | 'LOST' | 'REFUNDED';
    payout: number;
    profit: number;
  } | null;
  /** Bet placement callback */
  onPlaceBet: (amount: number, metadata?: any) => Promise<{ success: boolean; betId?: string; message?: string } | void>;
  /** Bet cancellation / Cashout callback (for crash games) */
  onCancelBet?: () => void;
  /** Current multiplier for crash games */
  currentMultiplier?: number;
  /** Title or label for the panel */
  title?: string;
  /** Custom class name */
  className?: string;
}

export default function UniversalBetPanel({
  marketName = 'Standard',
  odds = 2.0,
  minBet = 10,
  maxBet = 100000,
  quickChips = [10, 50, 100, 500, 1000, 5000],
  isOpen = true,
  lockedMessage = 'Betting Locked',
  variant = 'standard',
  isLoading: externalLoading = false,
  betState: externalBetState,
  settlement = null,
  onPlaceBet,
  onCancelBet,
  currentMultiplier = 1.0,
  title,
  className = ''
}: UniversalBetPanelProps) {
  const { balance, setDepositing } = useWalletStore();

  // Internal state
  const [amount, setAmount] = useState<number>(100);
  const [autoCashout, setAutoCashout] = useState<number>(2.0);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [statusState, setStatusState] = useState<'IDLE' | 'LOADING' | 'ACCEPTED' | 'REJECTED' | 'SETTLED'>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [betReceiptId, setBetReceiptId] = useState<string | null>(null);

  // Sync external betState if provided
  useEffect(() => {
    if (externalBetState) {
      setStatusState(externalBetState);
    }
  }, [externalBetState]);

  // Settle sound & haptics
  useEffect(() => {
    if (!settlement) return;
    if (settlement.status === 'WON') {
      if (settlement.profit >= amount * 5 && settlement.profit >= 1000) {
        audioEngine.play('jackpot');
      } else {
        audioEngine.play('win');
      }
    } else if (settlement.status === 'LOST') {
      audioEngine.play('loss');
    }
  }, [settlement, amount]);

  const isLoading = externalLoading || internalLoading;

  // Potential payout calculations
  const potentialPayout = useMemo(() => {
    return parseFloat((amount * odds).toFixed(2));
  }, [amount, odds]);

  const netProfit = useMemo(() => {
    return Math.max(0, parseFloat((potentialPayout - amount).toFixed(2)));
  }, [potentialPayout, amount]);

  // Validation Checks
  const validationError = useMemo(() => {
    if (amount < minBet) return `Min bet is ₹${minBet}`;
    if (amount > maxBet) return `Max bet is ₹${maxBet.toLocaleString('en-IN')}`;
    if (amount > balance) return 'Insufficient wallet balance';
    if (!isOpen) return lockedMessage;
    return null;
  }, [amount, minBet, maxBet, balance, isOpen, lockedMessage]);

  const isValid = validationError === null;

  // Amount Handlers
  const handleStepper = (delta: number) => {
    audioEngine.play('click');
    setAmount(prev => {
      const next = Math.max(minBet, Math.min(maxBet, prev + delta));
      return next;
    });
  };

  const handleMultiplier = (factor: number) => {
    audioEngine.play('click');
    setAmount(prev => {
      const next = Math.max(minBet, Math.min(maxBet, Math.floor(prev * factor)));
      return next;
    });
  };

  const handleSetMax = () => {
    audioEngine.play('click');
    const maxAffordable = Math.min(maxBet, Math.floor(balance));
    setAmount(Math.max(minBet, maxAffordable));
  };

  const handleChipClick = (chip: number) => {
    audioEngine.play('click');
    setAmount(chip);
  };

  // Submit Handler
  const handleConfirmBet = async () => {
    if (!isValid || isLoading) return;

    try {
      audioEngine.play('bet');
      setInternalLoading(true);
      setStatusState('LOADING');
      setStatusMessage('Placing bet...');

      const idempotencyKey = stateRecovery.generateIdempotencyKey('ubp');

      const result = await onPlaceBet(amount, {
        market: marketName,
        odds,
        autoCashout: variant === 'crash' ? autoCashout : undefined,
        idempotencyKey
      });

      if (result && !result.success) {
        audioEngine.play('loss');
        setStatusState('REJECTED');
        setStatusMessage(result.message || 'Bet rejected by server');
        setTimeout(() => setStatusState('IDLE'), 3500);
      } else {
        audioEngine.play('accepted');
        setStatusState('ACCEPTED');
        setStatusMessage(`Placed ₹${amount} on ${marketName}`);
        if (result && result.betId) {
          setBetReceiptId(result.betId);
        }
        stateRecovery.broadcast({
          type: 'BET_PLACED',
          market: marketName,
          amount,
          idempotencyKey
        });
        setTimeout(() => {
          if (statusState === 'ACCEPTED') {
            setStatusState('IDLE');
          }
        }, 4000);
      }
    } catch (err: any) {
      audioEngine.play('loss');
      setStatusState('REJECTED');
      setStatusMessage(err.message || 'Bet failed');
      setTimeout(() => setStatusState('IDLE'), 3500);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <div className={`relative bg-[#0c121e]/90 border border-white/10 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-2xl transition-all ${className}`}>
      
      {/* Top Header: Title, Market, Balance */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          {title && (
            <span className="font-black text-xs uppercase tracking-wider text-white">
              {title}
            </span>
          )}
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/80">
            {marketName} ({odds.toFixed(2)}x)
          </span>
        </div>

        {/* Live Wallet Balance */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-white/40 text-[10px] uppercase font-bold">Bal:</span>
          <span className={`font-black ${amount > balance ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
            ₹{balance.toFixed(2)}
          </span>
          {amount > balance && (
            <button
              type="button"
              onClick={() => setDepositing(true)}
              className="text-[10px] font-bold text-neon-mint bg-neon-mint/15 px-1.5 py-0.2 rounded hover:bg-neon-mint/25 cursor-pointer ml-1"
            >
              + Deposit
            </button>
          )}
        </div>
      </div>

      {/* Crash Mode: Auto Cashout Multiplier */}
      {variant === 'crash' && (
        <div className="mb-3 bg-black/40 border border-white/10 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white/70">
            <Zap size={14} className="text-amber-400" />
            <span>Auto Cashout:</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.1"
              min="1.01"
              max="1000"
              value={autoCashout}
              onChange={(e) => setAutoCashout(parseFloat(e.target.value) || 1.01)}
              className="w-16 bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-white text-base sm:text-xs font-mono font-bold text-center outline-none focus:border-amber-400"
              disabled={statusState === 'ACCEPTED'}
            />
            <span className="text-xs font-mono font-bold text-amber-400">x</span>
          </div>
        </div>
      )}

      {/* Stake Amount Input with Stepper */}
      <div className="bg-black/50 border border-white/10 rounded-xl p-1.5 sm:p-2 flex items-center justify-between gap-1 sm:gap-2 mb-2.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="btn-stepper-minus"
            onClick={() => handleStepper(-10)}
            disabled={amount <= minBet || isLoading}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 flex items-center justify-center text-white font-bold transition-colors cursor-pointer"
            title="Decrease by ₹10"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            data-testid="btn-half"
            onClick={() => handleMultiplier(0.5)}
            disabled={amount <= minBet || isLoading}
            className="px-2 h-8 sm:h-9 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 text-[11px] font-bold text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Half Bet"
          >
            ½
          </button>
        </div>

        {/* Amount Input */}
        <div className="flex-1 text-center relative">
          <div className="flex items-center justify-center gap-0.5">
            <span className="text-neon-mint font-black text-sm">₹</span>
            <input
              type="number"
              data-testid="bet-amount-input"
              min={minBet}
              max={maxBet}
              step="10"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 text-center bg-transparent font-mono font-black text-base sm:text-lg text-white outline-none"
              disabled={isLoading}
            />
          </div>
          <div className="text-[9px] font-mono text-white/40">
            Min: ₹{minBet} • Max: ₹{maxBet >= 1000 ? `${maxBet/1000}k` : maxBet}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="btn-double"
            onClick={() => handleMultiplier(2)}
            disabled={amount * 2 > maxBet || isLoading}
            className="px-2 h-8 sm:h-9 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 text-[11px] font-bold text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Double Bet"
          >
            2x
          </button>
          <button
            type="button"
            data-testid="btn-stepper-plus"
            onClick={() => handleStepper(10)}
            disabled={amount >= maxBet || isLoading}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 flex items-center justify-center text-white font-bold transition-colors cursor-pointer"
            title="Increase by ₹10"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            data-testid="btn-max"
            onClick={handleSetMax}
            disabled={isLoading}
            className="px-1.5 sm:px-2 h-8 sm:h-9 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[10px] font-black text-amber-400 transition-colors cursor-pointer"
            title="Maximum Bet"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Quick Amount Chips */}
      <div className="grid grid-cols-6 gap-1 sm:gap-1.5 mb-3">
        {quickChips.map((chip) => (
          <button
            key={chip}
            type="button"
            data-testid={`chip-${chip}`}
            onClick={() => handleChipClick(chip)}
            disabled={isLoading}
            className={`py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono font-bold transition-all border cursor-pointer min-h-[36px] flex items-center justify-center ${
              amount === chip
                ? 'bg-neon-mint/20 border-neon-mint text-neon-mint shadow-[0_0_10px_rgba(0,255,163,0.3)]'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {chip >= 1000 ? `${chip / 1000}k` : chip}
          </button>
        ))}
      </div>

      {/* Potential Payout & Profit Breakdown */}
      <div className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 flex items-center justify-between text-xs mb-3 font-mono">
        <div>
          <span className="text-white/40 text-[10px] block uppercase">Potential Win</span>
          <span data-testid="potential-payout" className="text-emerald-400 font-black text-sm">₹{potentialPayout.toFixed(2)}</span>
        </div>
        <div className="text-right">
          <span className="text-white/40 text-[10px] block uppercase">Net Profit</span>
          <span data-testid="net-profit" className="text-white/90 font-bold text-xs">+₹{netProfit.toFixed(2)}</span>
        </div>
      </div>

      {/* Status Overlay / Badges: Accepted, Rejected, Settled */}
      {statusState === 'ACCEPTED' && (
        <div data-testid="badge-accepted" className="mb-2.5 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{statusMessage || 'Bet Accepted!'}</span>
          </div>
          {betReceiptId && (
            <span className="text-[10px] font-mono text-emerald-300/60 truncate max-w-[80px]">
              #{betReceiptId.slice(-4)}
            </span>
          )}
        </div>
      )}

      {statusState === 'REJECTED' && (
        <div data-testid="badge-rejected" className="mb-2.5 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center gap-2 text-xs font-bold text-red-300 animate-shake">
          <XCircle size={16} className="text-red-400 shrink-0" />
          <span>{statusMessage || 'Bet Rejected'}</span>
        </div>
      )}

      {/* Settlement Result Banner */}
      {settlement && (
        <div data-testid="settlement-banner" className={`mb-2.5 p-2.5 rounded-xl border flex items-center justify-between ${
          settlement.status === 'WON' 
            ? 'bg-emerald-600/20 border-emerald-400 text-emerald-300' 
            : settlement.status === 'LOST' 
            ? 'bg-red-600/20 border-red-400 text-red-300'
            : 'bg-white/10 border-white/20 text-white'
        }`}>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Sparkles size={15} />
            <span>{settlement.status === 'WON' ? 'ROUND WON!' : (settlement.status === 'LOST' ? 'ROUND LOST' : 'REFUNDED')}</span>
          </div>
          <span className="font-mono font-black text-sm">
            {settlement.status === 'WON' ? `+₹${settlement.payout.toFixed(2)}` : `₹0.00`}
          </span>
        </div>
      )}

      {/* Main Action Button */}
      {variant === 'crash' && statusState === 'ACCEPTED' ? (
        // Crash Live Cashout Button
        <button
          type="button"
          data-testid="btn-cashout"
          onClick={onCancelBet}
          disabled={!isOpen}
          className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wide bg-gradient-to-r from-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white shadow-[0_0_25px_rgba(245,158,11,0.5)] active:scale-98 transition-all cursor-pointer flex flex-col items-center justify-center"
        >
          <span>CASH OUT</span>
          <span className="text-xs font-bold font-mono opacity-90">
            ₹{(amount * currentMultiplier).toFixed(2)} ({currentMultiplier.toFixed(2)}x)
          </span>
        </button>
      ) : (
        // Standard Confirm Bet Button
        <button
          type="button"
          data-testid="btn-place-bet"
          onClick={handleConfirmBet}
          disabled={!isValid || isLoading || !isOpen}
          className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
            !isOpen
              ? 'bg-gray-800 text-gray-400 border border-white/5 cursor-not-allowed'
              : !isValid
              ? 'bg-red-950/40 border border-red-500/30 text-red-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-neon-mint to-emerald-400 hover:from-emerald-400 hover:to-neon-mint text-deep-ocean shadow-[0_0_20px_rgba(0,255,163,0.35)] active:scale-98'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-deep-ocean border-t-transparent animate-spin"></span>
              <span>CONFIRMING...</span>
            </div>
          ) : !isOpen ? (
            <div className="flex items-center gap-1.5">
              <Clock size={16} />
              <span>{lockedMessage}</span>
            </div>
          ) : validationError ? (
            <div className="flex items-center gap-1.5">
              <AlertCircle size={16} />
              <span>{validationError}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span>PLACE BET • ₹{amount}</span>
            </div>
          )}
        </button>
      )}

      {/* Bottom Footer Details */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-white/40 px-1">
        <span className="flex items-center gap-1">
          <ShieldCheck size={11} className="text-emerald-400" /> Server-Authoritative
        </span>
        <span className="font-mono">Odds: {odds.toFixed(2)}x</span>
      </div>

    </div>
  );
}

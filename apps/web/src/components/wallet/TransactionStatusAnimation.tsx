"use client";

import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  RotateCcw, 
  ArrowRightLeft,
  ShieldAlert,
  Loader2 
} from 'lucide-react';

export type TxStatus = 
  | 'PENDING' 
  | 'PROCESSING' 
  | 'SUCCESS' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'REVERSED' 
  | 'REFUNDED' 
  | 'RECONCILIATION_REQUIRED';

interface TransactionStatusAnimationProps {
  status: TxStatus | string;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * TransactionStatusAnimation (Prompt #69 Phase 11)
 * Visual indicator with micro-animations for each transaction lifecycle state.
 */
export function TransactionStatusAnimation({
  status,
  className = '',
  showLabel = true,
  size = 'md'
}: TransactionStatusAnimationProps) {
  const norm = (status || 'PENDING').toUpperCase();

  const sizeClasses = {
    sm: { icon: 12, text: 'text-[10px] px-1.5 py-0.5' },
    md: { icon: 14, text: 'text-xs px-2.5 py-1' },
    lg: { icon: 18, text: 'text-sm px-3.5 py-1.5' }
  }[size];

  switch (norm) {
    case 'SUCCESS':
    case 'COMPLETED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${sizeClasses.text} ${className}`}>
          <CheckCircle2 size={sizeClasses.icon} className="text-emerald-400" />
          {showLabel && <span>Completed</span>}
        </span>
      );

    case 'PROCESSING':
    case 'INITIATED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 ${sizeClasses.text} ${className}`}>
          <Loader2 size={sizeClasses.icon} className="animate-spin text-blue-400" />
          {showLabel && <span>Processing</span>}
        </span>
      );

    case 'PENDING':
    case 'PENDING_REVIEW':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 ${sizeClasses.text} ${className}`}>
          <Clock size={sizeClasses.icon} className="animate-pulse text-amber-400" />
          {showLabel && <span>Pending</span>}
        </span>
      );

    case 'FAILED':
    case 'REJECTED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 ${sizeClasses.text} ${className}`}>
          <XCircle size={sizeClasses.icon} className="text-rose-400" />
          {showLabel && <span>Failed</span>}
        </span>
      );

    case 'REVERSED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 ${sizeClasses.text} ${className}`}>
          <RotateCcw size={sizeClasses.icon} className="text-purple-400" />
          {showLabel && <span>Reversed</span>}
        </span>
      );

    case 'REFUNDED':
    case 'REFUND':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 ${sizeClasses.text} ${className}`}>
          <ArrowRightLeft size={sizeClasses.icon} className="text-cyan-400" />
          {showLabel && <span>Refunded</span>}
        </span>
      );

    case 'RECONCILIATION_REQUIRED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 ${sizeClasses.text} ${className}`}>
          <ShieldAlert size={sizeClasses.icon} className="text-amber-400 animate-bounce" />
          {showLabel && <span>Reconciliation Required</span>}
        </span>
      );

    default:
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700 ${sizeClasses.text} ${className}`}>
          <AlertTriangle size={sizeClasses.icon} className="text-slate-400" />
          {showLabel && <span>{norm}</span>}
        </span>
      );
  }
}

export default TransactionStatusAnimation;

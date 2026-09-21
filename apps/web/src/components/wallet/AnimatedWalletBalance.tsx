"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export interface AnimatedWalletBalanceProps {
  value: number; // In Rupees
  currency?: string;
  className?: string;
  showSign?: boolean;
  prefix?: string;
  precision?: number;
  highlightOnChange?: boolean;
  testId?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * AnimatedWalletBalance (Prompt #69 Phase 10)
 * 
 * Features:
 * - Smooth numeric interpolation using requestAnimationFrame
 * - Formats to INR (e.g. ₹10,000.00)
 * - Positive transaction animation (green pulse) / Negative transaction animation (red pulse)
 * - prefers-reduced-motion support
 * - Never shows fake balance; strictly interpolates towards authoritative server value
 */
export function AnimatedWalletBalance({
  value,
  currency = '₹',
  className = '',
  showSign = false,
  prefix = '',
  precision = 2,
  highlightOnChange = true,
  testId = 'animated-wallet-balance',
  size = 'md'
}: AnimatedWalletBalanceProps) {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [pulseState, setPulseState] = useState<'none' | 'increase' | 'decrease'>('none');
  const prevValueRef = useRef<number>(value);
  const animationFrameRef = useRef<number | null>(null);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-5xl'
  }[size];

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    if (highlightOnChange) {
      if (endValue > startValue) {
        setPulseState('increase');
      } else if (endValue < startValue) {
        setPulseState('decrease');
      }
      const timer = setTimeout(() => setPulseState('none'), 1200);
      return () => clearTimeout(timer);
    }
  }, [value, highlightOnChange]);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = value;

    if (shouldReduceMotion || Math.abs(endValue - startValue) < 0.01) {
      setDisplayValue(endValue);
      return;
    }

    const duration = 650; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic curve
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, shouldReduceMotion]);

  const formatted = displayValue.toLocaleString('en-IN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });

  const sign = showSign && displayValue > 0 ? '+' : '';

  const pulseClass = pulseState === 'increase'
    ? 'text-emerald-400 scale-[1.03] transition-all duration-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]'
    : pulseState === 'decrease'
    ? 'text-rose-400 scale-[0.98] transition-all duration-300 drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]'
    : 'transition-all duration-300';

  return (
    <span 
      data-testid={testId}
      className={`inline-flex items-baseline font-mono tracking-tight font-black ${sizeClasses} ${pulseClass} ${className}`}
      aria-label={`Wallet balance: ${currency} ${formatted}`}
    >
      {prefix && <span className="mr-0.5 opacity-80">{prefix}</span>}
      {currency && <span className="mr-1 text-neon-mint">{currency}</span>}
      <span>{sign}{formatted}</span>
    </span>
  );
}

export default AnimatedWalletBalance;

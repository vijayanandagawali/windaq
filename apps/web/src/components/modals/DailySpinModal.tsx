"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Trophy } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

const PRIZES = [
  { label: '₹50 CASH', amount: 50, color: '#FF3366', bg: '#FF3366' },
  { label: '₹100 CASH', amount: 100, color: '#00E676', bg: '#00E676' },
  { label: '₹200 BONUS', amount: 200, color: '#7928CA', bg: '#7928CA' },
  { label: '₹20 CASH', amount: 20, color: '#FFB800', bg: '#FFB800' },
  { label: '₹500 BIG WIN', amount: 500, color: '#00F0FF', bg: '#00F0FF' },
  { label: '₹1000 MEGA', amount: 1000, color: '#FF0080', bg: '#FF0080' },
  { label: '₹2500 JACKPOT', amount: 2500, color: '#FFD700', bg: '#FFD700' },
  { label: '₹250 CASH', amount: 250, color: '#00C853', bg: '#00C853' },
];

export default function DailySpinModal() {
  const { isSpinOpen, setSpinOpen, claimSpin } = useWalletStore();
  const [spinning, setSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<{ label: string, amount: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);

  useEffect(() => {
    if (!isSpinOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpinOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSpinOpen, setSpinOpen]);

  // Draw the 8-segment wheel
  const drawWheel = (rotationAngle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const center = width / 2;
    const radius = center - 10;
    const segmentAngle = (2 * Math.PI) / PRIZES.length;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(rotationAngle);

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 4;
    ctx.stroke();

    for (let i = 0; i < PRIZES.length; i++) {
      const startAngle = i * segmentAngle;
      const endAngle = startAngle + segmentAngle;

      // Slice background
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.fillStyle = i % 2 === 0 ? '#111827' : '#1f293d';
      ctx.fill();

      // Border line
      ctx.strokeStyle = 'rgba(255, 184, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = PRIZES[i].color;
      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.fillText(PRIZES[i].label, radius - 20, 4);
      ctx.restore();
    }

    ctx.restore();
  };

  useEffect(() => {
    if (isSpinOpen) {
      setTimeout(() => drawWheel(rotationRef.current), 100);
    }
  }, [isSpinOpen]);

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setWonPrize(null);

    // Pick prize (e.g. index 1: ₹100, or index 4: ₹500)
    const targetIndex = Math.floor(Math.random() * PRIZES.length);
    const targetPrize = PRIZES[targetIndex];
    const segmentAngle = (2 * Math.PI) / PRIZES.length;

    // Angle that puts targetIndex at top (3*PI/2)
    const targetAngle = (3 * Math.PI / 2) - (targetIndex * segmentAngle + segmentAngle / 2);
    const extraRotations = (5 + Math.floor(Math.random() * 3)) * (2 * Math.PI);
    const totalRotation = extraRotations + targetAngle;

    const startRotation = rotationRef.current % (2 * Math.PI);
    const endRotation = startRotation + totalRotation;
    const duration = 4000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease out
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentRot = startRotation + (endRotation - startRotation) * easeOut;

      rotationRef.current = currentRot;
      drawWheel(currentRot);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setWonPrize(targetPrize);
        claimSpin(targetPrize.amount, targetPrize.label);

        // Haptic feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 200]);
        }

        // Confetti celebration
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });

        toast.success(`🎉 You won ${targetPrize.label}! Added to wallet.`, {
          duration: 4000
        });
      }
    };

    requestAnimationFrame(animate);
  };

  if (!isSpinOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !spinning && setSpinOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Box */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-sm bg-gradient-to-b from-[#141b2d] to-[#0a0e1a] border border-yellow-500/40 rounded-3xl p-5 text-center shadow-[0_0_50px_rgba(234,179,8,0.25)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎰</span>
              <h3 className="text-white font-black text-base tracking-wide">DAILY LUCKY WHEEL</h3>
            </div>
            <button 
              onClick={() => !spinning && setSpinOpen(false)}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-gray-400 text-xs mb-4">
            Spin once daily for a chance to win up to <span className="text-yellow-400 font-extrabold">₹2,500 Real Cash</span>!
          </p>

          {/* Wheel Stage */}
          <div className="relative w-[280px] h-[280px] mx-auto mb-5 flex items-center justify-center">
            {/* Top Pointer */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 text-yellow-400 text-2xl font-black drop-shadow-[0_0_8px_rgba(234,179,8,1)]">
              ▼
            </div>

            {/* Canvas */}
            <canvas ref={canvasRef} width={280} height={280} className="rounded-full shadow-[0_0_30px_rgba(255,184,0,0.2)]" />

            {/* Center Cap */}
            <div className="absolute w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 border-2 border-white shadow-[0_0_15px_rgba(234,179,8,0.8)] flex flex-col items-center justify-center text-deep-ocean font-black text-[10px] pointer-events-none z-10">
              <span>WIN</span>
              <span className="text-[8px] font-extrabold">DAQ</span>
            </div>
          </div>

          {/* Won Prize Banner */}
          {wonPrize && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-4 p-2.5 rounded-xl bg-neon-mint/15 border border-neon-mint text-neon-mint font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,163,0.3)]"
            >
              <Trophy size={16} />
              <span>WON: {wonPrize.label} (+₹{wonPrize.amount})</span>
            </motion.div>
          )}

          {/* Action Button */}
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 text-deep-ocean font-black text-base tracking-wider shadow-[0_0_25px_rgba(234,179,8,0.5)] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            <span>{spinning ? 'SPINNING...' : 'SPIN NOW (FREE)'}</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

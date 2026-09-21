"use client";

import React, { useEffect, useRef } from 'react';
import { audioEngine } from '@/lib/audioEngine';

// European roulette wheel pocket layout
export const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

interface RouletteWheelProps {
  isSpinning: boolean;
  winningNumber: number | null;
  size?: number;
  isReducedMotion?: boolean;
  onSettleComplete?: (winningNumber: number) => void;
}

export default function RouletteWheel({ 
  isSpinning, 
  winningNumber, 
  size = 260,
  isReducedMotion = false,
  onSettleComplete
}: RouletteWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Wheel & Ball physics state
  const wheelAngleRef = useRef(0);
  const ballAngleRef = useRef(0);
  const ballRadiusRef = useRef(size * 0.44);
  const wheelSpeedRef = useRef(0.012);
  const ballSpeedRef = useRef(-0.07);
  const settleProgressRef = useRef(0);
  const settledCalledRef = useRef(false);
  const lastTickAngleRef = useRef(0);

  useEffect(() => {
    settledCalledRef.current = false;
    settleProgressRef.current = 0;
  }, [winningNumber]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const center = size / 2;
    const numPockets = 37;
    const sliceAngle = (2 * Math.PI) / numPockets;

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      // 1. UPDATE PHYSICS (Server-Authoritative Result Targeting)
      if (isReducedMotion) {
        // Reduced Motion: Instant positioning without long spin
        wheelAngleRef.current += 0.002;
        if (winningNumber !== null) {
          const winIndex = WHEEL_NUMBERS.indexOf(winningNumber);
          const pocketAngle = wheelAngleRef.current + winIndex * sliceAngle + sliceAngle / 2;
          ballAngleRef.current = pocketAngle;
          ballRadiusRef.current = size * 0.32;
          if (!settledCalledRef.current && onSettleComplete) {
            settledCalledRef.current = true;
            onSettleComplete(winningNumber);
          }
        } else {
          ballAngleRef.current = wheelAngleRef.current;
          ballRadiusRef.current = size * 0.32;
        }
      } else if (isSpinning && winningNumber === null) {
        // FAST FREE SPINNING (Anticipation / Wheel launch)
        wheelAngleRef.current += wheelSpeedRef.current;
        ballSpeedRef.current = -0.075;
        ballAngleRef.current += ballSpeedRef.current;
        ballRadiusRef.current = size * 0.44; // Outer smooth orbit track
        settleProgressRef.current = 0;
      } else if (winningNumber !== null) {
        // DECELERATION & TARGETED SETTLE ON SERVER POCKET
        const winIndex = WHEEL_NUMBERS.indexOf(winningNumber);

        if (winIndex !== -1) {
          settleProgressRef.current = Math.min(1, settleProgressRef.current + 0.015);
          const prog = settleProgressRef.current;

          // Wheel slows down gradually
          wheelAngleRef.current += wheelSpeedRef.current * (1 - prog * 0.65);

          // Ball decelerates and transitions from outer rim to pocket
          const targetPocketAngle = wheelAngleRef.current + winIndex * sliceAngle + sliceAngle / 2;
          
          if (prog < 0.7) {
            // Decelerating orbit with gentle inward pull
            ballSpeedRef.current *= 0.985;
            ballAngleRef.current += ballSpeedRef.current;
            ballRadiusRef.current = (size * 0.44) * (1 - prog * 0.4) + (size * 0.32) * (prog * 0.4);

            // Audio tick as ball crosses pockets
            if (Math.abs(ballAngleRef.current - lastTickAngleRef.current) > sliceAngle * 1.5) {
              lastTickAngleRef.current = ballAngleRef.current;
              audioEngine.play('rouletteBall');
            }
          } else {
            // Magnetic drop & micro-bounce into the winning pocket
            const dropProg = (prog - 0.7) / 0.3; // 0 to 1
            const bounce = Math.sin(dropProg * Math.PI * 3) * (1 - dropProg) * (size * 0.02);
            ballRadiusRef.current = size * 0.32 + bounce;

            // Align ball smoothly with targeted pocket
            ballAngleRef.current = targetPocketAngle;

            if (prog >= 1 && !settledCalledRef.current) {
              settledCalledRef.current = true;
              audioEngine.play('rouletteBall');
              audioEngine.play('cardFlip');
              if (onSettleComplete) {
                onSettleComplete(winningNumber);
              }
            }
          }
        }
      } else {
        // IDLE TABLE SPIN
        wheelAngleRef.current += 0.004;
        ballAngleRef.current = wheelAngleRef.current;
        ballRadiusRef.current = size * 0.32;
      }

      // 2. DRAW MAHOGANY & BRASS OUTER BOWL
      ctx.save();
      ctx.translate(center, center);

      // Outer rim gradient
      const rimGrad = ctx.createRadialGradient(0, 0, size * 0.4, 0, 0, size * 0.5);
      rimGrad.addColorStop(0, '#78350f');
      rimGrad.addColorStop(0.3, '#d97706');
      rimGrad.addColorStop(0.6, '#b45309');
      rimGrad.addColorStop(0.9, '#451a03');
      rimGrad.addColorStop(1, '#1c1917');

      ctx.beginPath();
      ctx.arc(0, 0, size * 0.49, 0, Math.PI * 2);
      ctx.fillStyle = rimGrad;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fef08a';
      ctx.stroke();

      // Ball track groove (dark slate)
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.44, 0, Math.PI * 2);
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = size * 0.07;
      ctx.stroke();

      // Brass deflector diamond pins along ball track
      for (let i = 0; i < 8; i++) {
        const pinAngle = (i * Math.PI) / 4;
        const px = Math.cos(pinAngle) * size * 0.44;
        const py = Math.sin(pinAngle) * size * 0.44;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 3. DRAW ROTATING POCKET WHEEL
      ctx.save();
      ctx.rotate(wheelAngleRef.current);

      // Render 37 Pockets
      for (let i = 0; i < numPockets; i++) {
        const num = WHEEL_NUMBERS[i];
        const startA = i * sliceAngle;
        const endA = startA + sliceAngle;
        const isWinner = winningNumber === num;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, size * 0.39, startA, endA);
        ctx.closePath();

        // Pocket Background Color
        if (num === 0) {
          ctx.fillStyle = '#16a34a'; // Green 0
        } else if (RED_NUMBERS.includes(num)) {
          ctx.fillStyle = '#dc2626'; // Red
        } else {
          ctx.fillStyle = '#18181b'; // Black
        }

        // Golden pocket glow when this pocket is the winner and ball settled
        if (isWinner && settleProgressRef.current > 0.8) {
          ctx.fillStyle = '#eab308'; // Glowing gold highlight
        }

        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#78350f';
        ctx.stroke();

        // Pocket Number Typography
        ctx.save();
        ctx.rotate(startA + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = (isWinner && settleProgressRef.current > 0.8) ? '#000000' : '#ffffff';
        ctx.font = `bold ${Math.round(size * 0.044)}px sans-serif`;
        ctx.fillText(`${num}`, size * 0.36, 0);
        ctx.restore();
      }

      // Silver Frets (Pocket Separators)
      for (let i = 0; i < numPockets; i++) {
        const fretAngle = i * sliceAngle;
        ctx.beginPath();
        ctx.moveTo(Math.cos(fretAngle) * size * 0.28, Math.sin(fretAngle) * size * 0.28);
        ctx.lineTo(Math.cos(fretAngle) * size * 0.39, Math.sin(fretAngle) * size * 0.39);
        ctx.strokeStyle = '#e7e5e4';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Center Brass Turret Dome
      const hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.25);
      hubGrad.addColorStop(0, '#fef08a');
      hubGrad.addColorStop(0.5, '#d97706');
      hubGrad.addColorStop(0.8, '#b45309');
      hubGrad.addColorStop(1, '#78350f');

      ctx.beginPath();
      ctx.arc(0, 0, size * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = hubGrad;
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 4-Point Golden Turret Spindle
      for (let i = 0; i < 4; i++) {
        const spokeA = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(spokeA) * size * 0.22, Math.sin(spokeA) * size * 0.22);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Crown Jewel Centerpoint
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore(); // Restore wheel rotation

      // 4. DRAW BALL WITH GLOSS & SHADOW
      const ballX = Math.cos(ballAngleRef.current) * ballRadiusRef.current;
      const ballY = Math.sin(ballAngleRef.current) * ballRadiusRef.current;

      // Realistic Ball Shadow
      ctx.beginPath();
      ctx.arc(ballX + 2, ballY + 2, size * 0.024, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fill();

      // High-Gloss Ceramic/Ivory Ball
      const ballGrad = ctx.createRadialGradient(
        ballX - 2, ballY - 2, 1,
        ballX, ballY, size * 0.024
      );
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.5, '#f1f5f9');
      ballGrad.addColorStop(0.9, '#94a3b8');
      ballGrad.addColorStop(1, '#475569');

      ctx.beginPath();
      ctx.arc(ballX, ballY, size * 0.024, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = (isSpinning || settleProgressRef.current > 0.8) ? 8 : 2;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore(); // Restore center translate

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isSpinning, winningNumber, size, isReducedMotion, onSettleComplete]);

  return (
    <div className="relative flex items-center justify-center select-none">
      <canvas 
        ref={canvasRef} 
        width={size} 
        height={size} 
        className="rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.95),0_0_25px_rgba(234,179,8,0.25)]"
      />
    </div>
  );
}

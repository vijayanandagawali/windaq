"use client";

import React, { useEffect, useRef } from 'react';
import { audioEngine } from '@/lib/audioEngine';

// European roulette wheel order
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

interface RouletteWheelProps {
  isSpinning: boolean;
  winningNumber: number | null;
  size?: number;
}

export default function RouletteWheel({ isSpinning, winningNumber, size = 260 }: RouletteWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Wheel state
  const wheelAngleRef = useRef(0);
  const ballAngleRef = useRef(0);
  const ballRadiusRef = useRef(size * 0.44); // starts on outer track
  const wheelSpeedRef = useRef(0.015);
  const ballSpeedRef = useRef(-0.06);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const center = size / 2;
    const numPockets = 37;
    const sliceAngle = (2 * Math.PI) / numPockets;

    let targetWheelAngle = 0;
    let settling = false;
    let settleProgress = 0;

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      // 1. Update Physics
      if (isSpinning && winningNumber === null) {
        // Free spinning
        wheelAngleRef.current += wheelSpeedRef.current;
        ballAngleRef.current += ballSpeedRef.current;
        ballRadiusRef.current = size * 0.44; // Outer track
        settling = false;
        settleProgress = 0;
      } else if (winningNumber !== null) {
        // Settle into winning pocket
        const winIndex = WHEEL_NUMBERS.indexOf(winningNumber);
        if (winIndex !== -1 && !settling) {
          settling = true;
        }

        if (settling) {
          const prevProgress = settleProgress;
          settleProgress = Math.min(1, settleProgress + 0.02);
          if (prevProgress < 1 && settleProgress >= 1) {
            audioEngine.play('card');
          }
          // Decelerate wheel
          wheelAngleRef.current += wheelSpeedRef.current * (1 - settleProgress * 0.7);
          
          // Align ball to winning pocket
          const pocketAngle = wheelAngleRef.current + winIndex * sliceAngle + sliceAngle / 2;
          // Smoothly interpolate ball radius from outer track into pocket
          ballRadiusRef.current = (size * 0.44) * (1 - settleProgress) + (size * 0.32) * settleProgress;
          ballAngleRef.current = pocketAngle;
        } else {
          wheelAngleRef.current += 0.005; // Gentle idle spin
        }
      } else {
        // Idle
        wheelAngleRef.current += 0.005;
        ballAngleRef.current = wheelAngleRef.current;
        ballRadiusRef.current = size * 0.32;
      }

      // 2. Draw Outer Wooden/Brass Bowl
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

      // Ball track groove
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.44, 0, Math.PI * 2);
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = size * 0.07;
      ctx.stroke();

      // Deflector pins on the track
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

      // 3. Draw Rotating Wheel
      ctx.save();
      ctx.rotate(wheelAngleRef.current);

      // Draw Pockets
      for (let i = 0; i < numPockets; i++) {
        const num = WHEEL_NUMBERS[i];
        const startA = i * sliceAngle;
        const endA = startA + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, size * 0.39, startA, endA);
        ctx.closePath();

        // Color
        if (num === 0) {
          ctx.fillStyle = '#16a34a'; // Green 0
        } else if (RED_NUMBERS.includes(num)) {
          ctx.fillStyle = '#dc2626'; // Red
        } else {
          ctx.fillStyle = '#18181b'; // Black
        }

        // Highlight if winner
        if (winningNumber === num) {
          ctx.fillStyle = '#eab308'; // Golden highlight
        }

        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#78350f';
        ctx.stroke();

        // Number Text
        ctx.save();
        ctx.rotate(startA + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = winningNumber === num ? '#000000' : '#ffffff';
        ctx.font = `bold ${Math.round(size * 0.042)}px sans-serif`;
        ctx.fillText(`${num}`, size * 0.36, 0);
        ctx.restore();
      }

      // Pocket separators (silver frets)
      for (let i = 0; i < numPockets; i++) {
        const fretAngle = i * sliceAngle;
        ctx.beginPath();
        ctx.moveTo(Math.cos(fretAngle) * size * 0.28, Math.sin(fretAngle) * size * 0.28);
        ctx.lineTo(Math.cos(fretAngle) * size * 0.39, Math.sin(fretAngle) * size * 0.39);
        ctx.strokeStyle = '#e7e5e4';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Center Brass Hub / Turret
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

      // Center Spindle 4-point turret
      for (let i = 0; i < 4; i++) {
        const spokeA = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(spokeA) * size * 0.22, Math.sin(spokeA) * size * 0.22);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Center cone jewel
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore(); // Restore wheel rotation

      // 4. Draw The Ball
      const ballX = Math.cos(ballAngleRef.current) * ballRadiusRef.current;
      const ballY = Math.sin(ballAngleRef.current) * ballRadiusRef.current;

      // Ball shadow
      ctx.beginPath();
      ctx.arc(ballX + 2, ballY + 2, size * 0.024, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fill();

      // Ball body (glossy ivory/silver)
      const ballGrad = ctx.createRadialGradient(
        ballX - 2, ballY - 2, 1,
        ballX, ballY, size * 0.024
      );
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.5, '#e2e8f0');
      ballGrad.addColorStop(0.9, '#94a3b8');
      ballGrad.addColorStop(1, '#475569');

      ctx.beginPath();
      ctx.arc(ballX, ballY, size * 0.024, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = isSpinning ? 8 : 2;
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
  }, [isSpinning, winningNumber, size]);

  return (
    <div className="relative flex items-center justify-center">
      <canvas 
        ref={canvasRef} 
        width={size} 
        height={size} 
        className="rounded-full shadow-[0_10px_35px_rgba(0,0,0,0.9),0_0_20px_rgba(234,179,8,0.2)]"
      />
    </div>
  );
}

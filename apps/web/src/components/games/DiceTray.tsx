'use client';

import React from 'react';
import { Die3D } from '@/components/lobby/previews/primitives';

/**
 * Felt dice tray. While the round is locked the dice tumble; when the server's result arrives
 * they land on exactly those faces. The outcome shown is always the server's — the animation
 * only builds anticipation.
 */
export default function DiceTray({ values, tumbling }: { values: number[] | null; tumbling: boolean }) {
  const sum = values ? values.reduce((a, b) => a + b, 0) : null;
  const isTriple = values ? values[0] === values[1] && values[1] === values[2] : false;
  return (
    <div className="relative flex w-full items-center justify-center">
      <div className="relative flex h-[150px] w-[min(92vw,420px)] items-center justify-center rounded-[50%] bg-[radial-gradient(ellipse_at_50%_35%,#34D399,#047857_75%)] shadow-[inset_0_12px_30px_rgba(0,0,0,0.25),0_18px_40px_rgba(4,120,87,0.25)] ring-4 ring-amber-200/70 sm:h-[180px]">
        <div aria-hidden="true" className="absolute inset-[10%] rounded-[50%] border border-white/15" />
        <div className="relative flex items-end gap-4 sm:gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className={tumbling ? 'wd-die-hop' : ''} style={{ animationDelay: `${i * 0.18}s` }}>
              <Die3D size={52} rolling={false} tumble={tumbling} value={values ? values[i] : null} delay={i * 0.12}
                rest={`rotateX(-20deg) rotateY(${20 + i * 25}deg)`} />
            </div>
          ))}
        </div>
      </div>
      {sum !== null && !tumbling && (
        <div className="animate-rise absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-5 py-1.5 text-lg font-black text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.18)] ring-1 ring-slate-200" style={{ animationDelay: '0.9s' }}>
          {sum} <span className="mx-1 text-slate-300">|</span>
          <span className={isTriple ? 'text-violet-600' : sum >= 11 ? 'text-rose-600' : 'text-sky-600'}>{isTriple ? 'TRIPLE' : sum >= 11 ? 'BIG' : 'SMALL'}</span>
        </div>
      )}
    </div>
  );
}

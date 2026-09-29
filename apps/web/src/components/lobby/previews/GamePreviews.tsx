'use client';

import React, { useEffect, useState } from 'react';
import { Die3D, PlayingCard, useInView } from './primitives';

/* Every preview is a small, self-contained scene built from realistic objects. Timers only run
   while the tile is on screen, and CSS animations pause off-screen (see .wd-paused in globals.css). */

function Stage({ children, className = '', inView, innerRef }: {
  children: React.ReactNode; className?: string; inView: boolean; innerRef: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={innerRef} className={`relative h-full w-full overflow-hidden ${inView ? '' : 'wd-paused'} ${className}`}>
      {children}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.35),transparent_55%)]" />
    </div>
  );
}

/* ---------------- Roulette: accurate single-zero wheel ---------------- */
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function sector(r1: number, r2: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  return `M ${p(r2, a0)} A ${r2} ${r2} 0 0 1 ${p(r2, a1)} L ${p(r1, a1)} A ${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`;
}

export function RouletteWheel({ size = '82%' }: { size?: string }) {
  const step = (Math.PI * 2) / WHEEL.length;
  return (
    <div className="relative aspect-square" style={{ width: size }}>
      <svg viewBox="-110 -110 220 220" className="absolute inset-0 h-full w-full drop-shadow-[0_14px_20px_rgba(15,23,42,0.35)]">
        <defs>
          <radialGradient id="rw-wood" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#8B5A2B" /><stop offset="1" stopColor="#4A2A12" /></radialGradient>
          <radialGradient id="rw-gold" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#FFF3C4" /><stop offset="0.45" stopColor="#E7B84A" /><stop offset="1" stopColor="#9A6B12" /></radialGradient>
        </defs>
        <circle r="108" fill="url(#rw-wood)" />
        <circle r="96" fill="#2A1A0E" />
        <g className="wd-wheel-spin">
          {WHEEL.map((n, i) => (
            <path key={n} d={sector(58, 92, i * step - Math.PI / 2 - step / 2, i * step - Math.PI / 2 + step / 2)}
              fill={n === 0 ? '#0E9F6E' : REDS.has(n) ? '#C8102E' : '#16181D'} stroke="#D4A937" strokeWidth="0.6" />
          ))}
          {WHEEL.map((n, i) => (
            <text key={`t${n}`} transform={`rotate(${(i * 360) / WHEEL.length}) translate(0 -80)`} textAnchor="middle" dominantBaseline="middle"
              fontSize="7.5" fontWeight="700" fill="#fff" fontFamily="Georgia, serif">{n}</text>
          ))}
          <circle r="58" fill="none" stroke="#D4A937" strokeWidth="1.2" />
          <circle r="54" fill="url(#rw-wood)" />
          <circle r="30" fill="url(#rw-gold)" />
          {[0, 90, 180, 270].map((d) => (
            <rect key={d} x="-3" y="-50" width="6" height="42" rx="3" fill="url(#rw-gold)" transform={`rotate(${d})`} />
          ))}
          <circle r="9" fill="#FFF3C4" stroke="#9A6B12" strokeWidth="1.5" />
        </g>
        <g className="wd-ball-orbit">
          <circle cx="0" cy="-97" r="4.6" fill="#fff" stroke="#CBD5E1" strokeWidth="0.6" />
        </g>
      </svg>
    </div>
  );
}

function RoulettePreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Stage innerRef={ref} inView={inView} className="flex items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#2DD4BF,#0F766E_75%)]">
      <RouletteWheel />
    </Stage>
  );
}

/* ---------------- Sic Bo dice ---------------- */
function DicePreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Stage innerRef={ref} inView={inView} className="bg-[radial-gradient(circle_at_50%_35%,#34D399,#047857_78%)]">
      <div className="absolute inset-x-[8%] bottom-[16%] top-[22%] rounded-[50%] bg-white/15 blur-[1px] shadow-[inset_0_10px_30px_rgba(255,255,255,0.25)]" />
      <div className="absolute inset-0 flex items-center justify-center gap-[6%]">
        {[0, 0.35, 0.7].map((d, i) => (
          <div key={i} className="wd-die-hop" style={{ animationDelay: `${d}s` }}>
            <Die3D size={40} delay={d} />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-[12%] flex justify-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-white/90">
        <span className="rounded-full bg-sky-500/80 px-2 py-0.5">Small</span>
        <span className="rounded-full bg-rose-500/80 px-2 py-0.5">Big</span>
      </div>
    </Stage>
  );
}

/* ---------------- Card tables ---------------- */
const FELT = 'bg-[radial-gradient(circle_at_50%_30%,#22C3A6,#0B6B5C_80%)]';

function DragonTigerPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Stage innerRef={ref} inView={inView} className={FELT}>
      <div className="absolute inset-x-0 top-[12%] flex justify-around px-[8%] text-[11px] font-extrabold uppercase tracking-widest">
        <span className="text-orange-200">Dragon</span><span className="text-sky-200">Tiger</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center gap-[12%] text-[22px]">
        <PlayingCard rank="K" suit="H" className="wd-flip-a w-[30%] -rotate-6" />
        <span className="rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black text-amber-950 shadow">VS</span>
        <PlayingCard rank="9" suit="S" className="wd-flip-b w-[30%] rotate-6" />
      </div>
    </Stage>
  );
}

function AndarBaharPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Stage innerRef={ref} inView={inView} className={FELT}>
      <div className="absolute left-1/2 top-[10%] w-[26%] -translate-x-1/2 text-[18px]">
        <PlayingCard rank="7" suit="D" className="wd-glow-card" />
        <span className="mt-1 block text-center text-[9px] font-extrabold uppercase tracking-widest text-amber-200">Joker</span>
      </div>
      <div className="absolute inset-x-[6%] bottom-[10%] grid grid-cols-2 gap-[6%]">
        {(['Andar', 'Bahar'] as const).map((side, i) => (
          <div key={side} className="relative h-[92px] rounded-xl border border-white/30 bg-white/10 text-[16px]">
            <span className="absolute left-2 top-1 text-[9px] font-extrabold uppercase tracking-widest text-white/80">{side}</span>
            {[0, 1, 2].map((k) => (
              <PlayingCard key={k} rank={['A', '4', '7'][(k + i) % 3]} suit={(['S', 'C', 'H'] as const)[(k + i) % 3]}
                className="wd-deal absolute top-5 w-[34%]" style={{ left: `${10 + k * 20}%`, animationDelay: `${(k * 2 + i) * 0.45}s` }} />
            ))}
          </div>
        ))}
      </div>
    </Stage>
  );
}

function BlackjackPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Stage innerRef={ref} inView={inView} className={FELT}>
      <div className="absolute inset-x-[10%] top-[16%] h-[55%] rounded-b-[50%] border-b-2 border-amber-200/50" />
      <div className="absolute inset-0 flex items-center justify-center text-[24px]">
        <PlayingCard rank="A" suit="S" className="wd-deal w-[32%] -rotate-[8deg]" style={{ animationDelay: '0s' }} />
        <PlayingCard rank="K" suit="H" className="wd-deal -ml-[12%] w-[32%] rotate-[8deg]" style={{ animationDelay: '0.5s' }} />
      </div>
      <span className="wd-pop absolute bottom-[14%] left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950 shadow-lg">21</span>
    </Stage>
  );
}

/* ---------------- Aviator ---------------- */
function AviatorPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [m, setM] = useState(1);
  const [crashed, setCrashed] = useState(false);
  useEffect(() => {
    if (!inView) return;
    let v = 1; let target = 2 + Math.random() * 5; let pause = 0;
    const t = setInterval(() => {
      if (pause > 0) { pause -= 1; if (pause === 0) { v = 1; target = 2 + Math.random() * 5; setCrashed(false); } return; }
      v *= 1.03;
      if (v >= target) { setCrashed(true); pause = 14; }
      setM(v);
    }, 90);
    return () => clearInterval(t);
  }, [inView]);
  // Position along an exponential-looking curve in a 100x125 box.
  const p = Math.min(1, Math.log(m) / Math.log(7));
  const x = 8 + 78 * p;
  const y = 112 - 84 * Math.pow(p, 1.6);
  const curve = `M 8 112 C ${8 + 40 * p} 112, ${8 + 62 * p} ${112 - 20 * p}, ${x} ${y}`;
  return (
    <Stage innerRef={ref} inView={inView} className="bg-gradient-to-b from-sky-400 via-sky-200 to-sky-50">
      <div aria-hidden="true" className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:18px_18px]" />
      <svg viewBox="0 0 100 125" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs><linearGradient id="av-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E11D48" stopOpacity="0.35" /><stop offset="1" stopColor="#E11D48" stopOpacity="0" /></linearGradient></defs>
        <path d={`${curve} L ${x} 112 Z`} fill="url(#av-fill)" />
        <path d={curve} fill="none" stroke="#E11D48" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {!crashed && (
        <svg viewBox="0 0 64 32" className="absolute h-7 w-14 -translate-x-[70%] -translate-y-[60%] drop-shadow-[0_4px_6px_rgba(15,23,42,0.3)]"
          style={{ left: `${x}%`, top: `${(y / 125) * 100}%`, transform: 'rotate(-18deg)' }} aria-hidden="true">
          <path d="M2 18 L46 14 Q60 13 62 16 Q60 19 46 18 L2 20 Z" fill="#E11D48" />
          <path d="M24 16 L36 2 L42 2 L34 16 Z" fill="#BE123C" />
          <path d="M26 18 L38 30 L43 30 L35 18 Z" fill="#9F1239" />
          <path d="M4 17 L8 8 L12 8 L10 17 Z" fill="#BE123C" />
          <circle cx="54" cy="15.5" r="2" fill="#BAE6FD" />
        </svg>
      )}
      <div className="absolute left-1/2 top-[26%] -translate-x-1/2 text-center">
        <span className={`block font-mono text-[34px] font-black tabular-nums drop-shadow-[0_2px_0_rgba(255,255,255,0.8)] ${crashed ? 'text-rose-600' : 'text-slate-900'}`}>{m.toFixed(2)}x</span>
        {crashed && <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-600">Flew away</span>}
      </div>
    </Stage>
  );
}

/* ---------------- Colour prediction ---------------- */
const COLOUR_BALLS = [
  { n: 0, c: 'from-violet-400 to-rose-500' }, { n: 1, c: 'from-emerald-400 to-emerald-600' }, { n: 2, c: 'from-rose-400 to-rose-600' },
  { n: 3, c: 'from-emerald-400 to-emerald-600' }, { n: 4, c: 'from-rose-400 to-rose-600' }, { n: 5, c: 'from-violet-400 to-emerald-500' },
  { n: 6, c: 'from-rose-400 to-rose-600' }, { n: 7, c: 'from-emerald-400 to-emerald-600' }, { n: 8, c: 'from-rose-400 to-rose-600' }, { n: 9, c: 'from-emerald-400 to-emerald-600' }
];
function ColourPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [hot, setHot] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const t = setInterval(() => setHot((h) => (h + 3) % 10), 700);
    return () => clearInterval(t);
  }, [inView]);
  return (
    <Stage innerRef={ref} inView={inView} className="bg-gradient-to-br from-sky-100 via-white to-emerald-100">
      <div className="absolute inset-x-[8%] top-[12%] grid grid-cols-3 gap-2">
        {[['Green', 'bg-emerald-500'], ['Violet', 'bg-violet-500'], ['Red', 'bg-rose-500']].map(([l, b]) => (
          <span key={l} className={`${b} rounded-lg py-1.5 text-center text-[9px] font-extrabold uppercase text-white shadow`}>{l}</span>
        ))}
      </div>
      <div className="absolute inset-x-[8%] bottom-[14%] grid grid-cols-5 gap-[6%]">
        {COLOUR_BALLS.map((b) => (
          <span key={b.n} className={`flex aspect-square items-center justify-center rounded-full bg-gradient-to-br ${b.c} text-xs font-black text-white shadow-[inset_-3px_-4px_8px_rgba(0,0,0,0.25),0_4px_8px_rgba(15,23,42,0.2)] transition-transform duration-300 ${hot === b.n ? 'scale-125 ring-4 ring-amber-300' : ''}`}>
            {b.n}
          </span>
        ))}
      </div>
    </Stage>
  );
}

/* ---------------- Lotto ---------------- */
function LottoPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const balls = [
    { n: 7, c: '#EF4444', x: 30, y: 45 }, { n: 14, c: '#3B82F6', x: 55, y: 35 }, { n: 21, c: '#F59E0B', x: 70, y: 55 },
    { n: 35, c: '#10B981', x: 42, y: 62 }, { n: 49, c: '#8B5CF6', x: 60, y: 70 }
  ];
  return (
    <Stage innerRef={ref} inView={inView} className="bg-gradient-to-b from-indigo-200 via-sky-100 to-white">
      <div className="absolute left-1/2 top-[14%] aspect-square w-[76%] -translate-x-1/2 rounded-full border-2 border-white/80 bg-gradient-to-br from-white/60 to-sky-200/30 shadow-[inset_0_-12px_30px_rgba(59,130,246,0.25),0_12px_30px_rgba(15,23,42,0.15)]">
        {balls.map((b, i) => (
          <span key={b.n} className="wd-ball-bob absolute flex h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-black text-slate-900"
            style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${i * 0.3}s`, background: `radial-gradient(circle at 32% 28%, #fff 0 14%, ${b.c} 15% 100%)` }}>
            <span className="rounded-full bg-white px-1 leading-tight">{b.n}</span>
          </span>
        ))}
      </div>
    </Stage>
  );
}

/* ---------------- Slots ---------------- */
const REEL = ['7', '🍒', 'BAR', '💎', '🔔', '7', '🍋', '💎'];
function SlotsPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Stage innerRef={ref} inView={inView} className="bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500">
      <div className="absolute inset-x-[8%] top-[22%] h-[52%] rounded-2xl bg-gradient-to-b from-amber-200 to-amber-500 p-[3%] shadow-[0_12px_30px_rgba(15,23,42,0.35)]">
        <div className="grid h-full grid-cols-3 gap-[4%] overflow-hidden rounded-xl bg-white">
          {[0, 1, 2].map((r) => (
            <div key={r} className="relative overflow-hidden">
              <div className="wd-reel flex flex-col items-center" style={{ animationDuration: `${1.1 + r * 0.35}s` }}>
                {[...REEL, ...REEL].map((s, i) => (
                  <span key={i} className={`flex h-[52px] items-center justify-center text-2xl font-black ${s === '7' ? 'text-rose-600' : s === 'BAR' ? 'text-[13px] text-slate-800' : ''}`}>{s}</span>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-transparent to-white opacity-80" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-[6%] top-[48%] h-0.5 bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
    </Stage>
  );
}

/* ---------------- Scratch ---------------- */
function ScratchPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Stage innerRef={ref} inView={inView} className="bg-gradient-to-br from-pink-200 via-rose-100 to-amber-100">
      <div className="absolute inset-x-[10%] top-[16%] bottom-[16%] rounded-2xl bg-white p-[6%] shadow-[0_14px_30px_rgba(15,23,42,0.2)] ring-1 ring-rose-200">
        <p className="text-center text-[10px] font-extrabold uppercase tracking-widest text-rose-600">Gold ticket</p>
        <div className="relative mt-2 grid grid-cols-3 gap-1.5">
          {['₹500', '₹50', '₹500', '₹100', '₹500', '₹50'].map((v, i) => (
            <span key={i} className="flex h-9 items-center justify-center rounded-md bg-amber-50 text-[11px] font-black text-amber-700">{v}</span>
          ))}
          <div className="wd-scratch absolute inset-0 rounded-md bg-[linear-gradient(135deg,#D1D5DB,#F3F4F6_45%,#9CA3AF)]" />
        </div>
        <p className="mt-2 text-center text-[9px] font-bold text-slate-500">Match 3 to win</p>
      </div>
    </Stage>
  );
}

/* ---------------- Teen Patti 20-20 ---------------- */
function TeenPattiPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const hands: { side: string; tone: string; cards: [string, 'S' | 'H' | 'D' | 'C'][]; win: boolean }[] = [
    { side: 'Player A', tone: 'text-sky-100', cards: [['A', 'S'], ['A', 'H'], ['9', 'C']], win: false },
    { side: 'Player B', tone: 'text-rose-100', cards: [['7', 'H'], ['8', 'H'], ['9', 'H']], win: true }
  ];
  return (
    <Stage innerRef={ref} inView={inView} className={FELT}>
      <div className="absolute inset-x-[4%] top-[14%] grid grid-cols-2 gap-[4%]">
        {hands.map((h, hi) => (
          <div key={h.side} className="flex flex-col items-center">
            <span className={`text-[9px] font-extrabold uppercase tracking-[0.2em] ${h.tone}`}>{h.side}</span>
            <div className="mt-2.5 flex text-[10px]">
              {h.cards.map(([r, s], i) => (
                <div key={i} className="-mx-[3px] w-[27px]" style={{ transform: `rotate(${(i - 1) * 9}deg) translateY(${i === 1 ? -2 : 0}px)` }}>
                  <PlayingCard rank={r} suit={s} className={`wd-deal w-full ${h.win ? 'wd-glow-card' : ''}`} style={{ animationDelay: `${(i * 2 + hi) * 0.28}s` }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="absolute left-1/2 top-[27%] -translate-x-1/2 rounded-full bg-black/30 px-1.5 py-0.5 text-[8px] font-black text-white/90">VS</span>
      <div className="absolute inset-x-0 bottom-[12%] flex justify-center">
        <span className="wd-pop rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase text-amber-950 shadow-[0_0_18px_rgba(245,158,11,0.6)]">Pure sequence wins</span>
      </div>
    </Stage>
  );
}

/* ---------------- Casino Hold'em ---------------- */
function HoldemPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const board: [string, 'S' | 'H' | 'D' | 'C'][] = [['10', 'H'], ['J', 'H'], ['Q', 'H'], ['4', 'C'], ['9', 'S']];
  return (
    <Stage innerRef={ref} inView={inView} className={FELT}>
      <div className="absolute inset-[7%] rounded-[46%] border-2 border-amber-200/50 shadow-[inset_0_0_24px_rgba(0,0,0,0.25)]" />
      <div className="absolute left-1/2 top-[13%] flex -translate-x-1/2 gap-1 text-[11px]">
        <PlayingCard rank="A" suit="S" faceDown className="w-[26px]" />
        <PlayingCard rank="A" suit="S" faceDown className="w-[26px]" />
      </div>
      <div className="absolute inset-x-[9%] top-[36%] flex justify-center gap-[2.5%] text-[12px]">
        {board.map(([r, s], i) => (
          <PlayingCard key={i} rank={r} suit={s} className="wd-deal w-[17%]" style={{ animationDelay: `${i * 0.32}s` }} />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-[17%] flex justify-center text-[18px]">
        <PlayingCard rank="K" suit="H" className="wd-glow-card w-[22%] -rotate-6" />
        <PlayingCard rank="A" suit="H" className="wd-glow-card -ml-[7%] w-[22%] rotate-6" />
      </div>
      <span className="absolute bottom-[5%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-3 py-0.5 text-[9px] font-black uppercase text-amber-950 shadow">Royal flush</span>
    </Stage>
  );
}

/* ---------------- Rummy ---------------- */
function RummyPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const groups: { label: string; cards: [string, 'S' | 'H' | 'D' | 'C'][]; wild?: number }[] = [
    { label: 'Pure sequence', cards: [['5', 'H'], ['6', 'H'], ['7', 'H']] },
    { label: 'Set', cards: [['9', 'S'], ['9', 'D'], ['9', 'C']] },
    { label: 'Sequence', cards: [['J', 'S'], ['4', 'D'], ['K', 'S']], wild: 1 }
  ];
  return (
    <Stage innerRef={ref} inView={inView} className="bg-[radial-gradient(circle_at_50%_25%,#2DD4BF,#115E59_82%)]">
      <div className="absolute left-1/2 top-[15%] flex -translate-x-1/2 items-center gap-2 text-[12px]">
        <PlayingCard rank="4" suit="C" className="w-[28px] rotate-6" />
        <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-black uppercase text-amber-950">Wild · 4s</span>
      </div>
      <div className="absolute inset-x-[3%] top-[38%] flex flex-wrap justify-center gap-x-[6%] gap-y-2">
        {groups.map((g, gi) => (
          <div key={g.label} className="flex flex-col items-center">
            <div className="flex text-[12px]">
              {g.cards.map(([r, s], i) => (
                <div key={i} className="wd-deal relative -ml-[12px] w-[26px] first:ml-0" style={{ animationDelay: `${(gi * 3 + i) * 0.18}s` }}>
                  <PlayingCard rank={r} suit={s} className="w-full" />
                  {g.wild === i && <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1 text-[7px] font-black leading-3 text-amber-950">W</span>}
                </div>
              ))}
            </div>
            <span className="mt-1.5 whitespace-nowrap rounded-full bg-white/90 px-1.5 py-0.5 text-[7px] font-black uppercase text-emerald-700">{g.label} ✓</span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

/* ---------------- Ludo ---------------- */
function LudoPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const colors = ['#E5484D', '#30A46C', '#E8A800', '#3E63DD'];
  const pawns = [
    { c: 0, x: 22, y: 45 }, { c: 1, x: 55, y: 22 }, { c: 2, x: 78, y: 55 }, { c: 3, x: 45, y: 78 }
  ];
  return (
    <Stage innerRef={ref} inView={inView} className="bg-gradient-to-br from-sky-100 via-white to-emerald-100">
      <svg viewBox="0 0 150 150" className="absolute left-1/2 top-[10%] w-[80%] -translate-x-1/2 drop-shadow-[0_12px_20px_rgba(15,23,42,0.18)]" aria-hidden="true">
        <rect width="150" height="150" rx="14" fill="#fff" />
        {[[0, 0], [90, 0], [90, 90], [0, 90]].map(([x, y], i) => (
          <g key={i}>
            <rect x={x + 3} y={y + 3} width="54" height="54" rx="9" fill={colors[i]} />
            <rect x={x + 13} y={y + 13} width="34" height="34" rx="7" fill="#fff" opacity=".85" />
          </g>
        ))}
        <g stroke="#E2E8F0" strokeWidth="0.8" fill="none">
          {[60, 70, 80, 90].map((v) => <path key={`h${v}`} d={`M0 ${v} H150`} />)}
          {[60, 70, 80, 90].map((v) => <path key={`v${v}`} d={`M${v} 0 V150`} />)}
        </g>
        <path d="M10 70 H60 V80 H10 Z" fill={colors[0]} opacity=".9" />
        <path d="M70 10 H80 V60 H70 Z" fill={colors[1]} opacity=".9" />
        <path d="M90 70 H140 V80 H90 Z" fill={colors[2]} opacity=".9" />
        <path d="M70 90 H80 V140 H70 Z" fill={colors[3]} opacity=".9" />
        <polygon points="60,60 75,75 60,90" fill={colors[0]} /><polygon points="60,60 90,60 75,75" fill={colors[1]} />
        <polygon points="90,60 90,90 75,75" fill={colors[2]} /><polygon points="60,90 75,75 90,90" fill={colors[3]} />
      </svg>
      {pawns.map((p, i) => (
        <span key={i} className="wd-ball-bob absolute h-[11%] w-[11%] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_4px_8px_rgba(15,23,42,0.35)]"
          style={{ left: `${p.x}%`, top: `${p.y * 0.8 + 10}%`, animationDelay: `${i * 0.4}s`, background: `radial-gradient(circle at 35% 30%, #fff 0 10%, ${colors[p.c]} 42%, color-mix(in srgb, ${colors[p.c]} 65%, #000) 100%)` }}>
          <span className="absolute left-[22%] top-[16%] h-[26%] w-[36%] rounded-full bg-white/70 blur-[1px]" />
        </span>
      ))}
      <div className="wd-die-hop absolute bottom-[6%] right-[8%]"><Die3D size={30} /></div>
    </Stage>
  );
}

/* ---------------- Fantasy cricket ---------------- */
function FantasyPreview() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [pts, setPts] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let v = 0;
    const t = setInterval(() => {
      v = v >= 148.5 ? 0 : Math.min(148.5, v + 6.5);
      setPts(v);
    }, 90);
    return () => clearInterval(t);
  }, [inView]);
  const rows = [
    { tag: 'C', name: 'Captain', x: '2x', tone: 'bg-amber-400 text-amber-950' },
    { tag: 'VC', name: 'Vice-captain', x: '1.5x', tone: 'bg-sky-400 text-sky-950' }
  ];
  return (
    <Stage innerRef={ref} inView={inView} className="bg-[linear-gradient(180deg,#0F2A3D,#0E4A4E_55%,#0B5E46)]">
      <div aria-hidden="true" className="absolute -top-[30%] left-1/2 h-[70%] w-[120%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(253,230,138,0.45),transparent)]" />
      <div aria-hidden="true" className="absolute -bottom-[35%] left-1/2 h-[60%] w-[150%] -translate-x-1/2 rounded-[50%] bg-emerald-600/80" />
      <div className="absolute inset-x-[10%] top-[14%] rounded-2xl bg-white/10 p-[6%] ring-1 ring-white/20 backdrop-blur-sm">
        <div className="flex items-baseline justify-between text-white">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-white/70">Your XI</span>
          <span className="font-mono text-[18px] font-black tabular-nums">{pts.toFixed(1)}<span className="ml-0.5 text-[9px] text-white/60">pts</span></span>
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: 11 }).map((_, i) => <span key={i} className="h-1 flex-1 rounded-full bg-emerald-300" />)}
        </div>
        <div className="mt-2.5 space-y-1.5">
          {rows.map((r) => (
            <div key={r.tag} className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-1">
              <span className={`flex h-5 w-6 items-center justify-center rounded-full text-[8px] font-black ${r.tone}`}>{r.tag}</span>
              <span className="flex-1 text-[9px] font-bold text-white/90">{r.name}</span>
              <span className="text-[9px] font-black text-amber-200">{r.x}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[10%] flex justify-center">
        <span className="rounded-full bg-slate-900/70 px-3 py-1 font-mono text-[10px] font-black tracking-widest text-amber-200">11 · 100 CR</span>
      </div>
    </Stage>
  );
}

const PREVIEWS: Record<string, () => React.ReactElement> = {
  'teen-patti': TeenPattiPreview,
  'texas-holdem': HoldemPreview,
  'rummy': RummyPreview,
  'ludo': LudoPreview,
  'fantasy-cricket': FantasyPreview,
  'european-roulette': RoulettePreview,
  'dice': DicePreview,
  'dragon-tiger': DragonTigerPreview,
  'andar-bahar': AndarBaharPreview,
  'blackjack': BlackjackPreview,
  'aviator': AviatorPreview,
  'colour-prediction': ColourPreview,
  'lotto': LottoPreview,
  'slots': SlotsPreview,
  'scratch': ScratchPreview
};

export default function GamePreview({ slug }: { slug: string }) {
  const P = PREVIEWS[slug];
  return P ? <P /> : null;
}

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Sparkles, 
  ShieldCheck, 
  Flame, 
  Info, 
  ChevronRight, 
  Layers,
  ArrowRight
} from 'lucide-react';

export interface HistoryItem {
  resultId: string;
  roundId: string;
  gameId: string;
  variantId?: string;
  tableId?: string;
  resultType: string;
  resultValue: string;
  resultSummary?: string;
  resultMetadata?: any;
  resultTimestamp: string | Date;
  roundSequence?: string;
  verificationStatus?: string;
  commitmentHash?: string;
  serverSeed?: string;
  clientSeed?: string;
  nonce?: number;
  verificationReference?: string;
  settlementStatus?: string;
  isCorrected?: boolean;
}

interface GameRoadmapStripProps {
  gameId: string;
  variantId?: string;
  history: HistoryItem[];
  onSelectRound?: (item: HistoryItem) => void;
  onOpenFullHistory?: () => void;
  className?: string;
}

export default function GameRoadmapStrip({
  gameId,
  variantId = 'Standard',
  history = [],
  onSelectRound,
  onOpenFullHistory,
  className = ''
}: GameRoadmapStripProps) {
  const [selectedLimit, setSelectedLimit] = useState<number>(20);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  // Filter and limit items
  const displayedItems = useMemo(() => {
    let items = history;
    if (activeFilter !== 'ALL') {
      items = items.filter(item => {
        const val = (item.resultValue || '').toUpperCase();
        return val.includes(activeFilter.toUpperCase());
      });
    }
    return items.slice(0, selectedLimit);
  }, [history, selectedLimit, activeFilter]);

  // Derive streak statistics
  const stats = useMemo(() => {
    if (!history || history.length === 0) return null;

    const gid = gameId.toLowerCase();
    if (gid.includes('dragon-tiger') || gid.includes('dragontiger')) {
      let dragon = 0, tiger = 0, tie = 0;
      history.slice(0, 50).forEach(h => {
        const v = (h.resultValue || '').toUpperCase();
        if (v.includes('DRAGON')) dragon++;
        else if (v.includes('TIGER')) tiger++;
        else if (v.includes('TIE')) tie++;
      });
      return { type: 'dt', dragon, tiger, tie, total: history.slice(0, 50).length };
    }

    if (gid.includes('roulette')) {
      let red = 0, black = 0, green = 0;
      history.slice(0, 50).forEach(h => {
        const v = (h.resultValue || '').toUpperCase();
        const color = h.resultMetadata?.color?.toUpperCase() || (v.includes('RED') ? 'RED' : v.includes('BLACK') ? 'BLACK' : 'GREEN');
        if (color === 'RED') red++;
        else if (color === 'BLACK') black++;
        else green++;
      });
      return { type: 'roulette', red, black, green, total: history.slice(0, 50).length };
    }

    if (gid.includes('colour') || gid.includes('color')) {
      let green = 0, red = 0, violet = 0;
      history.slice(0, 50).forEach(h => {
        const v = (h.resultValue || '').toUpperCase();
        if (v.includes('GREEN')) green++;
        else if (v.includes('RED')) red++;
        else if (v.includes('VIOLET')) violet++;
      });
      return { type: 'colour', green, red, violet, total: history.slice(0, 50).length };
    }

    if (gid.includes('crash') || gid.includes('aviator')) {
      let high = 0, low = 0;
      history.slice(0, 50).forEach(h => {
        const num = parseFloat(h.resultValue.replace('x', '')) || 1.0;
        if (num >= 2.0) high++;
        else low++;
      });
      return { type: 'crash', high, low, total: history.slice(0, 50).length };
    }

    return null;
  }, [history, gameId]);

  // Render individual outcome bead/pill
  const renderBead = (item: HistoryItem, index: number) => {
    const gid = gameId.toLowerCase();
    const rawVal = item.resultValue || '';
    const upperVal = rawVal.toUpperCase();
    const isNewest = index === 0;

    // 1. Roulette: 17 RED, 32 BLACK, 0 GREEN
    if (gid.includes('roulette')) {
      const meta = item.resultMetadata || {};
      const num = meta.number !== undefined ? meta.number : (parseInt(rawVal.match(/\d+/)?.[0] || '0'));
      const color = meta.color || (upperVal.includes('RED') ? 'red' : upperVal.includes('BLACK') ? 'black' : 'green');
      
      const bgClass = color === 'green' || num === 0
        ? 'bg-emerald-600 text-white border-emerald-400' 
        : color === 'red' 
        ? 'bg-rose-600 text-white border-rose-400' 
        : 'bg-slate-900 text-white border-slate-700';

      return (
        <button
          key={item.resultId || `${item.roundId}-${index}`}
          onClick={() => onSelectRound?.(item)}
          title={`Round ${item.roundId}: ${num} ${color.toUpperCase()}`}
          className={`group relative flex items-center justify-center shrink-0 w-9 h-9 rounded-full font-mono font-bold text-xs shadow-md border transition-all duration-200 hover:scale-110 active:scale-95 ${bgClass} ${isNewest ? 'ring-2 ring-amber-400/80 animate-pulse' : ''}`}
        >
          <span>{num}</span>
          {isNewest && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full ring-1 ring-slate-900 animate-ping" />
          )}
        </button>
      );
    }

    // 2. Dragon Tiger: DRAGON / TIGER / TIE
    if (gid.includes('dragon-tiger') || gid.includes('dragontiger')) {
      const isDragon = upperVal.includes('DRAGON');
      const isTiger = upperVal.includes('TIGER');
      const isTie = upperVal.includes('TIE');

      const style = isDragon
        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
        : isTiger
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30';

      const label = isDragon ? 'D' : isTiger ? 'T' : 'TIE';

      return (
        <button
          key={item.resultId || `${item.roundId}-${index}`}
          onClick={() => onSelectRound?.(item)}
          title={`Round ${item.roundId}: ${rawVal}`}
          className={`group relative shrink-0 flex items-center justify-center px-3 py-1.5 rounded-lg border text-xs font-black tracking-wider shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 ${style} ${isNewest ? 'ring-1 ring-amber-400' : ''}`}
        >
          <span>{label}</span>
          {item.resultMetadata?.dragonCard && (
            <span className="ml-1 text-[10px] opacity-70 font-mono">
              {item.resultMetadata.dragonCard.value || ''}v{item.resultMetadata.tigerCard?.value || ''}
            </span>
          )}
        </button>
      );
    }

    // 3. Colour Game: GREEN / RED / VIOLET
    if (gid.includes('colour') || gid.includes('color')) {
      const isGreen = upperVal.includes('GREEN');
      const isRed = upperVal.includes('RED');
      const isViolet = upperVal.includes('VIOLET');
      const num = item.resultMetadata?.number !== undefined ? item.resultMetadata.number : (rawVal.match(/\d+/)?.[0] || '');

      const badgeColor = isGreen
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
        : isRed
        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
        : isViolet
        ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
        : 'bg-slate-800 text-slate-200 border-slate-700';

      return (
        <button
          key={item.resultId || `${item.roundId}-${index}`}
          onClick={() => onSelectRound?.(item)}
          title={`Round ${item.roundId}: ${rawVal}`}
          className={`group relative shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono transition-all duration-200 hover:scale-105 ${badgeColor}`}
        >
          <span className={`w-2 h-2 rounded-full ${isGreen ? 'bg-emerald-400' : isRed ? 'bg-rose-400' : 'bg-purple-400'}`} />
          <span>{num !== '' ? num : rawVal}</span>
        </button>
      );
    }

    // 4. Crash / Aviator: 1.24x, 15.31x
    if (gid.includes('crash') || gid.includes('aviator')) {
      const mult = parseFloat(rawVal.replace('x', '')) || 1.0;
      const colorClass = mult >= 10.0
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
        : mult >= 2.0
        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
        : 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30';

      return (
        <button
          key={item.resultId || `${item.roundId}-${index}`}
          onClick={() => onSelectRound?.(item)}
          title={`Round ${item.roundId}: ${rawVal}`}
          className={`group relative shrink-0 px-2.5 py-1 rounded-md border font-mono font-bold text-xs tracking-tight transition-all duration-200 hover:scale-105 active:scale-95 ${colorClass}`}
        >
          <span>{typeof mult === 'number' ? mult.toFixed(2) : mult}x</span>
        </button>
      );
    }

    // 5. Default Fallback
    return (
      <button
        key={item.resultId || `${item.roundId}-${index}`}
        onClick={() => onSelectRound?.(item)}
        title={`Round ${item.roundId}: ${rawVal}`}
        className="group relative shrink-0 px-2.5 py-1 rounded-md border border-slate-700 bg-slate-800/80 text-slate-200 text-xs font-medium hover:border-slate-500 hover:text-white transition-all"
      >
        <span>{rawVal || 'Round'}</span>
      </button>
    );
  };

  return (
    <div className={`w-full bg-slate-900/95 border border-slate-800 rounded-xl p-3 shadow-xl backdrop-blur-md ${className}`}>
      {/* Top Bar: Title, Streak Counters, Full History trigger */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                Official Result Roadmap
              </h3>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                <ShieldCheck className="w-3 h-3" /> Provably Fair
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Streak Counters */}
        {stats && (
          <div className="flex items-center gap-2 text-[11px] font-bold">
            {stats.type === 'dt' && (
              <>
                <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/20">
                  D: {stats.dragon}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  T: {stats.tiger}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Tie: {stats.tie}
                </span>
              </>
            )}
            {stats.type === 'roulette' && (
              <>
                <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/20">
                  Red: {stats.red}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Black: {stats.black}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  0: {stats.green}
                </span>
              </>
            )}
            {stats.type === 'crash' && (
              <>
                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  ≥2x: {stats.high}
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  &lt;2x: {stats.low}
                </span>
              </>
            )}
          </div>
        )}

        {/* Action Controls: Limit selector & Full History button */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center bg-slate-950/80 rounded-lg p-0.5 border border-slate-800 text-[11px] font-mono">
            {[10, 20, 50].map((lim) => (
              <button
                key={lim}
                onClick={() => setSelectedLimit(lim)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  selectedLimit === lim 
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lim}
              </button>
            ))}
          </div>

          {onOpenFullHistory && (
            <button
              onClick={onOpenFullHistory}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all hover:text-white"
            >
              <span>Full History</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Scrolling Bead Road */}
      {displayedItems.length > 0 ? (
        <div className="relative">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {displayedItems.map((item, idx) => renderBead(item, idx))}
          </div>
        </div>
      ) : (
        <div className="py-4 text-center text-xs text-slate-500 italic bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
          No completed rounds yet. Results will appear automatically in realtime.
        </div>
      )}

      {/* Regulatory & Non-Predictive Disclaimer (Prompt #65 Section 9) */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3 text-slate-400 shrink-0" />
          <span>Historical outcomes only • Independent random trials • Not a predictive system</span>
        </span>
        <span className="hidden sm:inline-block font-mono text-[10px] text-slate-600">
          Click any result for cryptographic proof
        </span>
      </div>
    </div>
  );
}

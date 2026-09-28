"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Cpu, Info, Layers, RotateCcw, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Socket } from '@/lib/gameSocket';
import { createGameSocket } from '@/lib/config';
import { audioEngine } from '@/lib/audioEngine';
import RummyCard, { type RCard, rummyRank } from '@/components/games/RummyCard';

interface GameView {
  id: string;
  phase: 'DRAW' | 'DISCARD' | 'ENDED';
  turn: 'you' | 'cpu' | null;
  hand: RCard[];
  drawnId: string | null;
  cpuCount: number;
  openTop: RCard | null;
  openCount: number;
  closedCount: number;
  wildCard: RCard;
  wildRank: number;
  canDrop: boolean;
  dropPenalty: number;
  lastCpuMove: { source: 'OPEN' | 'CLOSED'; drew: RCard | null; discarded: RCard } | null;
  result: null | {
    winner: 'you' | 'cpu';
    how: 'DECLARED' | 'WRONG_SHOW' | 'DROPPED' | 'COMPUTER_DECLARED';
    youPoints: number;
    cpuPoints: number;
    cpuGroups: RCard[][];
    cpuDeadwood: RCard[];
  };
  serverSeedHash: string;
  serverSeed: string | null;
}

type Kind = 'PURE_SEQUENCE' | 'SEQUENCE' | 'SET' | null;
const KIND_LABEL: Record<string, string> = { PURE_SEQUENCE: 'Pure sequence', SEQUENCE: 'Sequence', SET: 'Set' };
const SUIT: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const cardName = (c: RCard | null | undefined) => (!c ? '' : c.joker ? 'Joker' : `${rummyRank(c.rank)}${SUIT[c.suit || ''] || ''}`);
const HOW_TEXT: Record<string, string> = {
  DECLARED: 'You declared a valid hand',
  WRONG_SHOW: 'Wrong show: the groups were not valid',
  DROPPED: 'You dropped',
  COMPUTER_DECLARED: 'The Computer declared first'
};

function emitAsync<T>(socket: Socket, event: string, data: object): Promise<T & { success: boolean; message?: string }> {
  return new Promise((resolve) => socket.emit(event, data, resolve));
}

/** Keeps the player's grouping in step with the hand: drops cards that left, adds new ones as their own group. */
function reconcile(groups: string[][], hand: RCard[]): string[][] {
  const ids = new Set(hand.map((c) => c.id));
  const kept = groups.map((g) => g.filter((id) => ids.has(id))).filter((g) => g.length);
  const placed = new Set(kept.flat());
  const extra = hand.filter((c) => !placed.has(c.id)).map((c) => c.id);
  return extra.length ? [...kept, extra] : kept;
}

export default function RummyPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [game, setGame] = useState<GameView | null>(null);
  const [groups, setGroups] = useState<string[][]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [check, setCheck] = useState<{ kinds: Kind[]; points: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cpuNote, setCpuNote] = useState<string>('');
  const [cpuThinking, setCpuThinking] = useState(false);
  const [confirmDeclare, setConfirmDeclare] = useState<null | { finishId: string; groups: string[][]; valid: boolean; points: number }>(null);
  const [showRules, setShowRules] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const byId = new Map((game?.hand || []).map((c) => [c.id, c]));

  const applyGame = useCallback((g: GameView, suggestion?: string[][]) => {
    setGame(g);
    setGroups((prev) => reconcile(suggestion || prev, g.hand));
    setSelected((sel) => sel.filter((id) => g.hand.some((c) => c.id === id)));
  }, []);

  const startGame = useCallback(async (s: Socket, fresh: boolean) => {
    const res = await emitAsync<{ game: GameView }>(s, 'rp:start', { fresh });
    if (!res.success) { toast.error(res.message || 'Could not start'); return; }
    const sug = await emitAsync<{ groups: string[][]; deadwood: string[] }>(s, 'rp:suggest', { gameId: res.game.id });
    applyGame(res.game, sug.success ? [...sug.groups, ...(sug.deadwood.length ? [sug.deadwood] : [])] : undefined);
    setCpuNote('');
    audioEngine.play('cardSlide');
  }, [applyGame]);

  useEffect(() => {
    const s = createGameSocket();
    const pending = timers.current;
    s.on('connect', () => {
      setSocket(s);
      startGame(s, false);
    });
    return () => { pending.forEach(clearTimeout); s.disconnect(); };
  }, [startGame]);

  // Live labels and points for the current grouping.
  useEffect(() => {
    if (!socket || !game || game.phase === 'ENDED') return;
    const t = setTimeout(async () => {
      const res = await emitAsync<{ kinds: Kind[]; points: number }>(socket, 'rp:check', { gameId: game.id, groups });
      if (res.success) setCheck({ kinds: res.kinds, points: res.points });
    }, 120);
    return () => clearTimeout(t);
  }, [socket, game, groups]);

  const toggle = (id: string) => setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  const draw = async (source: 'OPEN' | 'CLOSED') => {
    if (!socket || !game || busy || game.turn !== 'you' || game.phase !== 'DRAW') return;
    setBusy(true);
    const res = await emitAsync<{ game: GameView }>(socket, 'rp:draw', { gameId: game.id, source });
    setBusy(false);
    if (!res.success) { toast.error(res.message || 'Cannot draw'); return; }
    audioEngine.play('cardSlide');
    applyGame(res.game);
  };

  const discard = async () => {
    if (!socket || !game || busy || selected.length !== 1 || game.phase !== 'DISCARD') return;
    const cardId = selected[0];
    const card = byId.get(cardId);
    setBusy(true);
    const res = await emitAsync<{ game: GameView }>(socket, 'rp:discard', { gameId: game.id, cardId });
    setBusy(false);
    if (!res.success) { toast.error(res.message || 'Cannot discard'); return; }
    audioEngine.play('cardFlip');
    // Show the player's discard on the pile, then the Computer's move after a short pause.
    setGame({ ...game, hand: game.hand.filter((c) => c.id !== cardId), openTop: card || game.openTop, turn: 'cpu', phase: 'DRAW' });
    setGroups((g) => reconcile(g, game.hand.filter((c) => c.id !== cardId)));
    setSelected([]);
    setCpuThinking(true);
    timers.current.push(setTimeout(() => {
      setCpuThinking(false);
      const m = res.game.lastCpuMove;
      if (m) {
        setCpuNote(`${m.source === 'OPEN' ? `Computer took ${cardName(m.drew)} from the open pile` : 'Computer drew from the deck'} and discarded ${cardName(m.discarded)}`);
        audioEngine.play('cardSlide');
      }
      applyGame(res.game);
      if (res.game.phase === 'ENDED') audioEngine.play(res.game.result?.winner === 'you' ? 'win' : 'loss');
    }, 1100));
  };

  const groupSelected = () => {
    if (selected.length < 2) { toast('Select at least two cards to group'); return; }
    setGroups((g) => [...g.map((grp) => grp.filter((id) => !selected.includes(id))).filter((grp) => grp.length), [...selected]]);
    setSelected([]);
  };

  const sort = async () => {
    if (!socket || !game) return;
    const res = await emitAsync<{ groups: string[][]; deadwood: string[] }>(socket, 'rp:suggest', { gameId: game.id });
    if (res.success) setGroups(reconcile([...res.groups, ...(res.deadwood.length ? [res.deadwood] : [])], game.hand));
  };

  const prepareDeclare = async () => {
    if (!socket || !game || selected.length !== 1 || game.phase !== 'DISCARD') {
      toast('Draw a card, then select the card to finish with');
      return;
    }
    const finishId = selected[0];
    const showGroups = groups.map((g) => g.filter((id) => id !== finishId)).filter((g) => g.length);
    const res = await emitAsync<{ kinds: Kind[]; points: number }>(socket, 'rp:check', { gameId: game.id, groups: showGroups });
    const valid = !!res.success && res.points === 0 && res.kinds.every(Boolean);
    setConfirmDeclare({ finishId, groups: showGroups, valid, points: res.points });
  };

  const declare = async () => {
    if (!socket || !game || !confirmDeclare) return;
    setBusy(true);
    const res = await emitAsync<{ game: GameView }>(socket, 'rp:declare', { gameId: game.id, groups: confirmDeclare.groups, finishId: confirmDeclare.finishId });
    setBusy(false);
    setConfirmDeclare(null);
    if (!res.success) { toast.error(res.message || 'Cannot declare'); return; }
    applyGame(res.game);
    audioEngine.play(res.game.result?.winner === 'you' ? 'jackpot' : 'loss');
  };

  const drop = async () => {
    if (!socket || !game) return;
    const res = await emitAsync<{ game: GameView }>(socket, 'rp:drop', { gameId: game.id });
    if (!res.success) { toast.error(res.message || 'Cannot drop'); return; }
    applyGame(res.game);
    audioEngine.play('loss');
  };

  const yourTurn = game?.turn === 'you' && !cpuThinking;
  const ended = game?.phase === 'ENDED';

  return (
    <div className="relative flex min-h-[calc(100dvh-58px)] w-full flex-col bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 pt-3 sm:px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black tracking-tight sm:text-xl">Rummy</h1>
            <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500"><ShieldCheck size={12} className="text-emerald-600" /> 13-card Points Rummy · free practice</p>
          </div>
          <button onClick={() => socket && startGame(socket, true)} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow ring-1 ring-slate-200">
            <RotateCcw size={13} /> New game
          </button>
        </div>

        <div className="mt-2 flex gap-2 text-xs font-bold">
          <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-white"><Cpu size={12} /> Practice vs Computer · no money</span>
          <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-slate-400 ring-1 ring-slate-200" title="Cash tables seat only real players"><Users size={12} /> Cash tables · soon</span>
        </div>

        {/* Felt */}
        <div className="mt-3 rounded-[26px] bg-[radial-gradient(circle_at_50%_10%,#22C3A6,#0B6B5C_85%)] p-3 shadow-[inset_0_10px_28px_rgba(0,0,0,0.28),0_18px_40px_rgba(11,107,92,0.25)] ring-4 ring-amber-200/70">
          {/* Computer */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white"><Cpu size={12} /> Computer</span>
            <div className="flex text-[10px]">
              {Array.from({ length: game?.cpuCount || 13 }).map((_, i) => (
                <div key={i} className="-ml-4 w-7 first:ml-0"><RummyCard faceDown /></div>
              ))}
            </div>
            {cpuThinking && <span className="animate-pulse text-[11px] font-bold text-white/90">thinking…</span>}
          </div>
          <div className="mt-1 h-4 text-[11px] font-semibold text-white/85">{cpuNote}</div>

          {/* Deck, wild, open pile */}
          <div className="mt-2 flex items-end justify-center gap-5 text-[18px]">
            <button onClick={() => draw('CLOSED')} disabled={!yourTurn || game?.phase !== 'DRAW' || busy}
              className="relative flex flex-col items-center disabled:cursor-default">
              <div className="relative w-[54px]">
                <div className="absolute left-1 top-1 w-full opacity-60"><RummyCard faceDown /></div>
                <RummyCard faceDown className={yourTurn && game?.phase === 'DRAW' ? 'ring-2 ring-amber-300 rounded-[9%]' : ''} />
              </div>
              <span className="mt-1 text-[10px] font-bold text-white/80">Deck · {game?.closedCount ?? 0}</span>
            </button>
            <div className="flex flex-col items-center">
              <div className="w-[42px] rotate-6 opacity-95"><RummyCard card={game?.wildCard} /></div>
              <span className="mt-1 text-[10px] font-bold text-amber-200">Wild: {game ? (game.wildCard.joker ? 'Aces' : `${rummyRank(game.wildRank)}s`) : '—'}</span>
            </div>
            <button onClick={() => draw('OPEN')} disabled={!yourTurn || game?.phase !== 'DRAW' || busy || !game?.openTop}
              className="flex flex-col items-center disabled:cursor-default">
              <div className="w-[54px]">
                <AnimatePresence mode="popLayout">
                  <motion.div key={game?.openTop?.id || 'none'} initial={{ y: -20, opacity: 0, rotate: -6 }} animate={{ y: 0, opacity: 1, rotate: 0 }}>
                    {game?.openTop ? <RummyCard card={game.openTop} wildRank={game.wildRank} /> : <div className="aspect-[5/7] rounded-[9%] border-2 border-dashed border-white/30" />}
                  </motion.div>
                </AnimatePresence>
              </div>
              <span className="mt-1 text-[10px] font-bold text-white/80">Open pile</span>
            </button>
          </div>

          <div className="mt-2 text-center text-[11px] font-bold text-white/90">
            {ended ? 'Game over' : cpuThinking || game?.turn === 'cpu' ? "Computer's turn" : game?.phase === 'DRAW' ? 'Your turn · draw from the deck or the open pile' : 'Discard a card, or select your finish card and declare'}
          </div>
        </div>

        {/* Your hand, in groups */}
        <div className="mt-3 overflow-x-auto pb-4 pt-4 [scrollbar-width:none]">
          <div className="flex w-max items-end gap-3 px-1 text-[16px] sm:text-[20px]">
            {groups.map((g, gi) => {
              const kind = check?.kinds?.[gi];
              return (
                <div key={gi} className="flex flex-col items-center">
                  <div className="flex">
                    {g.map((id) => {
                      const card = byId.get(id);
                      if (!card) return null;
                      return (
                        <button key={id} onClick={() => toggle(id)} className="-ml-5 w-[44px] first:ml-0 sm:-ml-6 sm:w-[56px]">
                          <RummyCard card={card} wildRank={game?.wildRank} selected={selected.includes(id)} fresh={id === game?.drawnId} />
                        </button>
                      );
                    })}
                  </div>
                  <span className={`mt-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black ${kind ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {kind ? `${KIND_LABEL[kind]} ✓` : g.length >= 3 ? 'Not a meld' : 'Loose'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
          <span>Your points: <span className="text-slate-900">{check?.points ?? '—'}</span> <span className="font-medium text-slate-400">(lower is better)</span></span>
          <span>{selected.length ? `${selected.length} selected` : ''}</span>
        </div>

        {/* Actions */}
        <div className="mt-2 grid grid-cols-4 gap-2">
          <button onClick={sort} disabled={ended} className="flex flex-col items-center rounded-xl bg-white py-2.5 text-[11px] font-black text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"><Sparkles size={15} />Sort</button>
          <button onClick={groupSelected} disabled={ended || selected.length < 2} className="flex flex-col items-center rounded-xl bg-white py-2.5 text-[11px] font-black text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"><Layers size={15} />Group</button>
          <button onClick={discard} disabled={!yourTurn || game?.phase !== 'DISCARD' || selected.length !== 1 || busy}
            className="rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 py-2.5 text-xs font-black text-white disabled:opacity-40">Discard</button>
          <button onClick={prepareDeclare} disabled={!yourTurn || game?.phase !== 'DISCARD' || selected.length !== 1 || busy}
            className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 py-2.5 text-xs font-black text-white disabled:opacity-40">Declare</button>
        </div>
        {game?.canDrop && yourTurn && (
          <button onClick={drop} className="mt-2 text-xs font-bold text-rose-600">Drop this game ({game.dropPenalty} points)</button>
        )}

        <button onClick={() => setShowRules((v) => !v)} className="mx-auto mt-3 flex items-center gap-1 text-xs font-bold text-slate-500">
          <Info size={13} /> {showRules ? 'Hide rules' : 'How to play'}
        </button>
        {showRules && (
          <div className="mb-4 mt-2 space-y-2 rounded-2xl bg-white p-4 text-xs text-slate-600 ring-1 ring-slate-200">
            <p>Each turn, draw one card (deck or open pile) and discard one. Arrange all 13 cards into sequences and sets, then declare with your 14th card as the finish card.</p>
            <p>A valid show needs at least two sequences, one of them pure (no joker used). Sets are 3–4 cards of one rank in different suits. The wild card&apos;s rank and printed jokers can stand in for any card.</p>
            <p>Points: A, K, Q, J = 10; number cards = face value; jokers = 0; capped at 80. Dropping costs 20 before your first draw and 40 later; a wrong show costs 80.</p>
            <p>Practice is free and uses no money. The Computer only sees its own cards.</p>
            <p className="break-all font-mono text-[10px] text-slate-400">Shuffle hash: {game?.serverSeedHash}{game?.serverSeed ? ` · seed: ${game.serverSeed}` : ''}</p>
          </div>
        )}
      </div>

      {/* Declare confirmation */}
      <AnimatePresence>
        {confirmDeclare && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
              <h3 className="text-lg font-black">Declare?</h3>
              <p className="mt-1 text-sm text-slate-600">Finish card: <b>{cardName(byId.get(confirmDeclare.finishId))}</b></p>
              <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ${confirmDeclare.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {confirmDeclare.valid ? 'Your groups are valid. Declaring wins the game.' : `These groups are not a valid show (${confirmDeclare.points} points). A wrong show costs 80 points.`}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmDeclare(null)} className="rounded-xl bg-slate-100 py-3 text-sm font-bold">Cancel</button>
                <button onClick={declare} className={`rounded-xl py-3 text-sm font-black text-white ${confirmDeclare.valid ? 'bg-emerald-600' : 'bg-rose-600'}`}>Declare</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {ended && game?.result && !cpuThinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
            <motion.div initial={{ y: 60, scale: 0.96 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
              <p className={`text-xs font-black uppercase tracking-[0.2em] ${game.result.winner === 'you' ? 'text-emerald-600' : 'text-rose-600'}`}>{game.result.winner === 'you' ? 'You win' : 'Computer wins'}</p>
              <h3 className="mt-1 text-xl font-black">{HOW_TEXT[game.result.how]}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Your points</p><p className="text-2xl font-black">{game.result.youPoints}</p></div>
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Computer points</p><p className="text-2xl font-black">{game.result.cpuPoints}</p></div>
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase text-slate-500">Computer&apos;s hand</p>
              <div className="mt-1 flex flex-wrap gap-2 text-[12px]">
                {[...game.result.cpuGroups, ...(game.result.cpuDeadwood.length ? [game.result.cpuDeadwood] : [])].map((g, i) => (
                  <div key={i} className="flex">
                    {g.map((c) => <div key={c.id} className="-ml-3 w-8 first:ml-0"><RummyCard card={c} wildRank={game.wildRank} /></div>)}
                  </div>
                ))}
              </div>
              <button onClick={() => socket && startGame(socket, true)} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 py-3.5 text-sm font-black text-white">Play again</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

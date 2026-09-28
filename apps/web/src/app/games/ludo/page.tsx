"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Cpu, Info, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { Socket } from '@/lib/gameSocket';
import { createGameSocket } from '@/lib/config';
import { audioEngine } from '@/lib/audioEngine';
import { Die3D } from '@/components/lobby/previews/primitives';
import LudoBoard, { type BoardToken } from '@/components/games/ludo/LudoBoard';
import { SEAT_COLOR, SEAT_NAME, pathPositions } from '@/components/games/ludo/geometry';

interface Player { seat: number; kind: 'you' | 'cpu'; tokens: number[] }
interface GameView {
  id: string;
  players: Player[];
  currentSeat: number;
  yourTurn: boolean;
  pendingRoll: number | null;
  legalMoves: number[];
  winner: 'you' | number | null;
  serverSeedHash: string;
  serverSeed: string | null;
}
interface LudoEvent {
  seat: number;
  kind: 'you' | 'cpu';
  roll: number;
  token?: number;
  from?: number;
  to?: number;
  captured?: { seat: number; token: number }[];
  reachedHome?: boolean;
  noMove?: boolean;
  forfeit?: boolean;
  awaiting?: boolean;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function emitAsync<T>(socket: Socket, event: string, data: object): Promise<T & { success: boolean; message?: string }> {
  return new Promise((resolve) => socket.emit(event, data, resolve));
}

export default function LudoPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [game, setGame] = useState<GameView | null>(null);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [dice, setDice] = useState<{ value: number | null; tumble: boolean; seat: number }>({ value: null, tumble: false, seat: 0 });
  const [animating, setAnimating] = useState(false);
  const [note, setNote] = useState('');
  const [opponents, setOpponents] = useState<1 | 3>(1);
  const [showRules, setShowRules] = useState(false);
  const alive = useRef(true);

  const syncPositions = (g: GameView) => {
    const next: Record<string, number> = {};
    g.players.forEach((p) => p.tokens.forEach((pos, i) => { next[`${p.seat}-${i}`] = pos; }));
    setPositions(next);
  };

  const startGame = useCallback(async (s: Socket, fresh: boolean, opp: 1 | 3) => {
    const res = await emitAsync<{ game: GameView }>(s, 'lp:start', { fresh, opponents: opp });
    if (!res.success) { toast.error(res.message || 'Could not start'); return; }
    setGame(res.game);
    syncPositions(res.game);
    setDice({ value: null, tumble: false, seat: 0 });
    setNote('');
  }, []);

  useEffect(() => {
    alive.current = true;
    const s = createGameSocket();
    s.on('connect', () => { setSocket(s); startGame(s, false, 1); });
    return () => { alive.current = false; s.disconnect(); };
  }, [startGame]);

  /** Replays server events: the die, then each token hop, then captures, at a watchable pace. */
  const play = async (events: LudoEvent[], final: GameView) => {
    setAnimating(true);
    for (const ev of events) {
      if (!alive.current) return;
      const who = ev.kind === 'you' ? 'You' : `Computer (${SEAT_NAME[ev.seat]})`;
      setDice({ value: null, tumble: true, seat: ev.seat });
      audioEngine.play('diceShake');
      await wait(ev.kind === 'you' ? 420 : 520);
      setDice({ value: ev.roll, tumble: false, seat: ev.seat });
      audioEngine.play('diceBounce');
      await wait(420);
      if (ev.forfeit) { setNote(`${who} rolled a third 6 — turn lost`); await wait(700); continue; }
      if (ev.noMove) { setNote(`${who} rolled ${ev.roll} — no move`); await wait(ev.kind === 'you' ? 700 : 450); continue; }
      if (ev.awaiting) break;
      if (ev.token === undefined || ev.from === undefined || ev.to === undefined) continue;
      const key = `${ev.seat}-${ev.token}`;
      for (const pos of pathPositions(ev.from, ev.to)) {
        setPositions((p) => ({ ...p, [key]: pos }));
        audioEngine.play('click');
        await wait(150);
      }
      if (ev.captured?.length) {
        await wait(120);
        setPositions((p) => {
          const n = { ...p };
          ev.captured!.forEach((c) => { n[`${c.seat}-${c.token}`] = -1; });
          return n;
        });
        const hitYou = ev.captured.some((c) => c.seat === 0);
        audioEngine.play(hitYou ? 'loss' : 'chipDrop');
        setNote(hitYou ? `${who} captured your token` : `${who} captured a token!`);
        await wait(500);
      } else if (ev.reachedHome) {
        audioEngine.play('accepted');
        setNote(`${who} brought a token home`);
        await wait(350);
      } else {
        setNote('');
      }
      await wait(ev.kind === 'you' ? 120 : 260);
    }
    if (!alive.current) return;
    setGame(final);
    syncPositions(final);
    setAnimating(false);
    if (final.winner !== null) {
      audioEngine.play(final.winner === 'you' ? 'jackpot' : 'loss');
    } else if (final.yourTurn && final.pendingRoll === null) {
      setNote((n) => n || 'Your turn — roll the die');
    }
  };

  const roll = async () => {
    if (!socket || !game || animating || !game.yourTurn || game.pendingRoll !== null) return;
    const res = await emitAsync<{ game: GameView; events: LudoEvent[] }>(socket, 'lp:roll', { gameId: game.id });
    if (!res.success) { toast.error(res.message || 'Cannot roll'); return; }
    await play(res.events, res.game);
    // With a single possible move there is nothing to decide: make it.
    if (res.game.pendingRoll !== null && res.game.legalMoves.length === 1) {
      setAnimating(true); // keep the board locked so a tap cannot race the automatic move
      await wait(250);
      await moveToken(res.game, res.game.legalMoves[0]);
    }
  };

  const moveToken = async (g: GameView, token: number) => {
    if (!socket) return;
    const res = await emitAsync<{ game: GameView; events: LudoEvent[] }>(socket, 'lp:move', { gameId: g.id, token });
    if (!res.success) { setAnimating(false); toast.error(res.message || 'Cannot move'); return; }
    await play(res.events, res.game);
  };

  const tokens: BoardToken[] = (game?.players || []).flatMap((p) => p.tokens.map((_, i) => ({
    seat: p.seat,
    index: i,
    pos: positions[`${p.seat}-${i}`] ?? -1,
    movable: !animating && !!game?.yourTurn && p.kind === 'you' && game.pendingRoll !== null && game.legalMoves.includes(i)
  })));

  const myTurn = !!game?.yourTurn && !animating;
  const winnerText = game?.winner === 'you' ? 'You win!' : game?.winner !== null && game?.winner !== undefined ? `Computer (${SEAT_NAME[game.winner as number]}) wins` : '';

  return (
    <div className="relative flex min-h-[calc(100dvh-58px)] w-full flex-col bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-3 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black tracking-tight sm:text-xl">Ludo</h1>
            <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500"><ShieldCheck size={12} className="text-emerald-600" /> Classic rules · free practice · committed dice</p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow ring-1 ring-slate-200">
            {([1, 3] as const).map((n) => (
              <button key={n} onClick={() => { setOpponents(n); if (socket) startGame(socket, true, n); }}
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ${opponents === n ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>
                {n === 1 ? '1 v 1' : '4 players'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex gap-2 text-xs font-bold">
          <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-white"><Cpu size={12} /> Practice vs Computer · no money</span>
          <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-slate-400 ring-1 ring-slate-200"><Users size={12} /> Cash tables · soon</span>
        </div>

        <div className="mt-3">
          <LudoBoard tokens={tokens} highlightSeat={game?.currentSeat ?? null}
            onTokenClick={(t) => { if (game && t.movable) moveToken(game, t.index); }} />
        </div>

        {/* Turn bar */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <button onClick={roll} disabled={!myTurn || game?.pendingRoll !== null || game?.winner !== null}
            className="relative rounded-2xl p-2 transition disabled:opacity-70" aria-label="Roll the die"
            style={{ background: `color-mix(in srgb, ${SEAT_COLOR[dice.seat]} 16%, white)` }}>
            <Die3D size={46} rolling={false} tumble={dice.tumble} value={dice.value} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black" style={{ color: SEAT_COLOR[animating ? dice.seat : game?.currentSeat ?? 0] }}>
              {game?.winner !== null && game ? winnerText
                : animating ? (dice.seat === 0 ? 'Your move…' : `Computer (${SEAT_NAME[dice.seat]}) is playing…`)
                : myTurn ? (game?.pendingRoll !== null ? 'Tap a glowing token to move' : 'Your turn — tap the die')
                : `Computer (${SEAT_NAME[game?.currentSeat ?? 1]}) is playing…`}
            </p>
            <p className="truncate text-[11px] font-semibold text-slate-500">{note || 'Roll a 6 to bring a token out.'}</p>
          </div>
          <button onClick={() => socket && startGame(socket, true, opponents)} className="rounded-full bg-slate-100 p-2 text-slate-500" aria-label="New game"><RotateCcw size={16} /></button>
        </div>

        <button onClick={() => setShowRules((v) => !v)} className="mx-auto mt-3 flex items-center gap-1 text-xs font-bold text-slate-500">
          <Info size={13} /> {showRules ? 'Hide rules' : 'How to play'}
        </button>
        {showRules && (
          <div className="mb-4 mt-2 space-y-2 rounded-2xl bg-white p-4 text-xs text-slate-600 ring-1 ring-slate-200">
            <p>You are red. Roll a 6 to bring a token onto your start square, then move clockwise by the number rolled and up your red home column. Reach home with an exact roll.</p>
            <p>Landing on an opponent sends it back to base, except on the start squares and stars (safe). A 6, a capture or bringing a token home gives another roll; a third 6 in a row ends your turn.</p>
            <p>Practice is free and uses no money. The Computer uses a fixed strategy and sees only the board.</p>
            <p className="break-all font-mono text-[10px] text-slate-400">Dice seed hash: {game?.serverSeedHash}{game?.serverSeed ? ` · seed: ${game.serverSeed}` : ''}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {game && game.winner !== null && !animating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
            <motion.div initial={{ y: 50, scale: 0.96 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
              <p className={`text-xs font-black uppercase tracking-[0.2em] ${game.winner === 'you' ? 'text-emerald-600' : 'text-rose-600'}`}>{game.winner === 'you' ? 'Victory' : 'Game over'}</p>
              <h3 className="mt-1 text-2xl font-black">{winnerText}</h3>
              <button onClick={() => socket && startGame(socket, true, opponents)} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 py-3.5 text-sm font-black text-white">Play again</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

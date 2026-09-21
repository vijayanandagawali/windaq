"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { audioEngine, SoundEvent } from '@/lib/audioEngine';

export type OrchestratorPhase = 
  | 'IDLE'
  | 'BETTING_OPEN'
  | 'BETTING_CLOSING'
  | 'BETTING_LOCKED'
  | 'GAMEPLAY_ACTION'
  | 'ANTICIPATION'
  | 'RESULT_REVEAL'
  | 'WIN_LOSS_PRESENTATION'
  | 'SETTLEMENT'
  | 'ROUND_RESET'
  | 'COMPLETED';

export interface OrchestratorConfig {
  gameId: string;
  serverPhase?: string;
  phaseTimeLeft?: number;
  phaseEndsAt?: number;
  serverResult?: any;
  onPhaseChange?: (newPhase: OrchestratorPhase) => void;
  onRevealStart?: (result: any) => void;
  onRevealComplete?: (result: any) => void;
  autoPlayAudio?: boolean;
}

export interface OrchestratorState {
  phase: OrchestratorPhase;
  isAnticipating: boolean;
  isRevealing: boolean;
  isSettling: boolean;
  isReducedMotion: boolean;
  hasResult: boolean;
  revealedResult: any;
  fastForward: () => void;
  skipAnimation: () => void;
  playSound: (sound: SoundEvent, extra?: { urgent?: boolean }) => void;
  vibrate: (pattern: number | number[]) => void;
}

export function useAnimationOrchestrator({
  gameId,
  serverPhase = 'IDLE',
  phaseTimeLeft = 0,
  phaseEndsAt = 0,
  serverResult = null,
  onPhaseChange,
  onRevealStart,
  onRevealComplete,
  autoPlayAudio = true
}: OrchestratorConfig): OrchestratorState {
  const [phase, setPhase] = useState<OrchestratorPhase>('IDLE');
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);
  const [revealedResult, setRevealedResult] = useState<any>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevServerPhaseRef = useRef<string>(serverPhase);

  // 1. Detect OS prefers-reduced-motion preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setIsReducedMotion(mediaQuery.matches);
      
      const listener = (e: MediaQueryListEvent) => {
        setIsReducedMotion(e.matches);
        audioEngine.setReducedMotion(e.matches);
      };
      mediaQuery.addEventListener?.('change', listener);
      return () => mediaQuery.removeEventListener?.('change', listener);
    } catch {
      // Fallback
    }
  }, []);

  // Audio helper
  const playSound = useCallback((sound: SoundEvent, extra?: { urgent?: boolean }) => {
    if (autoPlayAudio) {
      try {
        audioEngine.play(sound, extra);
      } catch {}
    }
  }, [autoPlayAudio]);

  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      audioEngine.vibrate(pattern);
    } catch {}
  }, []);

  // Transition helper
  const transitionTo = useCallback((nextPhase: OrchestratorPhase) => {
    setPhase(nextPhase);
    if (onPhaseChange) {
      onPhaseChange(nextPhase);
    }
  }, [onPhaseChange]);

  // Fast-forward & skip animation methods (for reconnect or user setting)
  const skipAnimation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (serverResult) {
      setRevealedResult(serverResult);
      transitionTo('WIN_LOSS_PRESENTATION');
      if (onRevealComplete) onRevealComplete(serverResult);
    } else {
      transitionTo('IDLE');
    }
  }, [serverResult, transitionTo, onRevealComplete]);

  const fastForward = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (serverResult) {
      setRevealedResult(serverResult);
      transitionTo('RESULT_REVEAL');
      if (onRevealStart) onRevealStart(serverResult);
    }
  }, [serverResult, transitionTo, onRevealStart]);

  // 2. Synchronize server round engine phases with animation states
  useEffect(() => {
    const prevPhase = prevServerPhaseRef.current;
    prevServerPhaseRef.current = serverPhase;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // A. Reconnect / Fresh join recovery check
    // If server is already in RESULT_REVEAL, SETTLEMENT, or COMPLETED, do NOT play starting animations
    if (serverPhase === 'RESULT_REVEAL' || serverPhase === 'RESULT') {
      setRevealedResult(serverResult);
      if (isReducedMotion) {
        transitionTo('WIN_LOSS_PRESENTATION');
      } else {
        transitionTo('RESULT_REVEAL');
        if (onRevealStart) onRevealStart(serverResult);
      }
      return;
    }

    if (serverPhase === 'SETTLEMENT' || serverPhase === 'COMPLETED') {
      setRevealedResult(serverResult);
      transitionTo('SETTLEMENT');
      if (onRevealComplete) onRevealComplete(serverResult);
      return;
    }

    // B. Normal Continuous Progression
    switch (serverPhase) {
      case 'CREATED':
      case 'BETTING_OPEN':
        setRevealedResult(null);
        transitionTo('BETTING_OPEN');
        break;

      case 'BETTING_CLOSING':
        transitionTo('BETTING_CLOSING');
        playSound('countdown', { urgent: true });
        break;

      case 'BETTING_CLOSED':
      case 'BETTING_LOCKED':
        transitionTo('BETTING_LOCKED');
        playSound('roundStart');
        break;

      case 'PLAYING':
      case 'DEALING':
      case 'GAMEPLAY_STARTED':
        transitionTo('GAMEPLAY_ACTION');
        
        // Controlled anticipation phase: trigger ANTICIPATION before server outcome reveals
        if (isReducedMotion) {
          if (serverResult) {
            setRevealedResult(serverResult);
            transitionTo('RESULT_REVEAL');
          }
        } else {
          // Schedule anticipation 800ms-1000ms into gameplay
          timerRef.current = setTimeout(() => {
            transitionTo('ANTICIPATION');
            if (serverResult) {
              setRevealedResult(serverResult);
            }
          }, 900);
        }
        break;

      case 'NEXT_ROUND':
        transitionTo('ROUND_RESET');
        timerRef.current = setTimeout(() => {
          setRevealedResult(null);
          transitionTo('BETTING_OPEN');
        }, 800);
        break;

      default:
        if (serverPhase.includes('OPEN')) {
          transitionTo('BETTING_OPEN');
        }
        break;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [serverPhase, serverResult, isReducedMotion, transitionTo, playSound, onRevealStart, onRevealComplete]);

  // 3. React to server result arrival when in ANTICIPATION or GAMEPLAY_ACTION
  useEffect(() => {
    if (serverResult && (phase === 'ANTICIPATION' || phase === 'GAMEPLAY_ACTION' || phase === 'BETTING_LOCKED')) {
      setRevealedResult(serverResult);
      if (isReducedMotion) {
        transitionTo('WIN_LOSS_PRESENTATION');
        if (onRevealComplete) onRevealComplete(serverResult);
      } else {
        // Short controlled anticipation window (600ms) before stepping into RESULT_REVEAL
        timerRef.current = setTimeout(() => {
          transitionTo('RESULT_REVEAL');
          if (onRevealStart) onRevealStart(serverResult);
          playSound('accepted');

          // Hold reveal presentation before triggering win/loss presentation
          timerRef.current = setTimeout(() => {
            transitionTo('WIN_LOSS_PRESENTATION');
            if (onRevealComplete) onRevealComplete(serverResult);
          }, 1800);
        }, 650);
      }
    }
  }, [serverResult, phase, isReducedMotion, transitionTo, onRevealStart, onRevealComplete, playSound]);

  return {
    phase,
    isAnticipating: phase === 'ANTICIPATION',
    isRevealing: phase === 'RESULT_REVEAL',
    isSettling: phase === 'SETTLEMENT',
    isReducedMotion,
    hasResult: Boolean(revealedResult),
    revealedResult,
    fastForward,
    skipAnimation,
    playSound,
    vibrate
  };
}

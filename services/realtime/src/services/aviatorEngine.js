const crypto = require('crypto');
const { generateGameHash, calculateCrashPoint } = require('@windaq/provably-fair');
const { redisClient } = require('../config/redisClient');
const { UniversalRoundEngine, UNIVERSAL_PHASES } = require('./engine/UniversalRoundEngine');

class AviatorEngine extends UniversalRoundEngine {
  constructor(io) {
    const customDurations = {
      CREATED: 1,
      BETTING_OPEN: 6,   // 6 sec countdown for bets
      BETTING_CLOSED: 1, // Lock bets
      PLAYING: 10,       // Estimated max flight window
      RESULT: 3,         // Crash display
      SETTLEMENT: 2,     // Settle bets
      COMPLETED: 1,
      NEXT_ROUND: 1
    };

    super('aviator', 'default', io, customDurations);
    this.io = io;
    this.multiplier = 1.00;
    this.crashPoint = 1.00;
    this.tickRateMs = 100;
    this.flyInterval = null;
  }

  startLoop() {
    this.start();
  }

  // --- UNIVERSAL ENGINE HOOKS ---

  async onCreateRound(roundId) {
    this.multiplier = 1.00;
    this.nonce++;

    // Generate crash point using Provably Fair algorithm
    const gameHash = generateGameHash(this.serverSeed, `${this.clientSeed || '0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c'}:${this.nonce}`);
    this.crashPoint = calculateCrashPoint(gameHash);
  }

  async onBettingOpen(roundId) {
    this.multiplier = 1.00;
  }

  async onBettingClosed(roundId) {}
  async onBettingLocked(roundId) { return this.onBettingClosed(roundId); }

  async onPlay(roundId) {
    this.io.to('aviator').emit('aviator:start', { roundId });
    this.multiplier = 1.00;

    // Fast sub-second multiplier loop
    return new Promise((resolve) => {
      this.flyInterval = setInterval(async () => {
        this.multiplier += 0.01 * this.multiplier + 0.005;

        if (this.multiplier >= this.crashPoint) {
          clearInterval(this.flyInterval);
          this.flyInterval = null;
          resolve({ crashPoint: this.crashPoint });
        } else {
          const currentMultiplier = this.multiplier.toFixed(2);
          this.io.to('aviator').emit('aviator:tick', { multiplier: currentMultiplier });
          if (redisClient?.set) {
            await redisClient.set('aviator:current_multiplier', currentMultiplier).catch(() => {});
          }
        }
      }, this.tickRateMs);
    });
  }

  async onResult(roundId) {
    const finalMultiplier = this.crashPoint.toFixed(2);

    this.io.to('aviator').emit('aviator:crashed', {
      roundId,
      multiplier: finalMultiplier,
      serverSeed: this.serverSeed,
      clientSeed: this.clientSeed,
      nonce: this.nonce
    });

    return { crashPoint: parseFloat(finalMultiplier) };
  }

  async onSettlement(roundId, result) {}
  async onCompleted(roundId, result) {}
  async onNextRound() {
    if (this.flyInterval) {
      clearInterval(this.flyInterval);
      this.flyInterval = null;
    }
  }

  async loop() {
    while (this.isRunning) {
      try {
        const now = Date.now();
        this.phaseTimeLeft = Math.max(0, Math.ceil((this.phaseEndsAt - now) / 1000));

        // When in BETTING_OPEN, emit countdown for legacy aviator client
        if (this.currentPhase === UNIVERSAL_PHASES.BETTING_OPEN) {
          this.io.to('aviator').emit('aviator:waiting', {
            countdown: this.phaseTimeLeft,
            hash: this.serverSeedHash,
            roundId: this.roundId
          });
        }

        if (now >= this.phaseEndsAt && this.currentPhase !== UNIVERSAL_PHASES.PLAYING) {
          await this.handlePhaseTransition();
        } else if (this.currentPhase === UNIVERSAL_PHASES.PLAYING && !this.flyInterval) {
          // Trigger flight
          await this.handlePhaseTransition();
        }

        const tickPayload = {
          roundId: this.roundId,
          gameId: 'aviator',
          room: 'default',
          phase: this.currentPhase,
          serverTime: now,
          phaseEndsAt: this.phaseEndsAt,
          phaseTimeLeft: this.phaseTimeLeft,
          totalPhaseDuration: this.totalPhaseDuration,
          serverSeedHash: this.serverSeedHash,
          result: this.currentResult,
          history: this.history.slice(0, 20)
        };

        this.emitEvent('round:tick', tickPayload);

      } catch (err) {
        console.error('[AviatorEngine] Error in loop:', err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = AviatorEngine;

const crypto = require('crypto');

/**
 * Universal Game Round Engine Lifecycle Phases
 */
const UNIVERSAL_PHASES = {
  CREATED: 'CREATED',               // Round initialized, seeds generated, hash pre-committed
  BETTING_OPEN: 'BETTING_OPEN',     // Player bets accepted, visual timer running
  BETTING_CLOSED: 'BETTING_CLOSED', // Server locks bets, no more bets allowed
  PLAYING: 'PLAYING',               // Game action (dealing, spinning, rolling, flying)
  RESULT: 'RESULT',                 // Provably fair outcome revealed & verified
  SETTLEMENT: 'SETTLEMENT',         // Atomic payouts, wallet updates, ledger entries
  COMPLETED: 'COMPLETED',           // Round finalized in DB and added to history
  NEXT_ROUND: 'NEXT_ROUND'          // Clean-up and transition to next round
};

/**
 * Default phase durations in seconds
 */
const DEFAULT_PHASE_DURATIONS = {
  CREATED: 1,
  BETTING_OPEN: 15,
  BETTING_CLOSED: 2,
  PLAYING: 4,
  RESULT: 3,
  SETTLEMENT: 3,
  COMPLETED: 1,
  NEXT_ROUND: 2
};

class UniversalRoundEngine {
  constructor(gameId, room = 'Standard', ioOrCore, customDurations = {}) {
    this.gameId = gameId;
    this.room = room;
    this.emitter = ioOrCore; // CoreSocketManager or Socket.io instance
    
    // Configurable phase durations
    this.phaseDurations = { ...DEFAULT_PHASE_DURATIONS, ...customDurations };

    // Unique Round State
    this.roundId = this.generateUniqueRoundId();
    this.currentPhase = UNIVERSAL_PHASES.CREATED;
    this.phaseStartedAt = Date.now();
    this.totalPhaseDuration = this.phaseDurations.CREATED;
    this.phaseEndsAt = this.phaseStartedAt + (this.totalPhaseDuration * 1000);
    this.phaseTimeLeft = this.totalPhaseDuration;

    // Provably Fair Cryptographic Entropy
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.serverSeedHash = crypto.createHash('sha256').update(this.serverSeed).digest('hex');
    this.clientSeed = '';
    this.nonce = 1;

    // Outcome & History
    this.currentResult = null;
    this.history = [];
    this.isRunning = false;
  }

  /**
   * Generates a globally unique round ID
   */
  generateUniqueRoundId() {
    const timestamp = Date.now();
    const entropy = crypto.randomBytes(4).toString('hex');
    return `${this.gameId}-${timestamp}-${entropy}`;
  }

  /**
   * Starts the authoritative server game loop
   */
  async start() {
    this.isRunning = true;
    console.log(`[UniversalEngine:${this.gameId}:${this.room}] Starting universal round lifecycle`);
    await this.initRound();
    this.loop();
  }

  stop() {
    this.isRunning = false;
  }

  /**
   * Initializes or recovers the round
   */
  async initRound() {
    this.roundId = this.generateUniqueRoundId();
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.serverSeedHash = crypto.createHash('sha256').update(this.serverSeed).digest('hex');
    this.clientSeed = '';
    this.currentResult = null;

    await this.onCreateRound(this.roundId);
    this.setPhase(UNIVERSAL_PHASES.BETTING_OPEN);
  }

  /**
   * Authoritative phase transition
   */
  setPhase(phase) {
    this.currentPhase = phase;
    const duration = this.phaseDurations[phase] || 2;
    this.totalPhaseDuration = duration;
    this.phaseTimeLeft = duration;
    this.phaseStartedAt = Date.now();
    this.phaseEndsAt = this.phaseStartedAt + (duration * 1000);

    // Emit phase change
    this.emitEvent('round:phase_change', {
      roundId: this.roundId,
      gameId: this.gameId,
      room: this.room,
      phase: this.currentPhase,
      serverTime: Date.now(),
      phaseEndsAt: this.phaseEndsAt,
      totalPhaseDuration: this.totalPhaseDuration,
      phaseTimeLeft: this.phaseTimeLeft,
      serverSeedHash: this.serverSeedHash,
      result: (this.currentPhase === UNIVERSAL_PHASES.RESULT || 
               this.currentPhase === UNIVERSAL_PHASES.SETTLEMENT || 
               this.currentPhase === UNIVERSAL_PHASES.COMPLETED ||
               this.currentPhase === UNIVERSAL_PHASES.NEXT_ROUND) ? this.currentResult : null
    });
  }

  /**
   * Broadcasts an event to the game room
   */
  emitEvent(eventName, payload) {
    if (!this.emitter) return;
    const roomName = `${this.gameId}:${this.room}`;
    
    // Support CoreSocketManager (emitToRoom) and Socket.io (to(room).emit)
    if (typeof this.emitter.emitToRoom === 'function') {
      this.emitter.emitToRoom(roomName, eventName, payload);
      // Also emit on legacy channel for backwards compatibility
      this.emitter.emitToRoom(`tg:${this.gameId}:${this.room}`, eventName, payload);
    } else if (typeof this.emitter.to === 'function') {
      this.emitter.to(roomName).emit(eventName, payload);
      this.emitter.to(`tg:${this.gameId}:${this.room}`).emit(eventName, payload);
    }
  }

  /**
   * Checks if betting is currently open (authoritative server check)
   */
  isBettingAcceptable() {
    return this.currentPhase === UNIVERSAL_PHASES.BETTING_OPEN && Date.now() < this.phaseEndsAt;
  }

  // --- SUBCLASS LIFECYCLE HOOKS ---
  async onCreateRound(roundId) {}
  async onBettingOpen(roundId) {}
  async onBettingClosed(roundId) {}
  async onPlay(roundId) {}
  async onResult(roundId) { return null; }
  async onSettlement(roundId, result) {}
  async onCompleted(roundId, result) {}
  async onNextRound() {}

  /**
   * State Machine Transition Handler
   */
  async handlePhaseTransition() {
    switch (this.currentPhase) {
      case UNIVERSAL_PHASES.CREATED:
        await this.onBettingOpen(this.roundId);
        this.setPhase(UNIVERSAL_PHASES.BETTING_OPEN);
        break;

      case UNIVERSAL_PHASES.BETTING_OPEN:
        await this.onBettingClosed(this.roundId);
        this.setPhase(UNIVERSAL_PHASES.BETTING_CLOSED);
        break;

      case UNIVERSAL_PHASES.BETTING_CLOSED:
        await this.onPlay(this.roundId);
        this.setPhase(UNIVERSAL_PHASES.PLAYING);
        break;

      case UNIVERSAL_PHASES.PLAYING:
        this.clientSeed = crypto.randomBytes(16).toString('hex');
        this.currentResult = await this.onResult(this.roundId);
        this.setPhase(UNIVERSAL_PHASES.RESULT);
        break;

      case UNIVERSAL_PHASES.RESULT:
        await this.onSettlement(this.roundId, this.currentResult);
        this.setPhase(UNIVERSAL_PHASES.SETTLEMENT);
        break;

      case UNIVERSAL_PHASES.SETTLEMENT:
        await this.onCompleted(this.roundId, this.currentResult);
        if (this.currentResult) {
          this.history.unshift({
            roundId: this.roundId,
            result: this.currentResult,
            resultTime: new Date()
          });
          if (this.history.length > 30) this.history.pop();
        }
        this.setPhase(UNIVERSAL_PHASES.COMPLETED);
        break;

      case UNIVERSAL_PHASES.COMPLETED:
        await this.onNextRound();
        this.setPhase(UNIVERSAL_PHASES.NEXT_ROUND);
        break;

      case UNIVERSAL_PHASES.NEXT_ROUND:
        await this.initRound();
        break;
    }
  }

  /**
   * Main 1-second server tick loop
   */
  async loop() {
    while (this.isRunning) {
      try {
        const now = Date.now();
        this.phaseTimeLeft = Math.max(0, Math.ceil((this.phaseEndsAt - now) / 1000));

        if (now >= this.phaseEndsAt) {
          await this.handlePhaseTransition();
        }

        // Authoritative Tick Broadcast
        this.emitEvent('round:tick', {
          roundId: this.roundId,
          gameId: this.gameId,
          room: this.room,
          phase: this.currentPhase,
          serverTime: now,
          phaseEndsAt: this.phaseEndsAt,
          phaseTimeLeft: this.phaseTimeLeft,
          totalPhaseDuration: this.totalPhaseDuration,
          serverSeedHash: this.serverSeedHash,
          serverSeed: (this.currentPhase === UNIVERSAL_PHASES.RESULT || 
                       this.currentPhase === UNIVERSAL_PHASES.SETTLEMENT || 
                       this.currentPhase === UNIVERSAL_PHASES.COMPLETED ||
                       this.currentPhase === UNIVERSAL_PHASES.NEXT_ROUND) ? this.serverSeed : null,
          clientSeed: (this.currentPhase === UNIVERSAL_PHASES.RESULT || 
                       this.currentPhase === UNIVERSAL_PHASES.SETTLEMENT || 
                       this.currentPhase === UNIVERSAL_PHASES.COMPLETED ||
                       this.currentPhase === UNIVERSAL_PHASES.NEXT_ROUND) ? this.clientSeed : null,
          result: (this.currentPhase === UNIVERSAL_PHASES.RESULT || 
                   this.currentPhase === UNIVERSAL_PHASES.SETTLEMENT || 
                   this.currentPhase === UNIVERSAL_PHASES.COMPLETED ||
                   this.currentPhase === UNIVERSAL_PHASES.NEXT_ROUND) ? this.currentResult : null,
          history: this.history.slice(0, 20)
        });

      } catch (err) {
        console.error(`[UniversalEngine:${this.gameId}] Error in loop:`, err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { UniversalRoundEngine, UNIVERSAL_PHASES, DEFAULT_PHASE_DURATIONS };

const crypto = require('crypto');
const adminGameConfigService = require('../adminGameConfigService');

/**
 * Universal Game Round Engine Lifecycle Phases
 */
const UNIVERSAL_PHASES = {
  CREATED: 'CREATED',               // Round initialized, seeds generated, hash pre-committed
  BETTING_OPEN: 'BETTING_OPEN',     // Player bets accepted, visual timer running
  BETTING_CLOSED: 'BETTING_CLOSED', // Server locks bets, no more bets allowed
  PLAYING: 'PLAYING',               // Game animation action (dealing, spinning, rolling, flying)
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

    // Admin Governance & Versioned Payout Snapshot
    this.snapshottedPayoutVersion = 1;
    this.snapshottedPayoutRules = null;
    this.minBet = 10;
    this.maxBet = 50000;
    this.isMaintenance = false;
    this.maintenanceMessage = null;
    this.isEnabled = true;
    this.dealerSpeed = 1.0;

    // Unique Round State
    this.roundId = this.generateUniqueRoundId();
    this.currentPhase = UNIVERSAL_PHASES.CREATED;
    this.phaseStartedAt = Date.now();
    this.totalPhaseDuration = this.phaseDurations.CREATED;
    this.phaseEndsAt = this.phaseStartedAt + (this.totalPhaseDuration * 1000);
    this.phaseTimeLeft = this.totalPhaseDuration;

    // Active Bets Store for Instant Reconnection & Refresh State Recovery
    // Map<userId, Record<market, number>>
    this.activeBets = new Map();

    // Provably Fair Cryptographic Entropy
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.serverSeedHash = crypto.createHash('sha256').update(this.serverSeed).digest('hex');
    this.clientSeed = '';
    this.nonce = 1;

    // Outcome & History
    this.currentResult = null;
    this.history = [];
    this.isRunning = false;
    this.animationState = null;

    // Subscribe to live admin configuration updates
    this.unsubscribeAdminConfig = adminGameConfigService.subscribe((event, data) => {
      if (data && data.gameSlug === this.gameId) {
        if (event === 'CONFIG_UPDATED') {
          if (data.changes.isMaintenance !== undefined) {
            this.isMaintenance = data.changes.isMaintenance;
            this.maintenanceMessage = data.config.maintenanceMessage;
          }
          if (data.changes.isEnabled !== undefined) {
            this.isEnabled = data.changes.isEnabled;
          }
          if (data.changes.minBet !== undefined) {
            this.minBet = data.changes.minBet;
          }
          if (data.changes.maxBet !== undefined) {
            this.maxBet = data.changes.maxBet;
          }
          if (data.changes.dealerSpeed !== undefined) {
            this.dealerSpeed = data.changes.dealerSpeed;
          }
          this.emitEvent('round:status_update', {
            gameId: this.gameId,
            room: this.room,
            isMaintenance: this.isMaintenance,
            maintenanceMessage: this.maintenanceMessage,
            isEnabled: this.isEnabled,
            minBet: this.minBet,
            maxBet: this.maxBet,
            dealerSpeed: this.dealerSpeed
          });
        }
      }
    });
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
   * Records a user's bet in the active round
   */
  recordBet(userId, market, amount) {
    if (!this.activeBets.has(userId)) {
      this.activeBets.set(userId, {});
    }
    const userBets = this.activeBets.get(userId);
    userBets[market] = (userBets[market] || 0) + amount;
    return userBets;
  }

  /**
   * Retrieves active bets for a specific user in this round
   */
  getUserBets(userId) {
    return this.activeBets.get(userId) || {};
  }

  /**
   * Returns a complete state snapshot for instant client rehydration on refresh
   */
  getSnapshot(userId = 'guest') {
    const now = Date.now();
    return {
      roundId: this.roundId,
      gameId: this.gameId,
      room: this.room,
      phase: this.currentPhase,
      serverTime: now,
      phaseEndsAt: this.phaseEndsAt,
      phaseTimeLeft: Math.max(0, Math.ceil((this.phaseEndsAt - now) / 1000)),
      totalPhaseDuration: this.totalPhaseDuration,
      payoutVersion: this.snapshottedPayoutVersion,
      minBet: this.minBet,
      maxBet: this.maxBet,
      isMaintenance: this.isMaintenance,
      maintenanceMessage: this.maintenanceMessage,
      isEnabled: this.isEnabled,
      dealerSpeed: this.dealerSpeed,
      animationState: this.animationState,
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
      history: this.history.slice(0, 20),
      myBets: this.getUserBets(userId)
    };
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
    this.activeBets.clear();
    this.animationState = null;
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.serverSeedHash = crypto.createHash('sha256').update(this.serverSeed).digest('hex');
    this.clientSeed = '';
    this.currentResult = null;

    // Snapshot authoritative Admin Game Control state for this round
    const adminConfig = adminGameConfigService.getGameConfig(this.gameId);
    if (adminConfig) {
      this.snapshottedPayoutVersion = adminConfig.activePayoutVersion || 1;
      this.snapshottedPayoutRules = adminGameConfigService.getPayoutRules(this.gameId, this.snapshottedPayoutVersion);
      this.minBet = adminConfig.minBet || 10;
      this.maxBet = adminConfig.maxBet || 50000;
      this.isMaintenance = adminConfig.isMaintenance || false;
      this.maintenanceMessage = adminConfig.maintenanceMessage;
      this.isEnabled = adminConfig.isEnabled ?? true;
      this.dealerSpeed = adminConfig.dealerSpeed || 1.0;

      // Adjust durations according to betting countdown and dealer speed
      const speedFactor = 1 / (this.dealerSpeed || 1.0);
      if (adminConfig.bettingDuration) {
        this.phaseDurations.BETTING_OPEN = Math.max(3, Math.round(adminConfig.bettingDuration * speedFactor));
      }
      this.phaseDurations.PLAYING = Math.max(1, Math.round(4 * speedFactor));
      this.phaseDurations.RESULT = Math.max(1, Math.round(3 * speedFactor));
      this.phaseDurations.SETTLEMENT = Math.max(1, Math.round(3 * speedFactor));
      this.phaseDurations.NEXT_ROUND = Math.max(1, Math.round(2 * speedFactor));
    }

    await this.onCreateRound(this.roundId);
    this.emitEvent('round:created', {
      roundId: this.roundId,
      gameId: this.gameId,
      room: this.room,
      payoutVersion: this.snapshottedPayoutVersion,
      minBet: this.minBet,
      maxBet: this.maxBet,
      isMaintenance: this.isMaintenance,
      dealerSpeed: this.dealerSpeed,
      serverSeedHash: this.serverSeedHash,
      serverTime: Date.now()
    });

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

    const eventPayload = {
      roundId: this.roundId,
      gameId: this.gameId,
      room: this.room,
      phase: this.currentPhase,
      serverTime: Date.now(),
      phaseEndsAt: this.phaseEndsAt,
      totalPhaseDuration: this.totalPhaseDuration,
      phaseTimeLeft: this.phaseTimeLeft,
      animationState: this.animationState,
      serverSeedHash: this.serverSeedHash,
      result: (this.currentPhase === UNIVERSAL_PHASES.RESULT || 
               this.currentPhase === UNIVERSAL_PHASES.SETTLEMENT || 
               this.currentPhase === UNIVERSAL_PHASES.COMPLETED ||
               this.currentPhase === UNIVERSAL_PHASES.NEXT_ROUND) ? this.currentResult : null
    };

    // Emit general phase change
    this.emitEvent('round:phase_change', eventPayload);

    // Emit granular lifecycle events
    if (phase === UNIVERSAL_PHASES.BETTING_OPEN) {
      this.emitEvent('round:betting_open', eventPayload);
    } else if (phase === UNIVERSAL_PHASES.BETTING_CLOSED) {
      this.emitEvent('round:betting_closed', eventPayload);
    } else if (phase === UNIVERSAL_PHASES.PLAYING) {
      this.emitEvent('round:playing', eventPayload);
    } else if (phase === UNIVERSAL_PHASES.RESULT) {
      this.emitEvent('round:result', eventPayload);
    } else if (phase === UNIVERSAL_PHASES.SETTLEMENT) {
      this.emitEvent('round:settlement', eventPayload);
    } else if (phase === UNIVERSAL_PHASES.NEXT_ROUND) {
      this.emitEvent('round:next_round', eventPayload);
    }
  }

  /**
   * Broadcasts an event to the game room
   */
  emitEvent(eventName, payload) {
    if (!this.emitter) return;
    const roomName = `${this.gameId}:${this.room}`;
    
    if (typeof this.emitter.emitToRoom === 'function') {
      this.emitter.emitToRoom(roomName, eventName, payload);
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
    if (this.isMaintenance || !this.isEnabled) return false;
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
          animationState: this.animationState,
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

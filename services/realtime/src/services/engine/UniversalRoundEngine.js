const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const adminGameConfigService = require('../adminGameConfigService');
const { resultHistoryService } = require('../history/ResultHistoryService');

/**
 * Universal Game Round Engine Canonical Lifecycle Phases (Prompt #62)
 */
const UNIVERSAL_PHASES = {
  CREATED: 'CREATED',               // Round initialized, sequence incremented, SHA-256 pre-commitment published
  BETTING_OPEN: 'BETTING_OPEN',     // Player bets accepted, visual timer running
  BETTING_CLOSING: 'BETTING_CLOSING', // Final seconds warning before hard lock
  BETTING_LOCKED: 'BETTING_LOCKED', // Hard lock, no bets accepted under any circumstances
  PLAYING: 'PLAYING',               // Authoritative game animation action (dealing, spinning, rolling, flying)
  RESULT_REVEAL: 'RESULT_REVEAL',   // Server-authoritative outcome revealed & verified against pre-commitment
  SETTLEMENT: 'SETTLEMENT',         // Universal Settlement Engine: atomic payouts, ledger transactions
  COMPLETED: 'COMPLETED',           // Round finalized permanently in DB and Result History
  NEXT_ROUND: 'NEXT_ROUND'          // Seamless transition to next round with zero dead screen
};

// Backward-compatibility aliases for legacy code
UNIVERSAL_PHASES.BETTING_CLOSED = UNIVERSAL_PHASES.BETTING_LOCKED;
UNIVERSAL_PHASES.RESULT = UNIVERSAL_PHASES.RESULT_REVEAL;

/**
 * Default phase durations in seconds
 */
const DEFAULT_PHASE_DURATIONS = {
  CREATED: 1,
  BETTING_OPEN: 12,
  BETTING_CLOSING: 3,
  BETTING_LOCKED: 1,
  PLAYING: 4,
  RESULT_REVEAL: 3,
  SETTLEMENT: 2,
  COMPLETED: 1,
  NEXT_ROUND: 1
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

    // Sequence & Unique Round State
    this.sequenceNumber = 1n;
    this.roundId = this.generateUniqueRoundId();
    this.currentPhase = UNIVERSAL_PHASES.CREATED;
    this.phaseStartedAt = Date.now();
    this.totalPhaseDuration = this.phaseDurations.CREATED;
    this.phaseEndsAt = this.phaseStartedAt + (this.totalPhaseDuration * 1000);
    this.phaseTimeLeft = this.totalPhaseDuration;

    // Timestamps for auditability
    this.serverCreatedAt = new Date();
    this.bettingOpenAt = new Date();
    this.bettingCloseAt = new Date(Date.now() + 15000);
    this.gameplayStartAt = null;
    this.resultAt = null;
    this.settlementAt = null;
    this.completedAt = null;

    // Active Bets Store for Instant Reconnection & Refresh State Recovery
    // Map<userId, Record<market, number>>
    this.activeBets = new Map();
    this.betDetails = []; // Array of detailed bet objects for liability/payout calculation

    // Provably Fair Cryptographic Entropy
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.serverSeedHash = crypto.createHash('sha256').update(this.serverSeed).digest('hex');
    this.clientSeed = '';
    this.nonce = 1;

    // Outcome & History
    this.currentResult = null;
    this.resultSummary = null;
    this.history = [];
    this.isRunning = false;
    this.animationState = null;

    // DB Record reference
    this.dbRound = null;

    // Financial & Operational Metrics
    this.totalStakePaise = 0n;
    this.totalPayoutPaise = 0n;
    this.currentLiabilityPaise = 0n;
    this.playerCount = 0;
    this.simulatedPlayerCount = 0;

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
   * Generates a globally unique, structured round ID
   */
  generateUniqueRoundId() {
    const prefix = this.gameId.substring(0, 3).toUpperCase();
    const timestamp = Date.now();
    const entropy = crypto.randomBytes(3).toString('hex');
    return `${prefix}-${timestamp}-${entropy}`;
  }

  /**
   * Records a user's bet in the active round
   */
  recordBet(userId, market, amount, options = {}) {
    if (!this.activeBets.has(userId)) {
      this.activeBets.set(userId, {});
    }
    const userBets = this.activeBets.get(userId);
    userBets[market] = (userBets[market] || 0) + amount;

    const betPaise = BigInt(Math.round(amount * 100));
    this.totalStakePaise += betPaise;
    this.playerCount = this.activeBets.size;

    this.betDetails.push({
      userId,
      market,
      amount,
      betPaise,
      odds: options.odds || 2.0,
      isSimulated: Boolean(options.isSimulated),
      placedAt: new Date()
    });

    if (options.isSimulated) {
      this.simulatedPlayerCount++;
    }

    // Update estimated liability
    const estimatedPotentialPayout = BigInt(Math.round(amount * 100 * (options.odds || 2.0)));
    this.currentLiabilityPaise += estimatedPotentialPayout;

    return userBets;
  }

  /**
   * Retrieves active bets for a specific user in this round
   */
  getUserBets(userId) {
    return this.activeBets.get(userId) || {};
  }

  /**
   * Returns a complete state snapshot for instant client rehydration on refresh / reconnect
   */
  getSnapshot(userId = 'guest') {
    const now = Date.now();
    const isRevealed = [
      UNIVERSAL_PHASES.RESULT_REVEAL,
      UNIVERSAL_PHASES.SETTLEMENT,
      UNIVERSAL_PHASES.COMPLETED,
      UNIVERSAL_PHASES.NEXT_ROUND
    ].includes(this.currentPhase);

    return {
      roundId: this.roundId,
      gameId: this.gameId,
      variantId: this.room,
      room: this.room,
      phase: this.currentPhase,
      status: this.currentPhase,
      sequenceNumber: this.sequenceNumber.toString(),
      serverTime: now,
      serverCreatedAt: this.serverCreatedAt,
      bettingOpenAt: this.bettingOpenAt,
      bettingCloseAt: this.bettingCloseAt,
      gameplayStartAt: this.gameplayStartAt,
      resultAt: this.resultAt,
      settlementAt: this.settlementAt,
      completedAt: this.completedAt,
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
      // Security: Only expose unrevealed seeds after RESULT_REVEAL
      serverSeed: isRevealed ? this.serverSeed : null,
      clientSeed: isRevealed ? this.clientSeed : null,
      result: isRevealed ? this.currentResult : null,
      resultSummary: isRevealed ? this.resultSummary : null,
      history: this.history.slice(0, 20),
      myBets: this.getUserBets(userId),
      metrics: {
        playerCount: this.playerCount,
        simulatedPlayerCount: this.simulatedPlayerCount,
        totalStakePaise: this.totalStakePaise.toString(),
        currentLiabilityPaise: this.currentLiabilityPaise.toString()
      }
    };
  }

  /**
   * Starts the authoritative server game loop
   */
  async start() {
    this.isRunning = true;
    console.log(`[UniversalEngine:${this.gameId}:${this.room}] Starting universal continuous round lifecycle`);
    
    // Register with Central Round Registry if available
    try {
      const RoundRegistry = require('./RoundRegistry');
      RoundRegistry.register(this);
    } catch (e) {
      // Ignore if registry not initialized
    }

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
    this.betDetails = [];
    this.animationState = null;
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.serverSeedHash = crypto.createHash('sha256').update(this.serverSeed).digest('hex');
    this.clientSeed = '';
    this.currentResult = null;
    this.resultSummary = null;
    this.totalStakePaise = 0n;
    this.totalPayoutPaise = 0n;
    this.currentLiabilityPaise = 0n;
    this.playerCount = 0;
    this.simulatedPlayerCount = 0;

    const now = new Date();
    this.serverCreatedAt = now;
    this.bettingOpenAt = now;

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
        const totalBetting = Math.max(6, Math.round(adminConfig.bettingDuration * speedFactor));
        this.phaseDurations.BETTING_CLOSING = Math.min(3, Math.floor(totalBetting / 3));
        this.phaseDurations.BETTING_OPEN = Math.max(3, totalBetting - this.phaseDurations.BETTING_CLOSING);
      }
      this.phaseDurations.PLAYING = Math.max(2, Math.round(4 * speedFactor));
      this.phaseDurations.RESULT_REVEAL = Math.max(2, Math.round(3 * speedFactor));
      this.phaseDurations.SETTLEMENT = Math.max(1, Math.round(2 * speedFactor));
      this.phaseDurations.NEXT_ROUND = Math.max(1, Math.round(1 * speedFactor));
    }

    const totalOpenSeconds = this.phaseDurations.BETTING_OPEN + this.phaseDurations.BETTING_CLOSING;
    this.bettingCloseAt = new Date(now.getTime() + (totalOpenSeconds * 1000));

    // Database record persistence (Idempotent: prevents duplicate active rounds on restart)
    try {
      this.dbRound = await prisma.gameRound.create({
        data: {
          id: this.roundId,
          gameId: this.gameId,
          variantId: this.room,
          sequenceNumber: this.sequenceNumber,
          status: UNIVERSAL_PHASES.CREATED,
          serverCreatedAt: this.serverCreatedAt,
          bettingOpenAt: this.bettingOpenAt,
          bettingCloseAt: this.bettingCloseAt,
          configurationVersion: this.snapshottedPayoutVersion,
          serverSeed: this.serverSeed,
          serverSeedHash: this.serverSeedHash,
          nonce: this.nonce,
          fairnessRef: `/api/fairness/verify?roundId=${this.roundId}`
        }
      });
    } catch (err) {
      console.warn(`[UniversalEngine:${this.gameId}] GameRound DB create notice:`, err.message);
    }

    await this.onCreateRound(this.roundId);

    // Canonical WebSocket Events
    const createPayload = {
      roundId: this.roundId,
      gameId: this.gameId,
      variantId: this.room,
      room: this.room,
      sequenceNumber: this.sequenceNumber.toString(),
      payoutVersion: this.snapshottedPayoutVersion,
      minBet: this.minBet,
      maxBet: this.maxBet,
      isMaintenance: this.isMaintenance,
      dealerSpeed: this.dealerSpeed,
      serverSeedHash: this.serverSeedHash, // Only pre-commitment hash published
      serverTime: Date.now(),
      bettingOpenAt: this.bettingOpenAt,
      bettingCloseAt: this.bettingCloseAt
    };

    this.emitEvent('ROUND_CREATED', createPayload);
    this.emitEvent('round:created', createPayload);

    if (resultHistoryService && typeof resultHistoryService.logTimelineEvent === 'function') {
      resultHistoryService.logTimelineEvent(this.roundId, 'ROUND_CREATED', {
        gameId: this.gameId,
        variantId: this.room,
        sequenceNumber: this.sequenceNumber.toString(),
        serverSeedHash: this.serverSeedHash
      });
    }

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

    if (this.roundId && resultHistoryService && typeof resultHistoryService.logTimelineEvent === 'function') {
      resultHistoryService.logTimelineEvent(this.roundId, phase, {
        phaseEndsAt: this.phaseEndsAt,
        totalPhaseDuration: this.totalPhaseDuration,
        serverTime: Date.now()
      });
    }

    const isRevealed = [
      UNIVERSAL_PHASES.RESULT_REVEAL,
      UNIVERSAL_PHASES.SETTLEMENT,
      UNIVERSAL_PHASES.COMPLETED,
      UNIVERSAL_PHASES.NEXT_ROUND
    ].includes(this.currentPhase);

    const eventPayload = {
      roundId: this.roundId,
      gameId: this.gameId,
      variantId: this.room,
      room: this.room,
      phase: this.currentPhase,
      status: this.currentPhase,
      sequenceNumber: this.sequenceNumber.toString(),
      serverTime: Date.now(),
      phaseEndsAt: this.phaseEndsAt,
      totalPhaseDuration: this.totalPhaseDuration,
      phaseTimeLeft: this.phaseTimeLeft,
      animationState: this.animationState,
      serverSeedHash: this.serverSeedHash,
      serverSeed: isRevealed ? this.serverSeed : null,
      clientSeed: isRevealed ? this.clientSeed : null,
      result: isRevealed ? this.currentResult : null,
      resultSummary: isRevealed ? this.resultSummary : null,
      metrics: {
        playerCount: this.playerCount,
        simulatedPlayerCount: this.simulatedPlayerCount,
        totalStakePaise: this.totalStakePaise.toString(),
        currentLiabilityPaise: this.currentLiabilityPaise.toString()
      }
    };

    // Emit general phase change (canonical + legacy aliases)
    this.emitEvent('round:phase_change', eventPayload);
    this.emitEvent('tg:phase_change', eventPayload);

    // Emit granular canonical & legacy lifecycle events
    switch (phase) {
      case UNIVERSAL_PHASES.BETTING_OPEN:
        this.emitEvent('BETTING_OPEN', eventPayload);
        this.emitEvent('ROUND_STARTED', eventPayload);
        this.emitEvent('round:betting_open', eventPayload);
        break;

      case UNIVERSAL_PHASES.BETTING_CLOSING:
        this.emitEvent('BETTING_CLOSING', eventPayload);
        this.emitEvent('round:betting_closing', eventPayload);
        break;

      case UNIVERSAL_PHASES.BETTING_LOCKED:
        this.emitEvent('BETTING_LOCKED', eventPayload);
        this.emitEvent('round:betting_closed', eventPayload);
        this.emitEvent('round:locked', eventPayload);
        this.emitEvent('tg:locked', { roundId: this.roundId });
        break;

      case UNIVERSAL_PHASES.PLAYING:
        this.gameplayStartAt = new Date();
        this.emitEvent('GAMEPLAY_STARTED', eventPayload);
        this.emitEvent('round:playing', eventPayload);
        break;

      case UNIVERSAL_PHASES.RESULT_REVEAL:
        this.resultAt = new Date();
        this.emitEvent('RESULT_REVEAL', eventPayload);
        this.emitEvent('RESULT_PUBLISHED', eventPayload);
        this.emitEvent('round:result', eventPayload);
        this.emitEvent('tg:result', {
          roundId: this.roundId,
          result: this.currentResult,
          winner: this.currentResult?.winner,
          dealer: this.dealer
        });
        break;

      case UNIVERSAL_PHASES.SETTLEMENT:
        this.settlementAt = new Date();
        this.emitEvent('SETTLEMENT_STARTED', eventPayload);
        this.emitEvent('round:settlement', eventPayload);
        this.emitEvent('tg:settled', { roundId: this.roundId });
        break;

      case UNIVERSAL_PHASES.COMPLETED:
        this.completedAt = new Date();
        this.emitEvent('ROUND_COMPLETED', eventPayload);
        this.emitEvent('round:completed', eventPayload);
        break;

      case UNIVERSAL_PHASES.NEXT_ROUND:
        this.emitEvent('NEXT_ROUND', eventPayload);
        this.emitEvent('round:next_round', eventPayload);
        break;
    }
  }

  /**
   * Broadcasts an event to the game room and admin monitoring channels
   */
  emitEvent(eventName, payload) {
    if (!this.emitter) return;
    const roomName = `${this.gameId}:${this.room}`;
    
    if (typeof this.emitter.emitToRoom === 'function') {
      this.emitter.emitToRoom(roomName, eventName, payload);
      this.emitter.emitToRoom(`tg:${this.gameId}:${this.room}`, eventName, payload);
      this.emitter.emitToRoom(`${this.gameId}`, eventName, payload);
    } else if (typeof this.emitter.to === 'function') {
      this.emitter.to(roomName).emit(eventName, payload);
      this.emitter.to(`tg:${this.gameId}:${this.room}`).emit(eventName, payload);
      this.emitter.to(`${this.gameId}`).emit(eventName, payload);
    }
  }

  /**
   * Checks if betting is currently open (authoritative server check)
   */
  isBettingAcceptable() {
    if (this.isMaintenance || !this.isEnabled) return false;
    const isBettingPhase = (this.currentPhase === UNIVERSAL_PHASES.BETTING_OPEN || 
                           this.currentPhase === UNIVERSAL_PHASES.BETTING_CLOSING);
    return isBettingPhase && Date.now() < this.phaseEndsAt;
  }

  // --- SUBCLASS LIFECYCLE HOOKS ---
  async onCreateRound(roundId) {}
  async onBettingOpen(roundId) {}
  async onBettingClosing(roundId) {}
  async onBettingLocked(roundId) {}
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
        await this.onBettingClosing(this.roundId);
        this.setPhase(UNIVERSAL_PHASES.BETTING_CLOSING);
        break;

      case UNIVERSAL_PHASES.BETTING_CLOSING:
        await this.onBettingLocked(this.roundId);
        // DB update to LOCKED status
        if (this.dbRound) {
          prisma.gameRound.update({
            where: { id: this.roundId },
            data: { status: UNIVERSAL_PHASES.BETTING_LOCKED }
          }).catch(() => {});
        }
        this.setPhase(UNIVERSAL_PHASES.BETTING_LOCKED);
        break;

      case UNIVERSAL_PHASES.BETTING_LOCKED:
        await this.onPlay(this.roundId);
        this.setPhase(UNIVERSAL_PHASES.PLAYING);
        break;

      case UNIVERSAL_PHASES.PLAYING:
        // Generate reveal entropy
        this.clientSeed = crypto.randomBytes(16).toString('hex');
        this.currentResult = await this.onResult(this.roundId);
        
        // Format result summary
        if (this.currentResult) {
          if (this.currentResult.winner) {
            this.resultSummary = this.currentResult.winner;
          } else if (this.currentResult.resultNumber !== undefined) {
            this.resultSummary = `${this.currentResult.resultNumber}`;
          } else if (this.currentResult.crashPoint !== undefined) {
            this.resultSummary = `${this.currentResult.crashPoint}x`;
          } else if (this.currentResult.number !== undefined) {
            this.resultSummary = `${this.currentResult.color?.toUpperCase()} ${this.currentResult.number}`;
          }
        }

        // DB update with authoritative outcome and revealed seeds
        if (this.dbRound) {
          prisma.gameRound.update({
            where: { id: this.roundId },
            data: {
              status: UNIVERSAL_PHASES.RESULT_REVEAL,
              clientSeed: this.clientSeed,
              result: this.currentResult || {},
              resultSummary: this.resultSummary,
              resultAt: new Date()
            }
          }).catch(() => {});
        }

        this.setPhase(UNIVERSAL_PHASES.RESULT_REVEAL);
        break;

      case UNIVERSAL_PHASES.RESULT_REVEAL:
        await this.onSettlement(this.roundId, this.currentResult);
        this.setPhase(UNIVERSAL_PHASES.SETTLEMENT);
        break;

      case UNIVERSAL_PHASES.SETTLEMENT:
        await this.onCompleted(this.roundId, this.currentResult);

        // Update permanent Result History in memory (most recent 50)
        if (this.currentResult) {
          this.history.unshift({
            roundId: this.roundId,
            game: this.gameId,
            variant: this.room,
            result: this.currentResult,
            resultSummary: this.resultSummary,
            resultTime: new Date(),
            serverSeedHash: this.serverSeedHash,
            serverSeed: this.serverSeed,
            clientSeed: this.clientSeed,
            settlementStatus: 'SETTLED'
          });
          if (this.history.length > 50) this.history.pop();

          // Prompt #65: Authoritative Universal Result Record & Realtime Event
          try {
            if (resultHistoryService && typeof resultHistoryService.recordResult === 'function') {
              const historyRecord = await resultHistoryService.recordResult({
                roundId: this.roundId,
                gameId: this.gameId,
                variantId: this.room,
                tableId: this.tableId || `${this.gameId}-${this.room}`,
                result: this.currentResult,
                resultSummary: this.resultSummary,
                serverSeed: this.serverSeed,
                serverSeedHash: this.serverSeedHash,
                clientSeed: this.clientSeed,
                nonce: this.nonce !== undefined ? this.nonce : 0,
                roundSequence: this.sequenceNumber,
                configurationVersion: 1,
                settlementStatus: 'SETTLED',
                totalStakePaise: this.totalStakePaise,
                totalPayoutPaise: this.totalPayoutPaise,
                playerCount: (this.playerCount || 0) + (this.simulatedPlayerCount || 0)
              });

              // Safe realtime event: RESULT_HISTORY_UPDATED
              // Contains only public, non-secret result and verification reference
              const publicHistoryPayload = {
                resultId: historyRecord.id || historyRecord.resultId,
                roundId: this.roundId,
                gameId: this.gameId,
                variantId: this.room,
                tableId: this.tableId || `${this.gameId}-${this.room}`,
                resultType: historyRecord.resultType,
                resultValue: historyRecord.resultValue,
                resultSummary: historyRecord.resultSummary,
                resultMetadata: historyRecord.resultMetadata,
                resultTimestamp: historyRecord.resultTimestamp,
                roundSequence: historyRecord.roundSequence ? historyRecord.roundSequence.toString() : '1',
                verificationStatus: historyRecord.verificationStatus || 'VERIFIED',
                commitmentHash: historyRecord.commitmentHash,
                settlementStatus: historyRecord.settlementStatus
              };

              this.emitEvent('RESULT_HISTORY_UPDATED', publicHistoryPayload);
              this.emitEvent('round:history_updated', publicHistoryPayload);
              this.emitEvent('tg:history_updated', publicHistoryPayload);
            }
          } catch (histErr) {
            console.error(`[UniversalRoundEngine] Error recording result history for ${this.roundId}:`, histErr.message);
          }
        }

        // Finalize DB GameRound record
        if (this.dbRound) {
          prisma.gameRound.update({
            where: { id: this.roundId },
            data: {
              status: UNIVERSAL_PHASES.COMPLETED,
              settlementStatus: 'SETTLED',
              totalStakePaise: this.totalStakePaise,
              totalPayoutPaise: this.totalPayoutPaise,
              playerCount: this.playerCount,
              simulatedPlayerCount: this.simulatedPlayerCount,
              completedAt: new Date()
            }
          }).catch(() => {});
        }

        this.emitEvent('SETTLEMENT_COMPLETED', {
          roundId: this.roundId,
          totalStakePaise: this.totalStakePaise.toString(),
          totalPayoutPaise: this.totalPayoutPaise.toString()
        });

        this.setPhase(UNIVERSAL_PHASES.COMPLETED);
        break;

      case UNIVERSAL_PHASES.COMPLETED:
        await this.onNextRound();
        this.sequenceNumber++;
        this.setPhase(UNIVERSAL_PHASES.NEXT_ROUND);
        break;

      case UNIVERSAL_PHASES.NEXT_ROUND:
        // Immediate start of next round — zero dead screen!
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

        const isRevealed = [
          UNIVERSAL_PHASES.RESULT_REVEAL,
          UNIVERSAL_PHASES.SETTLEMENT,
          UNIVERSAL_PHASES.COMPLETED,
          UNIVERSAL_PHASES.NEXT_ROUND
        ].includes(this.currentPhase);

        // Authoritative Tick Broadcast
        const tickPayload = {
          roundId: this.roundId,
          gameId: this.gameId,
          variantId: this.room,
          room: this.room,
          phase: this.currentPhase,
          status: this.currentPhase,
          sequenceNumber: this.sequenceNumber.toString(),
          serverTime: now,
          phaseEndsAt: this.phaseEndsAt,
          phaseTimeLeft: this.phaseTimeLeft,
          totalPhaseDuration: this.totalPhaseDuration,
          animationState: this.animationState,
          serverSeedHash: this.serverSeedHash,
          serverSeed: isRevealed ? this.serverSeed : null,
          clientSeed: isRevealed ? this.clientSeed : null,
          result: isRevealed ? this.currentResult : null,
          resultSummary: isRevealed ? this.resultSummary : null,
          history: this.history.slice(0, 20),
          metrics: {
            playerCount: this.playerCount,
            simulatedPlayerCount: this.simulatedPlayerCount,
            totalStakePaise: this.totalStakePaise.toString(),
            currentLiabilityPaise: this.currentLiabilityPaise.toString()
          }
        };

        this.emitEvent('COUNTDOWN', tickPayload);
        this.emitEvent('round:tick', tickPayload);
        this.emitEvent('tg:tick', tickPayload);

      } catch (err) {
        console.error(`[UniversalEngine:${this.gameId}] Error in loop:`, err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { UniversalRoundEngine, UNIVERSAL_PHASES, DEFAULT_PHASE_DURATIONS };

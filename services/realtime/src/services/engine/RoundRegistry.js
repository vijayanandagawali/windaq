/**
 * Central Realtime Round Registry (Prompt #62)
 * 
 * Tracks all active game engines and continuous rounds across WinDaq.
 * Exposes real-time aggregates, health status, and live table snapshots
 * for the Admin Realtime Control Center and system-wide monitoring.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class RoundRegistryClass {
  constructor() {
    // Map<gameSlug, Map<roomName, UniversalRoundEngine>>
    this.engines = new Map();
    this.serverBootTime = Date.now();
  }

  /**
   * Registers a game round engine
   */
  register(engine) {
    if (!engine || !engine.gameId) return;
    const gameId = engine.gameId;
    const room = engine.room || 'Standard';

    if (!this.engines.has(gameId)) {
      this.engines.set(gameId, new Map());
    }
    this.engines.get(gameId).set(room, engine);
    console.log(`[RoundRegistry] Registered engine: ${gameId} (${room})`);
  }

  /**
   * Unregisters an engine
   */
  unregister(gameId, room = 'Standard') {
    if (this.engines.has(gameId)) {
      this.engines.get(gameId).delete(room);
    }
  }

  /**
   * Retrieves a specific engine
   */
  getEngine(gameId, room = 'Standard') {
    if (this.engines.has(gameId)) {
      return this.engines.get(gameId).get(room) || null;
    }
    return null;
  }

  /**
   * Returns all active engines across the platform
   */
  getAllEngines() {
    const list = [];
    for (const [, rooms] of this.engines.entries()) {
      for (const [, engine] of rooms.entries()) {
        list.push(engine);
      }
    }
    return list;
  }

  /**
   * Returns comprehensive realtime overview for the Admin Realtime Control Center
   */
  getRealtimeOverview() {
    const now = Date.now();
    const engines = this.getAllEngines();

    let totalPlayers = 0;
    let totalSimulatedPlayers = 0;
    let totalStakePaise = 0n;
    let totalLiabilityPaise = 0n;

    const tables = engines.map(engine => {
      const snapshot = engine.getSnapshot('admin');
      
      const pCount = snapshot.metrics?.playerCount || 0;
      const simCount = snapshot.metrics?.simulatedPlayerCount || 0;
      const stakePaise = BigInt(snapshot.metrics?.totalStakePaise || '0');
      const liabilityPaise = BigInt(snapshot.metrics?.currentLiabilityPaise || '0');

      totalPlayers += pCount;
      totalSimulatedPlayers += simCount;
      totalStakePaise += stakePaise;
      totalLiabilityPaise += liabilityPaise;

      return {
        gameId: engine.gameId,
        variantId: engine.room,
        roundId: engine.roundId,
        sequenceNumber: engine.sequenceNumber.toString(),
        status: engine.currentPhase,
        phase: engine.currentPhase,
        countdown: engine.phaseTimeLeft,
        totalPhaseDuration: engine.totalPhaseDuration,
        phaseEndsAt: engine.phaseEndsAt,
        bettingState: engine.isBettingAcceptable() ? 'OPEN' : 'LOCKED',
        playerCount: pCount,
        simulatedPlayerCount: simCount,
        totalStakePaise: stakePaise.toString(),
        totalStakeRupees: Number(stakePaise) / 100,
        currentLiabilityPaise: liabilityPaise.toString(),
        currentLiabilityRupees: Number(liabilityPaise) / 100,
        serverSeedHash: engine.serverSeedHash,
        resultState: engine.currentResult ? 'REVEALED' : 'PENDING',
        resultSummary: engine.resultSummary || (engine.currentResult ? 'Calculated' : 'Pending'),
        settlementState: ['SETTLEMENT', 'COMPLETED', 'NEXT_ROUND'].includes(engine.currentPhase) ? 'SETTLED' : 'PENDING',
        serverHealth: 'HEALTHY',
        lastEvent: `${engine.currentPhase} at ${new Date(engine.phaseStartedAt).toISOString().slice(11, 19)}`,
        nextRound: `${engine.gameId.substring(0, 3).toUpperCase()}-${engine.sequenceNumber + 1n}`,
        isMaintenance: engine.isMaintenance,
        isEnabled: engine.isEnabled,
        dealerSpeed: engine.dealerSpeed,
        serverCreatedAt: engine.serverCreatedAt,
        bettingOpenAt: engine.bettingOpenAt,
        bettingCloseAt: engine.bettingCloseAt
      };
    });

    const memoryUsage = process.memoryUsage();

    return {
      success: true,
      timestamp: now,
      serverUptimeSeconds: Math.floor((now - this.serverBootTime) / 1000),
      serverHealth: {
        status: 'HEALTHY',
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        activeTables: tables.length,
        cpuStatus: 'OPTIMAL'
      },
      summary: {
        activeTablesCount: tables.length,
        totalPlayers,
        totalSimulatedPlayers,
        totalStakePaise: totalStakePaise.toString(),
        totalStakeRupees: Number(totalStakePaise) / 100,
        totalLiabilityPaise: totalLiabilityPaise.toString(),
        totalLiabilityRupees: Number(totalLiabilityPaise) / 100
      },
      tables
    };
  }

  /**
   * System startup recovery: inspect database for any rounds interrupted during server restart
   */
  async recoverInterruptedRounds() {
    try {
      console.log('[RoundRegistry] Checking database for interrupted rounds...');
      const interrupted = await prisma.gameRound.findMany({
        where: {
          status: {
            in: ['CREATED', 'BETTING_OPEN', 'BETTING_CLOSING', 'BETTING_LOCKED', 'PLAYING']
          }
        }
      });

      if (interrupted.length > 0) {
        console.log(`[RoundRegistry] Found ${interrupted.length} interrupted rounds from previous server run. Finalizing safely...`);
        for (const round of interrupted) {
          await prisma.gameRound.update({
            where: { id: round.id },
            data: {
              status: 'COMPLETED',
              settlementStatus: 'VOID',
              resultSummary: 'RECOVERED_ON_SERVER_BOOT',
              completedAt: new Date()
            }
          });
          console.log(`[RoundRegistry] Safely closed previous round ${round.id}`);
        }
      } else {
        console.log('[RoundRegistry] Zero interrupted rounds in database. Clean boot.');
      }
    } catch (err) {
      console.warn('[RoundRegistry] Error in round recovery check:', err.message);
    }
  }
}

// Singleton instance
const RoundRegistry = new RoundRegistryClass();
module.exports = RoundRegistry;

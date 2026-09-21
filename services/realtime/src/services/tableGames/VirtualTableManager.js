/**
 * VirtualTableManager.js
 * 
 * Central Manager for Multi-Table Continuous Virtual Dealer Operations.
 * Manages independent tables, dealer assignments, round lifecycles, simulated opponents,
 * and admin configuration audits.
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');
const { dealerRegistry } = require('../dealers/VirtualDealerRegistry');
const { botFramework } = require('../simulation/SimulatedOpponentFramework');

const DEFAULT_TABLE_CONFIGS = [
  {
    tableId: 'table-01',
    name: 'VIP European Roulette',
    gameId: 'roulette',
    variantId: 'single-zero',
    dealerId: 'dealer_sophia',
    status: 'ACTIVE',
    minBet: 10,
    maxBet: 5000,
    bettingDuration: 15,
    resultDuration: 6,
    nextRoundDelay: 2,
    seatCount: 8,
    maxPlayers: 500,
    simulationEnabled: true,
    animationProfile: 'deliberate',
    soundProfile: 'classic_casino',
    configurationVersion: 1
  },
  {
    tableId: 'table-02',
    name: 'Simulated Dragon Tiger A',
    gameId: 'dragon-tiger',
    variantId: 'classic-dt',
    dealerId: 'dealer_maya',
    status: 'ACTIVE',
    minBet: 10,
    maxBet: 10000,
    bettingDuration: 12,
    resultDuration: 4,
    nextRoundDelay: 2,
    seatCount: 6,
    maxPlayers: 1000,
    simulationEnabled: true,
    animationProfile: 'smooth',
    soundProfile: 'modern_luxury',
    configurationVersion: 1
  },
  {
    tableId: 'table-03',
    name: 'Universal Andar Bahar',
    gameId: 'andar-bahar',
    variantId: 'classic-ab',
    dealerId: 'dealer_arjun',
    status: 'ACTIVE',
    minBet: 10,
    maxBet: 5000,
    bettingDuration: 15,
    resultDuration: 6,
    nextRoundDelay: 3,
    seatCount: 8,
    maxPlayers: 500,
    simulationEnabled: true,
    animationProfile: 'standard',
    soundProfile: 'traditional',
    configurationVersion: 1
  },
  {
    tableId: 'table-04',
    name: 'Simulated VIP Blackjack',
    gameId: 'blackjack',
    variantId: 'vegas-strip',
    dealerId: 'dealer_liam',
    status: 'ACTIVE',
    minBet: 25,
    maxBet: 2500,
    bettingDuration: 15,
    resultDuration: 5,
    nextRoundDelay: 3,
    seatCount: 7,
    maxPlayers: 7,
    simulationEnabled: true,
    animationProfile: 'brisk',
    soundProfile: 'high_energy',
    configurationVersion: 1
  },
  {
    tableId: 'table-05',
    name: 'Virtual Teen Patti Live',
    gameId: 'teen-patti',
    variantId: 'classic-20',
    dealerId: 'dealer_arjun',
    status: 'ACTIVE',
    minBet: 20,
    maxBet: 2000,
    bettingDuration: 12,
    resultDuration: 5,
    nextRoundDelay: 2,
    seatCount: 6,
    maxPlayers: 6,
    simulationEnabled: true,
    animationProfile: 'standard',
    soundProfile: 'traditional',
    configurationVersion: 1
  },
  {
    tableId: 'table-06',
    name: 'Grand Hold\'em Poker',
    gameId: 'poker',
    variantId: 'no-limit-holdem',
    dealerId: 'dealer_liam',
    status: 'ACTIVE',
    minBet: 50,
    maxBet: 5000,
    bettingDuration: 15,
    resultDuration: 6,
    nextRoundDelay: 3,
    seatCount: 9,
    maxPlayers: 9,
    simulationEnabled: true,
    animationProfile: 'brisk',
    soundProfile: 'classic_casino',
    configurationVersion: 1
  },
  {
    tableId: 'table-07',
    name: 'Indian Points Rummy',
    gameId: 'rummy',
    variantId: 'points-rummy',
    dealerId: 'dealer_maya',
    status: 'ACTIVE',
    minBet: 10,
    maxBet: 1000,
    bettingDuration: 15,
    resultDuration: 6,
    nextRoundDelay: 3,
    seatCount: 6,
    maxPlayers: 6,
    simulationEnabled: true,
    animationProfile: 'smooth',
    soundProfile: 'modern_luxury',
    configurationVersion: 1
  },
  {
    tableId: 'table-08',
    name: 'Universal Lotto 5M',
    gameId: 'lotto',
    variantId: '5-minute-draw',
    dealerId: 'dealer_sophia',
    status: 'ACTIVE',
    minBet: 10,
    maxBet: 1000,
    bettingDuration: 20,
    resultDuration: 8,
    nextRoundDelay: 5,
    seatCount: 12,
    maxPlayers: 10000,
    simulationEnabled: true,
    animationProfile: 'deliberate',
    soundProfile: 'classic_casino',
    configurationVersion: 1
  }
];

class VirtualTableManager extends EventEmitter {
  constructor(io = null) {
    super();
    this.io = io;
    this.tables = new Map();
    this.engineInstances = new Map();
    this.auditLogs = [];

    // Initialize default tables
    DEFAULT_TABLE_CONFIGS.forEach(cfg => {
      this.registerTable(cfg);
    });
  }

  setIO(io) {
    this.io = io;
  }

  registerTable(config) {
    const table = {
      ...config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seatedPlayers: [],
      simulatedBots: [],
      currentRound: null,
      stats: {
        totalRounds: 0,
        totalStake: 0,
        totalPayout: 0
      },
      health: 'HEALTHY'
    };

    // Assign initial simulated test bots if enabled
    if (table.simulationEnabled) {
      const bots = botFramework.assignBotsToTable(table.tableId, 3, table.gameId);
      table.simulatedBots = bots.map(b => ({
        botId: b.botId,
        displayName: b.displayName,
        badge: 'SIMULATED_TEST_BOT',
        seatIndex: b.seatIndex,
        status: b.status
      }));
    }

    this.tables.set(config.tableId, table);
    return table;
  }

  /**
   * Bind an active game engine instance to a table
   */
  bindEngine(tableId, engine) {
    this.engineInstances.set(tableId, engine);
    const table = this.tables.get(tableId);
    if (!table) return;

    // Synchronize dealer profile with engine
    const dealer = dealerRegistry.getDealer(table.dealerId);
    if (dealer && engine.dealer) {
      engine.dealer = {
        name: dealer.displayName,
        title: dealer.title,
        tableId: table.tableId,
        avatar: dealer.avatar,
        action: 'IDLE',
        speech: dealer.greeting,
        profile: dealer
      };
    }

    // Forward events & audit if event emitter supported
    if (typeof engine.on === 'function') {
      engine.on('round:tick', (tick) => {
        if (table) {
          table.currentRound = {
            roundId: tick.roundId,
            phase: tick.phase,
            phaseTimeLeft: tick.phaseTimeLeft,
            totalPhaseDuration: tick.totalPhaseDuration,
            serverSeedHash: tick.serverSeedHash,
            serverSeed: tick.serverSeed,
            result: tick.result
          };
        }
      });
    }
  }

  getTable(tableId) {
    return this.tables.get(tableId);
  }

  getAllTables() {
    return Array.from(this.tables.values());
  }

  /**
   * Get complete live overview for Admin Live Tables Dashboard
   */
  getLiveAdminOverview() {
    return Array.from(this.tables.values()).map(table => {
      const engine = this.engineInstances.get(table.tableId);
      const roundSnapshot = engine ? engine.getSnapshot('admin') : null;
      const dealer = dealerRegistry.getDealer(table.dealerId);

      return {
        tableId: table.tableId,
        name: table.name,
        gameId: table.gameId,
        variantId: table.variantId,
        dealer: {
          dealerId: table.dealerId,
          displayName: dealer ? dealer.displayName : 'Virtual Dealer',
          avatar: dealer ? dealer.avatar : 'maya',
          action: roundSnapshot?.dealer?.action || 'IDLE',
          speech: roundSnapshot?.dealer?.speech || dealer?.greeting
        },
        status: table.status,
        roundId: roundSnapshot?.roundId || table.currentRound?.roundId || 'N/A',
        phase: roundSnapshot?.phase || table.currentRound?.phase || 'IDLE',
        phaseTimeLeft: roundSnapshot?.phaseTimeLeft ?? table.currentRound?.phaseTimeLeft ?? 0,
        totalPhaseDuration: roundSnapshot?.totalPhaseDuration ?? table.currentRound?.totalPhaseDuration ?? 15,
        minBet: table.minBet,
        maxBet: table.maxBet,
        seatedPlayersCount: table.seatedPlayers.length,
        simulatedBotsCount: table.simulatedBots.length,
        simulatedBots: table.simulatedBots,
        totalStake: table.stats.totalStake,
        totalPayout: table.stats.totalPayout,
        serverSeedHash: roundSnapshot?.serverSeedHash || table.currentRound?.serverSeedHash,
        result: roundSnapshot?.result || table.currentRound?.result,
        health: table.health,
        simulationEnabled: table.simulationEnabled,
        configurationVersion: table.configurationVersion
      };
    });
  }

  /**
   * Admin Table Configuration Update
   * Audited. Strictly rejects result manipulation.
   */
  updateTableConfig(tableId, updates, adminUser = 'admin') {
    const table = this.tables.get(tableId);
    if (!table) {
      throw new Error(`Table ${tableId} not found`);
    }

    // STRICT CHECK: Result manipulation is forbidden by architecture
    if (updates.result !== undefined || updates.winningNumber !== undefined || updates.winner !== undefined) {
      throw new Error('Direct outcome manipulation is strictly prohibited. Results are server-authoritative and cryptographic.');
    }

    const previous = { ...table };
    const allowedKeys = [
      'name', 'dealerId', 'status', 'minBet', 'maxBet', 
      'bettingDuration', 'resultDuration', 'nextRoundDelay',
      'seatCount', 'maxPlayers', 'simulationEnabled', 'animationProfile', 'soundProfile'
    ];

    allowedKeys.forEach(key => {
      if (updates[key] !== undefined) {
        table[key] = updates[key];
      }
    });

    table.configurationVersion += 1;
    table.updatedAt = new Date().toISOString();

    // Log configuration audit
    const auditRecord = {
      auditId: `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      tableId,
      adminUser,
      timestamp: new Date().toISOString(),
      changes: updates,
      version: table.configurationVersion
    };
    this.auditLogs.unshift(auditRecord);

    // If dealer changed, update engine dealer profile
    if (updates.dealerId) {
      const newDealer = dealerRegistry.getDealer(updates.dealerId);
      const engine = this.engineInstances.get(tableId);
      if (engine && newDealer) {
        engine.dealer = {
          name: newDealer.displayName,
          title: newDealer.title,
          tableId: table.tableId,
          avatar: newDealer.avatar,
          action: 'IDLE',
          speech: newDealer.greeting,
          profile: newDealer
        };
      }
    }

    // Broadcast table update event
    if (this.io) {
      this.io.emit('table:config_updated', { tableId, table });
      this.io.to('admin:realtime').emit('admin:table_updated', { tableId, table });
    }

    return table;
  }

  getAuditLogs(tableId = null) {
    if (tableId) {
      return this.auditLogs.filter(l => l.tableId === tableId);
    }
    return this.auditLogs.slice(0, 100);
  }
}

const tableManager = new VirtualTableManager();
module.exports = {
  VirtualTableManager,
  tableManager,
  DEFAULT_TABLE_CONFIGS
};

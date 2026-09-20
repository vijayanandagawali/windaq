const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Baseline Default Game Configurations and v1 Payout Rules
 */
const DEFAULT_GAME_CONFIGS = {
  'dragon-tiger': {
    gameSlug: 'dragon-tiger',
    name: 'Dragon Tiger',
    category: 'TABLE',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Scheduled card shoe replacement in progress. Back shortly.',
    visibility: 'FEATURED',
    dealerSpeed: 1.0,
    minBet: 10,
    maxBet: 50000,
    roundDuration: 30,
    bettingDuration: 15,
    activePayoutVersion: 1,
    variants: [
      { id: 'standard', name: 'Standard Room', isEnabled: true, minBet: 10, maxBet: 10000 },
      { id: 'vip', name: 'VIP Salon Privé', isEnabled: true, minBet: 500, maxBet: 100000 },
      { id: 'turbo', name: 'Turbo Speed', isEnabled: true, minBet: 20, maxBet: 25000 }
    ],
    payoutRules: {
      DRAGON: 2.0,
      TIGER: 2.0,
      TIE: 9.0,
      SUITED_TIE: 50.0,
      DRAGON_ODD: 1.9,
      DRAGON_EVEN: 1.9,
      TIGER_ODD: 1.9,
      TIGER_EVEN: 1.9
    }
  },
  'european-roulette': {
    gameSlug: 'european-roulette',
    name: 'European Roulette',
    category: 'ROULETTE',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Wheel recalibration in progress. Back in 10 minutes.',
    visibility: 'FEATURED',
    dealerSpeed: 1.0,
    minBet: 10,
    maxBet: 100000,
    roundDuration: 35,
    bettingDuration: 20,
    activePayoutVersion: 1,
    variants: [
      { id: 'auto', name: 'Auto Wheel', isEnabled: true, minBet: 10, maxBet: 25000 },
      { id: 'vip', name: 'VIP Grand', isEnabled: true, minBet: 100, maxBet: 100000 }
    ],
    payoutRules: {
      STRAIGHT: 36.0,
      SPLIT: 18.0,
      STREET: 12.0,
      CORNER: 9.0,
      LINE: 6.0,
      DOZEN: 3.0,
      COLUMN: 3.0,
      RED: 2.0,
      BLACK: 2.0,
      EVEN: 2.0,
      ODD: 2.0,
      LOW: 2.0,
      HIGH: 2.0
    }
  },
  'aviator': {
    gameSlug: 'aviator',
    name: 'Aviator Crash',
    category: 'CRASH',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Radar system upgrade. Please stand by.',
    visibility: 'FEATURED',
    dealerSpeed: 1.0,
    minBet: 10,
    maxBet: 100000,
    roundDuration: 25,
    bettingDuration: 10,
    activePayoutVersion: 1,
    variants: [
      { id: 'single', name: 'Standard Flight', isEnabled: true, minBet: 10, maxBet: 50000 },
      { id: 'dual', name: 'Dual Bet Express', isEnabled: true, minBet: 50, maxBet: 100000 }
    ],
    payoutRules: {
      HOUSE_EDGE: 0.03,
      MAX_MULTIPLIER: 1000.0,
      MIN_CRASH_RATE: 0.01
    }
  },
  'andar-bahar': {
    gameSlug: 'andar-bahar',
    name: 'Andar Bahar',
    category: 'TABLE',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Table shuffle in progress.',
    visibility: 'VISIBLE',
    dealerSpeed: 1.0,
    minBet: 10,
    maxBet: 50000,
    roundDuration: 30,
    bettingDuration: 15,
    activePayoutVersion: 1,
    variants: [
      { id: 'standard', name: 'Classic Table', isEnabled: true, minBet: 10, maxBet: 10000 },
      { id: 'super', name: 'Super Andar Bahar', isEnabled: true, minBet: 100, maxBet: 50000 }
    ],
    payoutRules: {
      ANDAR: 1.95,
      BAHAR: 2.0,
      FIRST_BET: 1.25
    }
  },
  'blackjack': {
    gameSlug: 'blackjack',
    name: 'Blackjack Classic',
    category: 'CARDS',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Shoe shuffle in progress.',
    visibility: 'VISIBLE',
    dealerSpeed: 1.0,
    minBet: 50,
    maxBet: 100000,
    roundDuration: 40,
    bettingDuration: 15,
    activePayoutVersion: 1,
    variants: [
      { id: 'classic', name: 'Classic Table', isEnabled: true, minBet: 50, maxBet: 25000 },
      { id: 'vip', name: 'VIP Diamond', isEnabled: true, minBet: 500, maxBet: 100000 }
    ],
    payoutRules: {
      NATURAL_BLACKJACK: 2.5,
      STANDARD_WIN: 2.0,
      INSURANCE: 3.0
    }
  },
  'teen-patti': {
    gameSlug: 'teen-patti',
    name: 'Teen Patti Classic',
    category: 'CARDS',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Deck rotation in progress.',
    visibility: 'VISIBLE',
    dealerSpeed: 1.0,
    minBet: 10,
    maxBet: 50000,
    roundDuration: 35,
    bettingDuration: 15,
    activePayoutVersion: 1,
    variants: [
      { id: 'classic-10', name: 'Classic ₹10 Boot', isEnabled: true, minBet: 10, maxBet: 10000 },
      { id: 'pro-50', name: 'Pro ₹50 Boot', isEnabled: true, minBet: 50, maxBet: 50000 }
    ],
    payoutRules: {
      BOOT_AMOUNT: 10.0,
      COMMISSION_RATE: 0.025
    }
  },
  'colour-prediction': {
    gameSlug: 'colour-prediction',
    name: 'Colour Prediction',
    category: 'LOTTERY',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Server sync in progress.',
    visibility: 'VISIBLE',
    dealerSpeed: 1.0,
    minBet: 10,
    maxBet: 50000,
    roundDuration: 60,
    bettingDuration: 45,
    activePayoutVersion: 1,
    variants: [
      { id: '1min', name: '1 Min Fast', isEnabled: true, minBet: 10, maxBet: 20000 },
      { id: '3min', name: '3 Min Standard', isEnabled: true, minBet: 10, maxBet: 50000 }
    ],
    payoutRules: {
      RED: 2.0,
      GREEN: 2.0,
      VIOLET: 4.5,
      NUMBER: 9.0,
      BIG: 2.0,
      SMALL: 2.0
    }
  },
  'dice': {
    gameSlug: 'dice',
    name: 'Sic Bo Classic',
    category: 'DICE',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Dice cup inspection in progress.',
    visibility: 'VISIBLE',
    dealerSpeed: 1.0,
    minBet: 10,
    maxBet: 50000,
    roundDuration: 30,
    bettingDuration: 15,
    activePayoutVersion: 1,
    variants: [
      { id: '1min', name: '1 Min Turbo', isEnabled: true, minBet: 10, maxBet: 20000 }
    ],
    payoutRules: {
      SMALL: 2.0,
      BIG: 2.0,
      SPECIFIC_TRIPLE: 180.0,
      ANY_TRIPLE: 30.0
    }
  },
  'slots': {
    gameSlug: 'slots',
    name: 'Ocean Treasures Slots',
    category: 'SLOTS',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'RNG routine inspection in progress.',
    visibility: 'VISIBLE',
    dealerSpeed: 1.0,
    minBet: 10,
    maxBet: 10000,
    roundDuration: 5,
    bettingDuration: 5,
    activePayoutVersion: 1,
    variants: [
      { id: 'standard', name: '5x3 Standard', isEnabled: true, minBet: 10, maxBet: 10000 }
    ],
    payoutRules: {
      RTP: 96.5,
      SCATTER_PAYOUT: 25.0,
      WILD_MULTIPLIER: 2.0
    }
  },
  'lotto': {
    gameSlug: 'lotto',
    name: 'Quick Draw 6/49',
    category: 'LOTTERY',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Ball blower audit in progress.',
    visibility: 'VISIBLE',
    dealerSpeed: 1.0,
    minBet: 50,
    maxBet: 20000,
    roundDuration: 300,
    bettingDuration: 240,
    activePayoutVersion: 1,
    variants: [
      { id: '5min', name: '5 Min Draw', isEnabled: true, minBet: 50, maxBet: 20000 }
    ],
    payoutRules: {
      MATCH_3: 5.0,
      MATCH_4: 50.0,
      MATCH_5: 1000.0,
      MATCH_6: 100000.0
    }
  },
  'scratch': {
    gameSlug: 'scratch',
    name: 'Lucky 7 Scratch',
    category: 'INSTANT',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Ticket batch reload in progress.',
    visibility: 'VISIBLE',
    dealerSpeed: 1.0,
    minBet: 50,
    maxBet: 10000,
    roundDuration: 10,
    bettingDuration: 10,
    activePayoutVersion: 1,
    variants: [
      { id: 'silver', name: 'Silver Card', isEnabled: true, minBet: 50, maxBet: 500 },
      { id: 'gold', name: 'Gold Card', isEnabled: true, minBet: 500, maxBet: 5000 }
    ],
    payoutRules: {
      RTP: 95.0,
      TOP_PRIZE: 50000.0
    }
  },
  'rummy': {
    gameSlug: 'rummy',
    name: 'Indian Rummy',
    category: 'CARDS',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Server maintenance in progress.',
    visibility: 'VISIBLE',
    dealerSpeed: 1.0,
    minBet: 10,
    maxBet: 25000,
    roundDuration: 120,
    bettingDuration: 15,
    activePayoutVersion: 1,
    variants: [
      { id: 'points-10', name: 'Points Rummy (₹10/pt)', isEnabled: true, minBet: 10, maxBet: 25000 }
    ],
    payoutRules: {
      MAX_PENALTY_POINTS: 80,
      COMMISSION_RATE: 0.05
    }
  },
  'live-casino': {
    gameSlug: 'live-casino',
    name: 'Live Dealer Studio',
    category: 'LIVE',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Live camera calibration in progress.',
    visibility: 'FEATURED',
    dealerSpeed: 1.0,
    minBet: 100,
    maxBet: 500000,
    roundDuration: 45,
    bettingDuration: 20,
    activePayoutVersion: 1,
    variants: [
      { id: 'live-roulette-1', name: 'Studio Roulette 1', isEnabled: true, minBet: 100, maxBet: 250000 }
    ],
    payoutRules: {
      STRAIGHT: 36.0,
      RED: 2.0,
      BLACK: 2.0
    }
  },
  'sportsbook': {
    gameSlug: 'sportsbook',
    name: 'Cricket Sportsbook',
    category: 'SPORTS',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Odds provider feed reconnecting.',
    visibility: 'FEATURED',
    dealerSpeed: 1.0,
    minBet: 50,
    maxBet: 500000,
    roundDuration: 300,
    bettingDuration: 300,
    activePayoutVersion: 1,
    variants: [
      { id: 'cricket', name: 'Live Cricket In-Play', isEnabled: true, minBet: 50, maxBet: 500000 }
    ],
    payoutRules: {
      COMMISSION: 0.02,
      MAX_ODDS: 500.0
    }
  },
  'lightning-roulette': {
    gameSlug: 'lightning-roulette',
    name: 'Lightning Roulette',
    category: 'ROULETTE',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Multiplier generator recalibrating.',
    visibility: 'FEATURED',
    dealerSpeed: 1.0,
    minBet: 20,
    maxBet: 100000,
    roundDuration: 40,
    bettingDuration: 20,
    activePayoutVersion: 1,
    variants: [
      { id: 'lightning-1', name: 'Lightning Wheel 1', isEnabled: true, minBet: 20, maxBet: 100000 }
    ],
    payoutRules: {
      STRAIGHT: 30.0,
      LIGHTNING_MULTIPLIER_MAX: 500.0,
      RED: 2.0,
      BLACK: 2.0
    }
  },
  'texas-holdem': {
    gameSlug: 'texas-holdem',
    name: 'Texas Hold\'em Poker',
    category: 'CARDS',
    isEnabled: true,
    isMaintenance: false,
    maintenanceMessage: 'Table seating reshuffle.',
    visibility: 'VISIBLE',
    dealerSpeed: 1.0,
    minBet: 50,
    maxBet: 100000,
    roundDuration: 60,
    bettingDuration: 15,
    activePayoutVersion: 1,
    variants: [
      { id: 'nl-holdem', name: 'No-Limit Holdem', isEnabled: true, minBet: 50, maxBet: 100000 }
    ],
    payoutRules: {
      RAKE_PERCENT: 3.0,
      CAP: 500.0
    }
  }
};

class AdminGameConfigService {
  constructor() {
    // High-performance In-Memory Cache
    this.configs = new Map();
    this.payoutVersions = new Map(); // Map<gameSlug, Map<version, PayoutRuleVersion>>
    this.audits = []; // In-memory fallback + DB persistence
    this.initialized = false;
    this.subscribers = new Set(); // Listeners for real-time engine updates
  }

  /**
   * Initializes baseline data from defaults and database
   */
  async initialize() {
    if (this.initialized) return;

    // Load defaults into cache
    for (const [slug, defaultCfg] of Object.entries(DEFAULT_GAME_CONFIGS)) {
      this.configs.set(slug, {
        id: `cfg-${slug}`,
        gameSlug: slug,
        name: defaultCfg.name,
        category: defaultCfg.category,
        isEnabled: defaultCfg.isEnabled,
        isMaintenance: defaultCfg.isMaintenance,
        maintenanceMessage: defaultCfg.maintenanceMessage,
        visibility: defaultCfg.visibility,
        dealerSpeed: defaultCfg.dealerSpeed,
        minBet: defaultCfg.minBet,
        maxBet: defaultCfg.maxBet,
        roundDuration: defaultCfg.roundDuration,
        bettingDuration: defaultCfg.bettingDuration,
        activePayoutVersion: defaultCfg.activePayoutVersion,
        variants: defaultCfg.variants,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      // Initialize v1 payout rule
      if (!this.payoutVersions.has(slug)) {
        this.payoutVersions.set(slug, new Map());
      }
      this.payoutVersions.get(slug).set(1, {
        id: `prv-${slug}-1`,
        gameSlug: slug,
        version: 1,
        rules: defaultCfg.payoutRules,
        reason: 'Initial system baseline deployment',
        createdBy: 'SYSTEM_BOOTSTRAP',
        effectiveFrom: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        isActive: true
      });
    }

    // Try to sync with DB tables if available
    try {
      const dbConfigs = await prisma.$queryRawUnsafe(`SELECT * FROM "GameConfig"`);
      if (Array.isArray(dbConfigs) && dbConfigs.length > 0) {
        for (const row of dbConfigs) {
          const variants = typeof row.variants === 'string' ? JSON.parse(row.variants) : (row.variants || []);
          this.configs.set(row.gameSlug, {
            ...row,
            variants
          });
        }
      } else {
        // Seed database with defaults
        await this.seedDatabaseWithDefaults();
      }

      const dbVersions = await prisma.$queryRawUnsafe(`SELECT * FROM "PayoutRuleVersion" ORDER BY version ASC`);
      if (Array.isArray(dbVersions) && dbVersions.length > 0) {
        for (const row of dbVersions) {
          if (!this.payoutVersions.has(row.gameSlug)) {
            this.payoutVersions.set(row.gameSlug, new Map());
          }
          const rules = typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules;
          this.payoutVersions.get(row.gameSlug).set(row.version, {
            ...row,
            rules
          });
        }
      }

      const dbAudits = await prisma.$queryRawUnsafe(`SELECT * FROM "GameConfigAudit" ORDER BY "createdAt" DESC LIMIT 100`);
      if (Array.isArray(dbAudits)) {
        this.audits = dbAudits.map(a => ({
          ...a,
          oldValue: typeof a.oldValue === 'string' ? JSON.parse(a.oldValue) : a.oldValue,
          newValue: typeof a.newValue === 'string' ? JSON.parse(a.newValue) : a.newValue
        }));
      }
    } catch (err) {
      console.warn('[AdminGameConfigService] Note on DB sync (using memory cache):', err.message);
    }

    this.initialized = true;
    console.log(`[AdminGameConfigService] Initialized with ${this.configs.size} games and versioned payout rules.`);
  }

  async seedDatabaseWithDefaults() {
    try {
      for (const [slug, cfg] of this.configs.entries()) {
        const id = crypto.randomUUID();
        await prisma.$executeRawUnsafe(`
          INSERT INTO "GameConfig" (
            "id", "gameSlug", "name", "category", "isEnabled", "isMaintenance",
            "maintenanceMessage", "visibility", "dealerSpeed", "minBet", "maxBet",
            "roundDuration", "bettingDuration", "activePayoutVersion", "variants", "updatedAt", "createdAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, NOW(), NOW()
          ) ON CONFLICT ("gameSlug") DO NOTHING
        `, id, cfg.gameSlug, cfg.name, cfg.category, cfg.isEnabled, cfg.isMaintenance,
           cfg.maintenanceMessage, cfg.visibility, cfg.dealerSpeed, cfg.minBet, cfg.maxBet,
           cfg.roundDuration, cfg.bettingDuration, cfg.activePayoutVersion, JSON.stringify(cfg.variants));

        const v1Rules = this.getPayoutRules(slug, 1);
        await prisma.$executeRawUnsafe(`
          INSERT INTO "PayoutRuleVersion" (
            "id", "gameConfigId", "gameSlug", "version", "rules", "reason", "createdBy", "effectiveFrom", "createdAt", "isActive"
          ) VALUES (
            $1, $2, $3, 1, $4::jsonb, $5, 'SYSTEM_BOOTSTRAP', NOW(), NOW(), true
          ) ON CONFLICT ("gameSlug", "version") DO NOTHING
        `, crypto.randomUUID(), id, slug, JSON.stringify(v1Rules), 'Initial system baseline deployment');
      }
    } catch (e) {
      console.warn('[AdminGameConfigService] Seed DB error:', e.message);
    }
  }

  /**
   * Subscribe to config and payout changes for real-time engine hot-reloading
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(event, data) {
    for (const callback of this.subscribers) {
      try {
        callback(event, data);
      } catch (err) {
        console.error('[AdminGameConfigService] Subscriber notification error:', err);
      }
    }
  }

  /**
   * Returns all game configs with current active payout rules and version metadata
   */
  getAllGameConfigs() {
    const results = [];
    for (const [slug, cfg] of this.configs.entries()) {
      const activeRules = this.getPayoutRules(slug, cfg.activePayoutVersion);
      const versionHistory = this.getPayoutVersionHistory(slug);
      results.push({
        ...cfg,
        payoutRules: activeRules,
        payoutVersionsCount: versionHistory.length
      });
    }
    return results;
  }

  /**
   * Returns single game config
   */
  getGameConfig(slug) {
    const cfg = this.configs.get(slug);
    if (!cfg) return null;
    const activeRules = this.getPayoutRules(slug, cfg.activePayoutVersion);
    const versionHistory = this.getPayoutVersionHistory(slug);
    return {
      ...cfg,
      payoutRules: activeRules,
      versionHistory
    };
  }

  /**
   * Retrieves payout rules for a specific version
   */
  getPayoutRules(slug, version = 1) {
    const slugVersions = this.payoutVersions.get(slug);
    if (!slugVersions) {
      return DEFAULT_GAME_CONFIGS[slug]?.payoutRules || {};
    }
    const versionData = slugVersions.get(Number(version));
    if (versionData) {
      return versionData.rules;
    }
    // Fallback to active version or version 1
    const firstVer = slugVersions.get(1);
    return firstVer ? firstVer.rules : (DEFAULT_GAME_CONFIGS[slug]?.payoutRules || {});
  }

  /**
   * Retrieves entire payout version history for a game
   */
  getPayoutVersionHistory(slug) {
    const slugVersions = this.payoutVersions.get(slug);
    if (!slugVersions) return [];
    return Array.from(slugVersions.values()).sort((a, b) => b.version - a.version);
  }

  /**
   * Deploy a new versioned payout rule set
   * CRITICAL: Financial payout rules must be versioned + audited!
   */
  async deployPayoutVersion(slug, newRules, reason, adminId = 'SUPER_ADMIN_DEMO_001', ipAddress = '127.0.0.1') {
    if (!slug || !this.configs.has(slug)) {
      throw new Error(`Game '${slug}' not found.`);
    }
    if (!newRules || typeof newRules !== 'object' || Object.keys(newRules).length === 0) {
      throw new Error('Payout rules payload cannot be empty.');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      throw new Error('Mandatory audit reason required when deploying financial payout rules (minimum 3 characters).');
    }

    const currentConfig = this.configs.get(slug);
    const slugVersions = this.payoutVersions.get(slug) || new Map();
    
    // Monotonically increment version
    let maxVersion = 0;
    for (const v of slugVersions.keys()) {
      if (v > maxVersion) maxVersion = v;
    }
    const nextVersion = maxVersion + 1;

    const oldRules = this.getPayoutRules(slug, currentConfig.activePayoutVersion);

    // Mark previous versions as inactive
    for (const vData of slugVersions.values()) {
      vData.isActive = false;
    }

    const versionRecord = {
      id: crypto.randomUUID(),
      gameConfigId: currentConfig.id,
      gameSlug: slug,
      version: nextVersion,
      rules: newRules,
      reason: reason.trim(),
      createdBy: adminId,
      effectiveFrom: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isActive: true
    };

    // Store new version in cache
    slugVersions.set(nextVersion, versionRecord);
    this.payoutVersions.set(slug, slugVersions);

    // Update active version in game config
    currentConfig.activePayoutVersion = nextVersion;
    currentConfig.updatedAt = new Date().toISOString();
    this.configs.set(slug, currentConfig);

    // Record Immutable Audit Log
    await this.recordAudit({
      gameSlug: slug,
      adminId,
      action: 'PAYOUT_RULE_VERSIONED',
      fieldChanged: 'activePayoutVersion',
      oldValue: { version: currentConfig.activePayoutVersion - 1, rules: oldRules },
      newValue: { version: nextVersion, rules: newRules },
      reason: reason.trim(),
      ipAddress
    });

    // Try DB persistence
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE "GameConfig" 
        SET "activePayoutVersion" = $1, "updatedAt" = NOW() 
        WHERE "gameSlug" = $2
      `, nextVersion, slug);

      await prisma.$executeRawUnsafe(`
        UPDATE "PayoutRuleVersion" SET "isActive" = false WHERE "gameSlug" = $1
      `, slug);

      await prisma.$executeRawUnsafe(`
        INSERT INTO "PayoutRuleVersion" (
          "id", "gameConfigId", "gameSlug", "version", "rules", "reason", "createdBy", "effectiveFrom", "createdAt", "isActive"
        ) VALUES (
          $1, $2, $3, $4, $5::jsonb, $6, $7, NOW(), NOW(), true
        )
      `, versionRecord.id, currentConfig.id, slug, nextVersion, JSON.stringify(newRules), reason.trim(), adminId);
    } catch (dbErr) {
      console.warn('[AdminGameConfigService] DB write error for payout version:', dbErr.message);
    }

    // Broadcast update to real-time engines
    this.notifySubscribers('PAYOUT_RULE_VERSIONED', {
      gameSlug: slug,
      newVersion: nextVersion,
      rules: newRules,
      effectiveFrom: versionRecord.effectiveFrom
    });

    return {
      success: true,
      gameSlug: slug,
      version: nextVersion,
      rules: newRules,
      reason: reason.trim(),
      effectiveFrom: versionRecord.effectiveFrom
    };
  }

  /**
   * Update general game configuration: enable/disable, maintenance, limits, durations, dealer speed, visibility, variants
   */
  async updateGameConfig(slug, updates, adminId = 'SUPER_ADMIN_DEMO_001', ipAddress = '127.0.0.1') {
    if (!slug || !this.configs.has(slug)) {
      throw new Error(`Game '${slug}' not found.`);
    }

    const current = this.configs.get(slug);
    const allowedFields = [
      'isEnabled', 'isMaintenance', 'maintenanceMessage', 
      'visibility', 'dealerSpeed', 'minBet', 'maxBet', 
      'roundDuration', 'bettingDuration', 'variants'
    ];

    const changedDiffOld = {};
    const changedDiffNew = {};
    let hasChanges = false;

    for (const field of allowedFields) {
      if (updates[field] !== undefined && JSON.stringify(updates[field]) !== JSON.stringify(current[field])) {
        changedDiffOld[field] = current[field];
        changedDiffNew[field] = updates[field];
        current[field] = updates[field];
        hasChanges = true;
      }
    }

    if (!hasChanges) {
      return { success: true, message: 'No changes detected.', config: current };
    }

    // Limit validations
    if (current.minBet && current.maxBet && current.minBet > current.maxBet) {
      throw new Error('Min Bet cannot be greater than Max Bet.');
    }
    if (current.bettingDuration && current.roundDuration && current.bettingDuration > current.roundDuration) {
      throw new Error('Betting countdown cannot exceed total round duration.');
    }
    if (current.dealerSpeed && (current.dealerSpeed < 0.5 || current.dealerSpeed > 3.0)) {
      throw new Error('Dealer speed multiplier must be between 0.5x and 3.0x.');
    }

    current.updatedAt = new Date().toISOString();
    this.configs.set(slug, current);

    // Determine audit action type
    let action = 'GAME_CONFIG_UPDATED';
    if ('isEnabled' in changedDiffNew) action = 'GAME_STATUS_CHANGED';
    else if ('isMaintenance' in changedDiffNew) action = 'MAINTENANCE_TOGGLED';
    else if ('minBet' in changedDiffNew || 'maxBet' in changedDiffNew) action = 'LIMITS_UPDATED';
    else if ('roundDuration' in changedDiffNew || 'bettingDuration' in changedDiffNew) action = 'DURATIONS_UPDATED';
    else if ('dealerSpeed' in changedDiffNew) action = 'DEALER_SPEED_UPDATED';
    else if ('visibility' in changedDiffNew) action = 'VISIBILITY_UPDATED';
    else if ('variants' in changedDiffNew) action = 'VARIANT_TOGGLED';

    const reason = updates.reason || `Admin update for ${Object.keys(changedDiffNew).join(', ')}`;

    // Record Audit
    await this.recordAudit({
      gameSlug: slug,
      adminId,
      action,
      fieldChanged: Object.keys(changedDiffNew).join(', '),
      oldValue: changedDiffOld,
      newValue: changedDiffNew,
      reason,
      ipAddress
    });

    // Try DB update
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE "GameConfig"
        SET 
          "isEnabled" = $1,
          "isMaintenance" = $2,
          "maintenanceMessage" = $3,
          "visibility" = $4,
          "dealerSpeed" = $5,
          "minBet" = $6,
          "maxBet" = $7,
          "roundDuration" = $8,
          "bettingDuration" = $9,
          "variants" = $10::jsonb,
          "updatedAt" = NOW()
        WHERE "gameSlug" = $11
      `, current.isEnabled, current.isMaintenance, current.maintenanceMessage,
         current.visibility, current.dealerSpeed, current.minBet, current.maxBet,
         current.roundDuration, current.bettingDuration, JSON.stringify(current.variants), slug);
    } catch (dbErr) {
      console.warn('[AdminGameConfigService] DB update error for config:', dbErr.message);
    }

    // Notify engines of updated controls
    this.notifySubscribers('CONFIG_UPDATED', {
      gameSlug: slug,
      config: current,
      changes: changedDiffNew
    });

    return {
      success: true,
      config: current,
      changes: changedDiffNew
    };
  }

  /**
   * Toggle a specific game variant / room on/off
   */
  async toggleVariant(slug, variantId, isEnabled, adminId = 'SUPER_ADMIN_DEMO_001', ipAddress = '127.0.0.1') {
    const config = this.configs.get(slug);
    if (!config) throw new Error(`Game '${slug}' not found.`);

    const variants = Array.isArray(config.variants) ? [...config.variants] : [];
    const index = variants.findIndex(v => v.id.toLowerCase() === variantId.toLowerCase());
    if (index === -1) {
      throw new Error(`Variant '${variantId}' not found for game '${slug}'.`);
    }

    const oldState = variants[index].isEnabled;
    variants[index].isEnabled = Boolean(isEnabled);

    return this.updateGameConfig(slug, {
      variants,
      reason: `Variant '${variants[index].name}' ${isEnabled ? 'enabled' : 'disabled'}`
    }, adminId, ipAddress);
  }

  /**
   * Check if game and variant are currently open for gameplay
   */
  isGameOperational(slug, variantId = null) {
    const config = this.configs.get(slug);
    if (!config) return { operational: true }; // Fallback allow if unconfigured

    if (!config.isEnabled) {
      return {
        operational: false,
        reason: 'GAME_DISABLED',
        message: `${config.name} is currently deactivated by the platform administrator.`
      };
    }

    if (config.isMaintenance) {
      return {
        operational: false,
        reason: 'MAINTENANCE_MODE',
        message: config.maintenanceMessage || 'Game is temporarily undergoing scheduled maintenance.'
      };
    }

    if (variantId && Array.isArray(config.variants)) {
      const variant = config.variants.find(v => v.id.toLowerCase() === variantId.toLowerCase());
      if (variant && !variant.isEnabled) {
        return {
          operational: false,
          reason: 'VARIANT_DISABLED',
          message: `The '${variant.name}' room is currently closed by the platform administrator.`
        };
      }
    }

    return {
      operational: true,
      minBet: config.minBet,
      maxBet: config.maxBet,
      dealerSpeed: config.dealerSpeed,
      activePayoutVersion: config.activePayoutVersion
    };
  }

  /**
   * Records an immutable audit log entry
   */
  async recordAudit({ gameSlug, adminId, action, fieldChanged, oldValue, newValue, reason, ipAddress }) {
    const auditRecord = {
      id: crypto.randomUUID(),
      gameSlug,
      adminId,
      adminRole: 'SUPER_ADMIN',
      action,
      fieldChanged,
      oldValue,
      newValue,
      reason: reason || 'Administrative modification',
      ipAddress: ipAddress || '127.0.0.1',
      createdAt: new Date().toISOString()
    };

    // Store in memory
    this.audits.unshift(auditRecord);
    if (this.audits.length > 500) this.audits.pop();

    // Persist in DB
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "GameConfigAudit" (
          "id", "gameSlug", "adminId", "adminRole", "action", "fieldChanged", "oldValue", "newValue", "reason", "ipAddress", "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, NOW()
        )
      `, auditRecord.id, gameSlug, adminId, 'SUPER_ADMIN', action, fieldChanged,
         JSON.stringify(oldValue), JSON.stringify(newValue), auditRecord.reason, ipAddress);
    } catch (dbErr) {
      console.warn('[AdminGameConfigService] DB audit write error:', dbErr.message);
    }

    return auditRecord;
  }

  /**
   * Retrieves audit records for a game or overall
   */
  getAudits(slug = null) {
    if (slug) {
      return this.audits.filter(a => a.gameSlug === slug);
    }
    return this.audits;
  }
}

// Global Singleton Instance
const adminGameConfigService = new AdminGameConfigService();

module.exports = adminGameConfigService;

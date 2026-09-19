const crypto = require('crypto');
const { redisClient } = require('../config/redisClient');

const GAME_STATE = {
  WAITING: 'waiting',
  FLYING: 'flying',
  CRASHED: 'crashed'
};

class AviatorEngine {
  constructor(io) {
    this.io = io;
    this.state = GAME_STATE.WAITING;
    this.multiplier = 1.00;
    this.crashPoint = 1.00;
    this.tickRateMs = 100;
    
    // Provably Fair Variables
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.clientSeed = "0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c"; // Real world: Bitcoin block hash
    this.nonce = 1;
  }

  startLoop() {
    this.scheduleNextRound();
  }

  scheduleNextRound() {
    this.state = GAME_STATE.WAITING;
    this.multiplier = 1.00;
    this.nonce++;
    
    // Generate new crash point using Provably Fair algorithm before round starts
    this.crashPoint = this.generateProvablyFairCrashPoint(this.serverSeed, this.clientSeed, this.nonce);
    
    // Create an SHA-256 hash of the server seed to send to clients beforehand so they can verify later
    const hash = crypto.createHmac('sha256', this.serverSeed).update(this.nonce.toString()).digest('hex');
    
    let countdown = 6;
    const waitInterval = setInterval(() => {
      this.io.to('aviator').emit('aviator:waiting', { countdown, hash });
      countdown--;
      
      if (countdown < 0) {
        clearInterval(waitInterval);
        this.startFlying();
      }
    }, 1000);
  }

  /**
   * Provably Fair RNG Algorithm
   */
  generateProvablyFairCrashPoint(serverSeed, clientSeed, nonce) {
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(`${clientSeed}:${nonce}`);
    const hex = hmac.digest('hex');
    
    // Take first 52 bits (13 hex characters) to create an even distribution
    const h = parseInt(hex.substring(0, 13), 16);
    const e = Math.pow(2, 52);
    
    // Provably fair math for Crash games (1% house edge built in)
    const result = Math.floor((100 * e - h) / (e - h));
    const crashMultiplier = Math.max(100, result) / 100;
    
    return crashMultiplier;
  }

  startFlying() {
    this.state = GAME_STATE.FLYING;
    this.io.to('aviator').emit('aviator:start', {});
    
    // Reset multiplier
    this.multiplier = 1.00;
    
    const flyInterval = setInterval(async () => {
      // Non-linear exponential growth
      this.multiplier += 0.01 * this.multiplier + 0.005; 
      
      if (this.multiplier >= this.crashPoint) {
        clearInterval(flyInterval);
        this.crash();
      } else {
        const currentMultiplier = this.multiplier.toFixed(2);
        this.io.to('aviator').emit('aviator:tick', { multiplier: currentMultiplier });
        await redisClient.set('aviator:current_multiplier', currentMultiplier);
      }
    }, this.tickRateMs);
  }

  crash() {
    this.state = GAME_STATE.CRASHED;
    const finalMultiplier = this.crashPoint.toFixed(2);
    
    // On crash, reveal the serverSeed so clients can verify the math
    this.io.to('aviator').emit('aviator:crashed', { 
      multiplier: finalMultiplier,
      serverSeed: this.serverSeed,
      clientSeed: this.clientSeed,
      nonce: this.nonce
    });
    
    // Rotate server seed for the next set of rounds after revealing
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    
    setTimeout(() => {
      this.scheduleNextRound();
    }, 4000);
  }
}

module.exports = AviatorEngine;

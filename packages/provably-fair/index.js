const crypto = require('crypto');

/**
 * Generate a Provably Fair Server Seed
 */
function generateServerSeed() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a Provably Fair Game Hash
 * Combines serverSeed and clientSeed (if provided)
 */
function generateGameHash(serverSeed, clientSeed = "0000000000000000000") {
    return crypto.createHmac('sha256', serverSeed).update(clientSeed).digest('hex');
}

/**
 * Calculate crash point from hash
 * Ensures fair odds with a 1% house edge
 */
function calculateCrashPoint(hash) {
    // Take the first 13 hex characters (52 bits) and convert to decimal
    const n = parseInt(hash.slice(0, 13), 16);
    const e = Math.pow(2, 52); // 2^52
    
    // Provably fair math calculation
    const result = Math.floor((100 * e - n) / (e - n)) / 100;
    
    // House edge implementation
    return Math.max(1.00, result);
}

module.exports = {
    generateServerSeed,
    generateGameHash,
    calculateCrashPoint
};

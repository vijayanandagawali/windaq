const crypto = require('crypto');

class ProvablyFair {
  // Generate random 64-char hex server seed
  generateServerSeed() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate SHA-256 hash of server seed (to display to player before round starts)
  hashServerSeed(serverSeed) {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  // Calculate Aviator crash multiplier using SHA-256 HMAC (Stake/Spribe standard)
  generateCrashMultiplier(serverSeed, clientSeed = '00000000000000000004136C', nonce = 1, rtpMode = 'BALANCED') {
    const message = `${clientSeed}:${nonce}`;
    const hmac = crypto.createHmac('sha256', serverSeed).update(message).digest('hex');

    // 1 in 33 chance of instant crash at 1.00x (House edge)
    const houseEdgeMod = rtpMode === 'FAIR' ? 50 : (rtpMode === 'HOUSE_EDGE' ? 20 : 33);
    const intVal = parseInt(hmac.substring(0, 8), 16);
    if (intVal % houseEdgeMod === 0) {
      return 1.00;
    }

    // 100 / (100 - X) formula
    const h = parseInt(hmac.substring(0, 13), 16);
    const e = Math.pow(2, 52);
    const multiplier = Math.floor((100 * e - h) / (e - h)) / 100;

    return Math.max(1.01, parseFloat(multiplier.toFixed(2)));
  }

  // Verify that an outcome matches a revealed seed
  verifyOutcome(serverSeed, clientSeed, nonce, expectedMultiplier, rtpMode = 'BALANCED') {
    const calc = this.generateCrashMultiplier(serverSeed, clientSeed, nonce, rtpMode);
    return Math.abs(calc - expectedMultiplier) < 0.01;
  }
}

module.exports = new ProvablyFair();

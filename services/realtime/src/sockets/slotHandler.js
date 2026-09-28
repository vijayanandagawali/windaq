const crypto = require('crypto');
const { SlotEngine } = require('slot-engine');
const walletService = require('../services/walletService');
const { requirePlayer, parseStake, debitStake, replyError, GameError, prisma } = require('../services/gameBets');

const engine = new SlotEngine();

function handleSlotSockets(socket, io) {
  // Join specific slot room
  socket.on('slot:join', async () => {
    socket.join('slot:oceantreasures');
    console.log(`Client ${socket.id} joined slot:oceantreasures`);
  });

  socket.on('slot:leave', () => {
    socket.leave('slot:oceantreasures');
  });

  // Handle spin request: debit, outcome and settlement happen atomically on the server.
  socket.on('slot:spin', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      // The page sends paise; stakes are whole rupees between ₹10 and ₹10,000.
      const stakePaise = parseStake(data.stake, { unit: 'paise', min: 10, max: 10000 });
      if (stakePaise % 100n !== 0n) throw new GameError('INVALID_AMOUNT', 'Stake must be a whole rupee amount.');

      const spinId = crypto.randomUUID();
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = crypto.randomBytes(16).toString('hex');
      const nonce = 1;
      const grid = engine.generateGrid(serverSeed, clientSeed, nonce);
      const evalResult = engine.evaluate(grid, Number(stakePaise));
      const payoutPaise = BigInt(Math.floor(evalResult.totalWin));

      const newBalance = await prisma.$transaction(async (tx) => {
        await debitStake(tx, userId, stakePaise, 'slots', spinId);
        const balance = payoutPaise > 0n
          ? await walletService.settleWin(tx, userId, stakePaise, payoutPaise, 'SLOTS_WIN', spinId)
          : (await walletService.settleLoss(tx, userId, stakePaise, 'SLOTS_LOSS', spinId), null);
        await tx.slotSpin.create({
          data: { id: spinId, userId, configVer: engine.configVersion, stake: stakePaise, payout: payoutPaise, grid, serverSeed, clientSeed, nonce }
        });
        return balance;
      });

      const wallet = newBalance === null ? await walletService.getWallet(prisma, userId) : null;
      if (typeof callback === 'function') {
        callback({
          success: true,
          data: {
            spinId,
            grid,
            winningLines: evalResult.winningLines,
            totalWin: Number(payoutPaise),
            newBalance: newBalance !== null ? Number(newBalance) : Number(wallet.balance),
            serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex')
          }
        });
      }
    } catch (err) {
      replyError(callback, err, 'Slot spin');
    }
  });
}

module.exports = { handleSlotSockets };
